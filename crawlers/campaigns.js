const fs = require('fs');
const path = require('path');
const { ROOT, baseDataDir } = require('./config');
const { fetchText } = require('./olden-era/http');

const RAW_DIR = path.join(ROOT, 'raw-data', 'campaign');
const EXTRACT_DIR = path.join(RAW_DIR, 'extracted');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const h1 = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripHtml(h1[1]).slice(0, 120);
  const title = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? stripHtml(title[1]).slice(0, 120) : '';
}

function extractHeadings(html) {
  return Array.from(String(html || '').matchAll(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi))
    .map((match) => ({
      level: Number(match[1]),
      text: stripHtml(match[2]).slice(0, 140),
    }))
    .filter((item) => item.text)
    .slice(0, 40);
}

function sourceDigest(html) {
  const text = stripHtml(html);
  const words = text.split(/\s+/).filter(Boolean);
  return {
    title: extractTitle(html),
    wordCount: words.length,
    headings: extractHeadings(html),
    excerpt: words.slice(0, 80).join(' '),
  };
}

function relatedSourceObjects(seedSources, sourceIds, fetchedReports, checkedAt) {
  const sourceMap = new Map(seedSources.map((source) => [source.id, source]));
  const reportMap = new Map(fetchedReports.map((report) => [report.id, report]));
  return sourceIds.map((id) => {
    const source = sourceMap.get(id) || { id };
    const report = reportMap.get(id);
    return {
      id,
      name: source.name || id,
      url: source.url || '',
      type: source.type || 'reference',
      usage: source.usage || '',
      checkedAt,
      available: report ? !report.error : false,
    };
  });
}

async function fetchCampaignSources(sources, checkedAt) {
  const reports = [];
  writeJson(path.join(RAW_DIR, 'sources.json'), { schemaVersion: 1, checkedAt, sources });

  for (const source of sources) {
    try {
      const html = await fetchText(source.url, 1);
      const digest = sourceDigest(html);
      const report = {
        ...source,
        checkedAt,
        error: '',
        ...digest,
      };
      reports.push(report);
      writeJson(path.join(EXTRACT_DIR, `${source.id}.json`), report);
    } catch (err) {
      const report = {
        ...source,
        checkedAt,
        error: err.message,
        title: '',
        wordCount: 0,
        headings: [],
        excerpt: '',
      };
      reports.push(report);
      writeJson(path.join(EXTRACT_DIR, `${source.id}.json`), report);
    }
  }

  writeJson(path.join(RAW_DIR, 'source_reports.json'), {
    schemaVersion: 1,
    checkedAt,
    reports,
  });
  return reports;
}

async function buildCampaignData(now = new Date().toISOString()) {
  const checkedAt = now.slice(0, 10);
  const seed = readJson(path.join(baseDataDir, 'campaigns.seed.json'), { sources: [], campaigns: [] });
  const reports = await fetchCampaignSources(seed.sources || [], checkedAt);

  const campaigns = (seed.campaigns || []).map((campaign) => ({
    ...campaign,
    schemaVersion: 1,
    updatedAt: now,
    sources: relatedSourceObjects(seed.sources || [], campaign.sourceIds || [], reports, checkedAt),
    sourceIds: undefined,
  })).sort((a, b) => {
    const actDelta = (a.act || 0) - (b.act || 0);
    if (actDelta !== 0) return actDelta;
    return (a.order || 0) - (b.order || 0);
  });

  const campaignSources = {
    schemaVersion: 1,
    updatedAt: now,
    checkedAt,
    sources: seed.sources || [],
    reports,
  };

  return { campaigns, campaignSources };
}

module.exports = { buildCampaignData };
