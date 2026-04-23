const https = require('https');

const API_KEY = 'fc-fb921ef922284346be06b8c4d21ff3cd';
const BUILD_ID = '1P0u';

function apiReq(path, method, body) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'api.firecrawl.dev', port: 443, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    }, r => {
      const chunks = [];
      r.on('data', c => {
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      });
      r.on('end', () => {
        const buf = Buffer.concat(chunks);
        const u8 = buf.toString('utf8');
        const gk = buf.toString('gbk');
        console.log('=== Encoding test for', BUILD_ID, '===');
        console.log('Response status:', r.statusCode);
        console.log('UTF-8[:300]:', u8.slice(0, 300).replace(/\n/g, ' '));
        console.log('GBK[:300]:', gk.slice(0, 300).replace(/\n/g, ' '));
        res({ status: r.statusCode, buf });
      });
    });
    req.on('error', e => {
      console.log('Request error:', e.message);
      rej(e);
    });
    req.setTimeout(30000, () => {
      console.log('Request timeout');
      req.destroy();
      rej(new Error('timeout'));
    });
    if (body) req.write(data);
    req.end();
  });
}

async function test() {
  try {
    await apiReq('/v1/scrape', 'POST', {
      url: 'https://www.d2core.com/d4/planner?bd=' + BUILD_ID,
      formats: ['markdown'],
      waitFor: 8000
    });
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
