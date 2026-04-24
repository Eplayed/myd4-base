/**
 * batch_scrape_v2.js - 修复编码的抓取脚本
 * 核心：Firecrawl 返回的 markdown 里，中文是 GBK 字节被当 UTF-8 处理后的乱码
 * 修复策略：
 *   1. 解析 JSON 后，遍历字符串
 *   2. 正确 UTF-8 中文字符（\u4e00-\u9fff）保留
 *   3. 乱码字符（非中文、非ASCII、可打印ASCII外）→ Buffer → GBK → 正确中文
 *   4. 英文/ASCII/URL 保留原样
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'fc-fb921ef922284346be06b8c4d21ff3cd';
const DELAY_MS = 700;
const OUT_DIR  = 'D:/project/myd4-base-data/data/builds_detail_raw2';
const IDS_FILE = 'D:/project/myd4-base-data/data/build_ids.txt';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * 判断单个字符是否属于"有效显示字符"
 * 有效：ASCII可打印、中文字符、部分符号
 * 无效（乱码）：Latin Extended、音标等
 */
function isDisplayChar(c) {
  const code = c.codePointAt(0);
  if (code <= 0x7F) return true;                         // ASCII
  if (code >= 0x4E00 && code <= 0x9FFF) return true;     // CJK Unified Ideographs
  if (code >= 0x3000 && code <= 0x303F) return true;     // CJK Symbols
  if (code >= 0xFF00 && code <= 0xFFEF) return true;     // Fullwidth forms
  if (code === 0x2018 || code === 0x2019) return true;   // Smart quotes
  if (code >= 0x201C && code <= 0x201D) return true;
  if (code === 0x3001 || code === 0x3002) return true;  // ，。
  if (code === 0xFF01 || code === 0xFF08 || code === 0xFF09) return true; // ！？（）
  if (code >= 0x200B && code <= 0x200F) return true;    // ZWSP, ZWNJ, etc.
  if (code === 0x2022 || code === 0x2026) return true;  // • …
  if (code === 0x25CF || code === 0x2605) return true;  // ● ★
  return false;
}

/**
 * 修复字符串中的 GBK→UTF8 mojibake
 * 策略：遍历字符，收集连续乱码段 → latin-1 字节 → GBK 解码
 */
function fixMojibake(str) {
  const result = [];
  let i = 0;
  const len = [...str].length; // Account for surrogate pairs

  // Iterate by code points
  let chars = [...str];
  i = 0;
  
  while (i < chars.length) {
    const c = chars[i];
    const code = c.codePointAt(0);
    
    if (isDisplayChar(code)) {
      // Valid display char - keep as is
      result.push(c);
      i++;
    } else {
      // Start of garbled segment
      const garbled = [c];
      i++;
      // Collect consecutive garbled chars
      while (i < chars.length) {
        const c2 = chars[i];
        if (!isDisplayChar(c2.codePointAt(0))) {
          garbled.push(c2);
          i++;
        } else {
          break;
        }
      }
      
      // Convert garbled Unicode chars back to bytes (latin-1)
      // Each Unicode code point 0-255 → 1 byte
      const byteBuf = Buffer.from(garbled.map(ch => ch.codePointAt(0) & 0xFF));
      
      // Decode as GBK
      try {
        const gbk = byteBuf.toString('gbk');
        // Check if it looks like Chinese text
        const chineseCount = [...gbk].filter(ch => {
          const c2 = ch.codePointAt(0);
          return c2 >= 0x4E00 && c2 <= 0x9FFF;
        }).length;
        
        if (chineseCount >= garbled.length * 0.3) {
          result.push(gbk);
        } else {
          result.push(...garbled);
        }
      } catch (e) {
        result.push(...garbled);
      }
    }
  }
  
  return result.join('');
}

/**
 * 从 markdown 文本中提取装备数据
 */
function extractEquipment(md) {
  const equip = {};
  const lines = md.split('\n');
  
  const SLOT_PATTERNS = [
    { pat: /helm(?:et)?s?/i, slot: 'helm' },
    { pat: /chest|torso|armor/i, slot: 'chest' },
    { pat: /legs|pants|护腿/i, slot: 'legs' },
    { pat: /gloves|hands/i, slot: 'gloves' },
    { pat: /boots|feet/i, slot: 'boots' },
    { pat: /amulet|neck|护符/i, slot: 'amulet' },
    { pat: /ring/i, slot: 'ring' },
    { pat: /weapon|main.*hand/i, slot: 'weapon' },
    { pat: /offhand|shield|副手/i, slot: 'offhand' },
  ];
  
  for (const line of lines) {
    // Pattern: [ItemName](URL with slot indicator)
    // e.g. [暗影之裂隙手套](https://cloudstorage.../ItemName.png?slot=gloves)
    const m = line.match(/\[([^\]]{2,40})\]\(([^)]+)\)/);
    if (m) {
      const name = m[1].trim();
      const url = m[2].toLowerCase();
      
      // Skip if too short or looks like code
      if (name.length < 3 || name.startsWith('!') || name.startsWith('http')) continue;
      
      // Determine slot from URL
      for (const { pat, slot } of SLOT_PATTERNS) {
        if (pat.test(url) && !equip[slot]) {
          // Also check if name has the right keyword
          if (/威能|传承|精造|威能|傳承/.test(name) || true) {
            equip[slot] = name;
          }
        }
      }
    }
  }
  
  return equip;
}

