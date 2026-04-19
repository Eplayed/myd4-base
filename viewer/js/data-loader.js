// ============================================================
// data-loader.js - 数据加载管理
// 每个 tab 对应一个 JSON 文件，fetch 后缓存在 allData
// ============================================================

const DATA_FILES = {
  summon:    'data/summon_zhCN.json',
  uniqueItem:'data/uniqueItem_zhCN.json',
  aspect:    'data/aspect_zhCN.json',
  affix:     'data/affix_zhCN.json',
  skill:     'data/skills_zhCN.json',
  rune:      'data/rune_zhCN.json',
  gem:       'data/gem_zhCN.json',
  elixir:    'data/elixir_zhCN.json',
  builds:    'builds_data.json'
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
      .then(function(data) {
        // 预处理：去除 desc[] 中的 {tag} 标签，合并为纯文本
        var processed = data.map(function(item) {
          if (Array.isArray(item.desc)) {
            item._descText = item.desc
              .map(function(line) {
                return line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '').trim();
              })
              .filter(function(t) { return t; })
              .join(' ');
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
