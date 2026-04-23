// patch_builds.js - 修改 app.js，支持 builds tab 数据合并
const fs = require('fs');
const path = 'D:/project/myd4-base-data/viewer/js/app.js';
let content = fs.readFileSync(path, 'utf8');

// 替换最后的通用 tab 处理，加入 builds 特殊分支
const oldBlock = `  // 加载数据 → 刷新筛选 → 渲染
  loadTabData(tab).then(function(data) {
    initFiltersForTab(tab, data);
    refreshFilterValues(tab, data);
    applyCurrentFilters(tab);
  }).catch(function(e) {
    var grid = document.getElementById('grid');
    if (grid) grid.innerHTML = '<div class="empty">加载失败: ' + e.message + '</div>';
  });
}`;

const newBlock = `  // builds tab：合并装备细节
  if (tab === 'builds') {
    loadTabData(tab).then(function(data) {
      return fetch('../data/builds_detail_parsed.json')
        .then(function(r) { return r.ok ? r.json() : {}; })
        .catch(function() { return {}; })
        .then(function(detailMap) {
          if (detailMap && typeof detailMap === 'object' && !Array.isArray(detailMap)) {
            data.forEach(function(build) {
              var detail = detailMap[build.build_id];
              if (detail) {
                build._equipment = detail.equipment || {};
                build._skillIcons = detail.skillIcons || [];
              }
            });
          }
          initFiltersForTab(tab, data);
          refreshFilterValues(tab, data);
          applyCurrentFilters(tab);
        });
    }).catch(function(e) {
      var grid = document.getElementById('grid');
      if (grid) grid.innerHTML = '<div class="empty">加载失败: ' + e.message + '</div>';
    });
    return;
  }

  // 其他 tab 通用处理
  loadTabData(tab).then(function(data) {
    initFiltersForTab(tab, data);
    refreshFilterValues(tab, data);
    applyCurrentFilters(tab);
  }).catch(function(e) {
    var grid = document.getElementById('grid');
    if (grid) grid.innerHTML = '<div class="empty">加载失败: ' + e.message + '</div>';
  });
}`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Patched app.js: builds tab merge logic added');
} else {
  console.log('ERROR: could not find target block');
  console.log('Looking for:', JSON.stringify(oldBlock.slice(0, 100)));
  // 打印相关区域
  const idx = content.indexOf('加载数据 → 刷新筛选');
  if (idx > -1) console.log('Found at idx', idx, ':', JSON.stringify(content.slice(idx, idx+200)));
}