/**
 * 发送 Firecrawl API 请求，返回原始 buffer
 */
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
      r.on('data', c => { chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); });
      r.on('end', () => {
        const buf = Buffer.concat(chunks);
        let jsonStr;
        let fixedMd = '';
        let wasFixed = false;
        
        try {
          // Step 1: Parse as UTF-8 JSON (standard)
          jsonStr = buf.toString('utf8');
          const obj = JSON.parse(jsonStr);
          const mdRaw = obj?.data?.markdown || '';
          
          // Step 2: Fix encoding in markdown
          const mdFixed = fixMojibake(mdRaw);
          wasFixed = mdFixed !== mdRaw;
          fixedMd = mdFixed;
          
          res({ 
            status: r.statusCode, 
            json: obj, 
            markdown: mdFixed,
            markdownRaw: mdRaw,
            wasFixed,
            equip: extractEquipment(mdFixed)
          });
        } catch (e) {
          res({ status: r.statusCode, error: e.message, markdown: '' });
        }
      });
    });
    req.on('error', rej);
    req.setTimeout(90000, () => { req.destroy(); rej(new Error('timeout')); });
    if (body) req.write(data);
    req.end();
  });
}

async function scrapeOne(id, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await apiReq('/v1/scrape', 'POST', {
        url: 'https://www.d2core.com/d4/planner?bd=' + id,
        formats: ['markdown'],
        waitFor: 14000
      });
      
      if (resp.status === 200 && resp.markdown && resp.markdown.length > 50) {
        return { 
          success: true, 
          markdown: resp.markdown, 
          wasFixed: resp.wasFixed,
          equip: resp.equip
        };
      } else if ([408, 504, 500, 429].includes(resp.status)) {
        if (attempt < retries - 1) { await sleep(12000); continue; }
        return { success: false, error: 'HTTP ' + resp.status };
      } else {
        if (attempt < retries - 1) { await sleep(5000); continue; }
        return { success: false, error: 'HTTP ' + resp.status + ' or empty' };
      }
    } catch (e) {
      if (attempt < retries - 1) { await sleep(6000); continue; }
      return { success: false, error: e.message };
    }
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  
  // Load build IDs
  let ids;
  try {
    ids = fs.readFileSync(IDS_FILE, 'utf8').trim().split('\n').filter(Boolean);
  } catch (e) {
    ids = fs.readFileSync(path.join(__dirname, 'data', 'build_ids.txt'), 'utf8')
      .trim().split('\n').filter(Boolean);
  }
  
  console.log('Total builds:', ids.length);
  console.log('Output dir:', OUT_DIR);
  console.log('');

  let done = 0, failed = 0, fixed = 0;
  
  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx];
    const outFile = path.join(OUT_DIR, id + '.json');
    
    // Check if already processed
    if (fs.existsSync(outFile)) {
      try {
        const raw = fs.readFileSync(outFile, 'utf8');
        const obj = JSON.parse(raw);
        if (obj.success && obj.markdown && obj.markdown.length > 50) {
          const chineseCount = [...obj.markdown].filter(c => c.codePointAt(0) >= 0x4E00 && c.codePointAt(0) <= 0x9FFF).length;
          if (chineseCount > 20) {
            console.log(`[${idx+1}/${ids.length}] SKIP ${id} (${chineseCount} Chinese chars)`);
            await sleep(DELAY_MS);
            continue;
          }
        }
      } catch (e) { /* re-scrape */ }
    }
    
    process.stdout.write(`[${idx+1}/${ids.length}] SCRAPE ${id}... `);
    const result = await scrapeOne(id);
    
    if (result.success) {
      done++;
      if (result.wasFixed) fixed++;
      console.log(`OK (${result.markdown.length} chars, fixed=${result.wasFixed}, equip=${Object.keys(result.equip||{}).length})`);
    } else {
      failed++;
      console.log(`FAIL: ${result.error}`);
    }
    
    fs.writeFileSync(outFile, JSON.stringify({
      build_id: id,
      url: 'https://www.d2core.com/d4/planner?bd=' + id,
      success: result.success,
      markdown: result.success ? result.markdown : '',
      wasFixed: result.wasFixed || false,
      equipment: result.equip || {},
      error: result.error
    }, null, 2), 'utf8');
    
    await sleep(DELAY_MS);
  }
  
  console.log(`\nDone! Done: ${done}, Fixed: ${fixed}, Failed: ${failed}`);
}

main().catch(console.error);
