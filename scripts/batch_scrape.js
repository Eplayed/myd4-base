const https = require('https');
const fs = require('fs');

const API_KEY = 'fc-fb921ef922284346be06b8c4d21ff3cd';
const DELAY_MS = 500; // 500ms between requests

function apiReq(path, method, body) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'api.firecrawl.dev',
      port: 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    });
    req.on('error', rej);
    req.setTimeout(60000, () => { req.destroy(); rej(new Error('timeout')); });
    if (body) req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function scrapeUrl(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await apiReq('/v1/scrape', 'POST', {
        url: url,
        formats: ['markdown'],
        waitFor: 12000  // 12秒等待JS渲染
      });
      if (resp.status === 200) {
        const json = JSON.parse(resp.body);
        if (json.success && (json.data?.markdown || json.data?.text)) {
          return { success: true, markdown: json.data?.markdown || '', text: json.data?.text || '' };
        }
        // 成功但无内容，也返回
        return { success: true, markdown: json.data?.markdown || '', text: json.data?.text || '' };
      } else if (resp.status === 408 || resp.status === 504 || resp.status === 500) {
        if (attempt < retries - 1) {
          console.log(`  [RETRY ${attempt+1}] HTTP ${resp.status}, waiting...`);
          await sleep(8000);
          continue;
        }
        return { success: false, error: `HTTP ${resp.status}: ${resp.body.slice(0, 200)}` };
      } else {
        return { success: false, error: `HTTP ${resp.status}: ${resp.body.slice(0, 200)}` };
      }
    } catch (e) {
      if (attempt < retries - 1) {
        console.log(`  [RETRY ${attempt+1}] ${e.message}, waiting...`);
        await sleep(5000);
        continue;
      }
      return { success: false, error: e.message };
    }
  }
}

async function main() {
  // Load build IDs
  const ids = fs.readFileSync('D:/project/myd4-base-data/data/build_ids.txt', 'utf8').trim().split('\n');
  console.log(`Total builds to scrape: ${ids.length}`);

  const outDir = 'D:/project/myd4-base-data/data/builds_detail_raw';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let processed = 0, failed = 0;

  for (const id of ids) {
    const outFile = `${outDir}/${id}.json`;
    // 跳过已有成功内容的文件
    if (fs.existsSync(outFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        if (existing.success && (existing.markdown || existing.text)) {
          console.log(`[SKIP] ${id} (already OK, ${(existing.markdown||existing.text||'').length} chars)`);
          await sleep(DELAY_MS);
          continue;
        }
      } catch(e) {}
    }
    const url = `https://www.d2core.com/d4/planner?bd=${id}`;
    console.log(`[SCRAPE] ${id}...`);
    const result = await scrapeUrl(url);
    const ok = result.success && (result.markdown || result.text);
    if (ok) {
      processed++;
      console.log(`[DONE] ${id}: OK (${(result.markdown||result.text||'').length} chars)`);
    } else {
      failed++;
      console.log(`[FAIL] ${id}: ${result.error || 'no content'}`);
    }
    fs.writeFileSync(outFile, JSON.stringify({ build_id: id, url, ...result }, null, 2));
    await sleep(DELAY_MS);
  }

  console.log(`\nDone! Processed: ${processed}, Failed: ${failed}`);
}

main().catch(console.error);
