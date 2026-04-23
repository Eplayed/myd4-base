const fs = require('fs');
const path = require('path');

const slotMap = {'头盔':'helm','胸甲':'chest','裤子':'legs','legs':'legs','手套':'gloves','靴子':'boots','护符':'amulet','戒指':'ring','武器':'weapon','副手':'offhand'};

const rawDir = 'D:/project/myd4-base-data/data/builds_detail_raw';
const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.json'));
console.log('Found', files.length, 'raw files');

const results = {};
let withEquip = 0;

for (const file of files) {
  const id = path.basename(file, '.json');
  const d = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
  const md = d.markdown || '';

  const lines = md.split('\n');
  const equipment = {};

  lines.forEach(line => {
    const clean = line.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    if (!clean || clean.length < 3 || clean.length > 70) return;
    for (const [kw, slot] of Object.entries(slotMap)) {
      if (clean.includes(kw)) {
        if (!equipment[slot]) equipment[slot] = clean;
        break;
      }
    }
  });

  const skillIcons = [];
  const re = /cloudstorage\.d2core\.com\/data_img\/d4\/skill\/(\d+)\.png/g;
  let m;
  while ((m = re.exec(md)) !== null) skillIcons.push(parseInt(m[1]));

  if (Object.keys(equipment).length > 0) withEquip++;
  results[id] = { build_id: id, equipment, skillIcons: [...new Set(skillIcons)], chars: md.length };
}

const outFile = 'D:/project/myd4-base-data/data/builds_detail_parsed.json';
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log('Done. With equipment:', withEquip, '/', files.length);

const first = Object.values(results)[0];
if (first) console.log('Sample:', JSON.stringify(first));
