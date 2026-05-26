const fs = require('fs');
const path = require('path');
const { ROOT } = require('../config');

const CACHE_DIR = path.join(ROOT, 'cache', 'olden-era-pages');
const CACHE_TTL_MS = Number(process.env.PAGE_CACHE_TTL_MS || 24 * 60 * 60 * 1000);

function cachePathForUrl(url) {
  const key = Buffer.from(url).toString('base64url');
  return path.join(CACHE_DIR, `${key}.html`);
}

function readCache(url) {
  const filePath = cachePathForUrl(url);
  if (!fs.existsSync(filePath)) return '';
  const stat = fs.statSync(filePath);
  if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function writeCache(url, html) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePathForUrl(url), html);
}

async function fetchText(url, retries = 2) {
  const cached = readCache(url);
  if (cached) return cached;

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 heros-base data crawler',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      writeCache(url, html);
      return html;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

module.exports = { fetchText };
