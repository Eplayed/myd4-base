// ============================================================
// data-loader.js - 数据加载管理
// 每个 tab 对应一个 JSON 文件，fetch 后缓存在 allData
// ============================================================

const DATA_FILES = {
  summon:    '../data/summon_zhCN.json',
  uniqueItem:'../data/uniqueItem_zhCN.json',
  aspect:    '../data/aspect_zhCN.json',
  affix:     '../data/affix_zhCN.json',
  skill:     '../data/skills_zhCN.json',
  rune:      '../data/rune_zhCN.json',
  gem:       '../data/gem_zhCN.json',
  elixir:    '../data/elixir_zhCN.json',
  builds:    '../data/d4_builds_final_v2.json',
  simulator: '../data/skills_zhCN.json'
};

let allData    = {};   // key: tab -> array
let dataLoaded = {};   // key: tab -> bool

// 加载指定 tab 的数据，同时解析 desc 标签
function loadTabData(tab) {
  return new Promise(function(resolve, reject) {
    if (dataLoaded[tab]) { resolve(allData[tab]); return; }

    var file = DATA_FILES[tab];
    if (!file) { resolve([]); return; }

    fetch(file)
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(raw) {
        // builds 数据在 raw.builds 里（meta/builds/core_data 结构）
        var data = Array.isArray(raw) ? raw : (raw.builds || []);
        // 预处理：去除 desc[] 中的 {tag} 标签，合并为纯文本
        var processed = data.map(function(item) {
          if (Array.isArray(item.desc)) {
            item._descText = item.desc
              .map(function(line) {
                return line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '').trim();
              })
              .filter(function(t) { return t; })
              .join(' ');
          } else if (typeof item.desc === 'string') {
            item._descText = item.desc.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '').trim();
          }
          // 词缀：将 charType 英文数组 → className 中文（取第一个非 null）
          if (!item.charName && Array.isArray(item.charType)) {
            for (var ci = 0; ci < item.charType.length; ci++) {
              if (item.charType[ci] && CHAR_MAP[item.charType[ci]]) {
                item.charName = CHAR_MAP[item.charType[ci]];
                break;
              }
            }
          }
          return item;
        });

        allData[tab]    = processed;
        dataLoaded[tab] = true;
        resolve(processed);
      })
      .catch(function(e) {
        console.error('loadTabData error:', tab, e);
        reject(e);
      });
  });
}

// 获取已加载数据（同步，需先调用 loadTabData）
function getTabData(tab) {
  return allData[tab] || [];
}

// 批量预加载所有数据
function preloadAll() {
  var tabs = Object.keys(DATA_FILES);
  return Promise.all(tabs.map(function(tab) { return loadTabData(tab); }));
}
