// parse_builds_detail.js
// 解析 Firecrawl 抓取的原始 markdown，提取装备/技能数据
const fs = require('fs');
const path = require('path');

const rawDir = 'D:/project/myd4-base-data/data/builds_detail_raw';
const outFile = 'D:/project/myd4-base-data/data/builds_detail_parsed.json';

// 从 markdown 提取装备列表
function parseEquipments(md) {
  const result = {};
  // 匹配格式: [名称] 或者单独行含装备名
  // 常见模式: "虔信者之威能头盔" / "天界争斗之威能手套"
  // 在 markdown 中，装备名通常在图片 URL 附近，或者单独一行
  
  const lines = md.split('\n');
  
  // 匹配装备槽行: 包含 威能/传承/精造 等后缀 + 部位名
  // 格式如: "虔信者之威能头盔" "不屈者之威能裤子"
  const equipPatterns = [
    /^(.+?)(?:之威能|传承|精造)(头盔|胸甲|手套|裤子|靴子|护符|戒指|武器|副手|裤子)/,
    /^(.+?)之(威能|传承|精造)(.+)/,
    /^凯萨玛的(.+)/,
    /^瓦尔(.+)/,
  ];
  
  // 简单方案: 提取含装备名关键词的行
  const equipKeywords = ['威能', '传承', '精造', '之冠', '之衣', '之履', '护符', '戒指', '武器', '副手'];
  const slotMap = {
    '头盔': 'helm', '胸甲': 'chest', '裤子': 'legs', '手套': 'gloves',
    '靴子': 'boots', '护符': 'amulet', '戒指': 'ring', '武器': 'weapon', '副手': 'offhand'
  };
  
  lines.forEach(line => {
    equipKeywords.forEach(kw => {
      if (line.includes(kw) && line.length < 100) {
        // 提取装备名 (去掉URL等)
        const clean = line.replace(/!\[.*?\]\(.*?\)/g, '').trim();
        if (clean && clean.length > 2 && clean.length < 60) {
          // 识别槽位
          let slot = '';
          for (const [name, s] of Object.entries(slotMap)) {
            if (clean.includes(name)) { slot = s; break; }
          }
          if (slot) {
            result[slot] = { name: clean, raw: line };
          }
        }
      }
    });
  });
  
  return result;
}

// 从 markdown 提取技能图标 URL
function parseSkills(md) {
  const skillUrls = [];
  const regex = /cloudstorage\.d2core\.com\/data_img\/d4\/skill\/(\d+)\.png/g;
  let match;
  while ((match = regex.exec(md)) !== null) {
    skillUrls.push({ iconId: parseInt(match[1]), url: match[0] });
  }
  return skillUrls;
}

// 从 markdown 提取构筑变体
function parseVariants(md) {
  const result = [];
  // 匹配 "构筑变体" 标题后的列表项
  const sectionMatch = md.match(/构筑变体([\s\S]*?)(?=直播|$)/);
  if (sectionMatch) {
    const lines = sectionMatch[1].split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('![') && trimmed.length < 80) {
        result.push(trimmed);
      }
    });
  }
  return result;
}

// 提取技能槽布局 (1,2,3,4,L,R)
function parseSkillLayout(md) {
  // 查找 1234LR 等技能键位
  const layout = [];
  const keys = ['1','2','3','4','L','R'];
  keys.forEach(k => {
    const re = new RegExp(`(${k})\\s*\\n\\s*([\\u4e00-\\u9fa5a-zA-Z ]+)`);
    const m = md.match(re);
    if (m) {
      layout.push({ key: k, name: m[2].trim() });
    }
  });
  return layout;
}

// 主处理
function main() {
  const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} raw files`);
  
  const results = {};
  
  files.forEach(file => {
    const id = path.basename(file, '.json');
    const raw = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
    
    if (!raw.success) {
      results[id] = { build_id: id, error: raw.error || 'scrape failed', equipment: {}, skills: [], variants: [] };
      return;
    }
    
    const md = raw.markdown || raw.text || '';
    
    results[id] = {
      build_id: id,
      equipment: parseEquipments(md),
      skills: parseSkills(md),
      variants: parseVariants(md),
      skillLayout: parseSkillLayout(md),
      rawMd: md.slice(0, 500) // 保留前500字符用于调试
    };
  });
  
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Parsed ${Object.keys(results).length} builds`);
  console.log(`Output: ${outFile}`);
  
  // 统计
  let success = 0, failed = 0, withEquip = 0;
  Object.values(results).forEach(r => {
    if (r.error) failed++;
    else success++;
    if (r.equipment && Object.keys(r.equipment).length > 0) withEquip++;
  });
  console.log(`Success: ${success}, Failed: ${failed}, With Equipment: ${withEquip}`);
}

main();
