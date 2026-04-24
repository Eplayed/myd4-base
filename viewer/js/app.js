
// ============================================================
// app.js - 主应用：Tab 切换、卡片渲染、Modal
// ============================================================

var currentTab = 'summon';

// ----- Tab Bar -----
function buildTabBar() {
  var bar = document.getElementById('tabBar');
  var html = '';
  Object.keys(TAB_CONFIGS).forEach(function(key) {
    var cfg = TAB_CONFIGS[key];
    var active = key === currentTab ? ' active' : '';
    var dotColor = getTabColor(key);
    html += '<div class="tab-item' + active + '" data-tab="' + key + '">' +
      '<span class="tab-dot" style="color:' + dotColor + '"></span>' +
      cfg.label +
      '</div>';
  });
  bar.innerHTML = html;

  // 事件
  bar.querySelectorAll('.tab-item').forEach(function(el) {
    el.addEventListener('click', function() {
      document.querySelector('.tab-item.active').classList.remove('active');
      el.classList.add('active');
      currentTab = el.dataset.tab;
      onTabChange(currentTab);
    });
  });
}

function getTabColor(tab) {
  var map = {
    summon:'#e74c3c', uniqueItem:'#f39c12', aspect:'#9b59b6',
    affix:'#a29bfe', skill:'#3498db', gem:'#1abc9c',
    rune:'#e67e22', elixir:'#2ecc71', builds:'#e91e63',
    simulator:'#ffd700'
  };
  return map[tab] || '#8a8a9a';
}

// ----- Tab 切换 -----
function onTabChange(tab) {
  // 更新 stats bar
  var statsEl = document.getElementById('tbStats');
  if (statsEl) statsEl.textContent = '加载中…';

  // 模拟器 tab 特殊处理
  if (tab === 'simulator') {
    document.getElementById('toolbar').style.display = 'none';
    document.getElementById('empty').style.display = 'none';
    document.getElementById('grid').style.display = 'none';
    var simEl = document.getElementById('simulatorPanel');
    if (simEl) simEl.style.display = '';
    if (statsEl) statsEl.textContent = '';
    // 加载技能数据
    loadTabData('skill').then(function(skillData) {
      // 加载 uniqueItem 数据（装备 tooltip）
      return loadTabData('uniqueItem').then(function(uniqueData) {
        return { skillData: skillData, uniqueData: uniqueData };
      }).catch(function() { return { skillData: skillData, uniqueData: [] }; });
    }).then(function(result) {
      // 加载符文数据
      return loadTabData('rune').then(function(runeData) {
        result.runeData = runeData || [];
        return result;
      }).catch(function() { result.runeData = []; return result; });
    }).then(function(result) {
      // 加载药剂数据
      return loadTabData('elixir').then(function(elixirData) {
        result.elixirData = elixirData || [];
        return result;
      }).catch(function() { result.elixirData = []; return result; });
    }).then(function(result) {
      // 初始化 P0 模拟器
      if (typeof initSimulatorP0 === 'function') {
        simP0LoadEquipData(result.uniqueData || []);
        simP0LoadRuneData(result.runeData || []);
        simP0LoadElixirData(result.elixirData || []);
        var opts = {};
        // 如果是从构筑卡片跳转过来的，自动加载 pendingBuild
        if (window.SimStateP0 && window.SimStateP0.pendingBuild) {
          opts.build = window.SimStateP0.pendingBuild.build;
          opts.detail = window.SimStateP0.pendingBuild.detail;
          window.SimStateP0.pendingBuild = null;
        }
        initSimulatorP0(result.skillData || [], opts);
      }
    });
    return;
  } else {
    document.getElementById('toolbar').style.display = '';
    document.getElementById('grid').style.display = '';
    var simEl = document.getElementById('simulatorPanel');
    if (simEl) simEl.style.display = 'none';
  }

  // builds tab：合并装备细节
  if (tab === 'builds') {
    loadTabData(tab).then(function(data) {
      return fetch('data/builds_detail_parsed_fixed.json')
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
          window.ALL_BUILDS = data;
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
}
function renderGrid(tab, data) {
  var grid = document.getElementById('grid');
  var statsEl = document.getElementById('tbStats');

  if (statsEl) statsEl.textContent = '共 ' + data.length + ' 条';

  if (!data || data.length === 0) {
    grid.innerHTML = '<div class="empty">暂无数据</div>';
    return;
  }

  // 词缀用专用列表布局（参考 d2core）
  if (tab === 'affix') {
    renderAffixList(data);
    return;
  }

  // builds tab：用专用卡片
  if (tab === 'builds') {
    grid.innerHTML = data.map(function(item, i) { return buildBuildCard(item, i); }).join('');
    grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    grid.querySelectorAll('.build-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var buildId = card.dataset.id;
        if (buildId) openBuildDetail(buildId);
      });
    });
  } else {
    grid.innerHTML = data.map(function(item, i) { return buildCard(tab, item, i); }).join('');
    grid.style.gridTemplateColumns = '';

    // 通用卡片点击 → modal
    grid.querySelectorAll('.d4-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var idx = parseInt(card.dataset.idx, 10);
        showModal(tab, data[idx]);
      });
    });
  }
}

// ----- 词缀专用列表布局（参考 d2core 左右分栏 + 分组折叠） -----
function renderAffixList(data) {
  var grid = document.getElementById('grid');

  // 分离普通词缀和回火词缀
  var normal = data.filter(function(item) { return !item.tempered; });
  var tempered = data.filter(function(item) { return item.tempered; });

  // 按 key 前缀分组
  var normalGroups = groupAffixes(normal);
  var temperedGroups = groupAffixes(tempered);

  var html = '<div class="affix-layout">';

  // 左栏 — 普通词缀
  html += '<div class="affix-panel">' +
    '<div class="affix-panel-header"><span class="affix-panel-title">普通</span></div>' +
    '<div class="affix-header-row">' +
      '<span class="affix-col-toggle"></span>' +
      '<span class="affix-col-name">词缀</span>' +
      '<span class="affix-col-desc">属性</span>' +
    '</div>' +
    '<div class="affix-list">' +
      normalGroups.map(function(g, i) { return buildAffixGroup(g, i, 'normal'); }).join('') +
    '</div></div>';

  // 右栏 — 回火词缀
  html += '<div class="affix-panel">' +
    '<div class="affix-panel-header"><span class="affix-panel-title" style="color:#e67e22">回火</span></div>' +
    '<div class="affix-header-row">' +
      '<span class="affix-col-toggle"></span>' +
      '<span class="affix-col-name">词缀</span>' +
      '<span class="affix-col-desc">属性</span>' +
    '</div>' +
    '<div class="affix-list">' +
      temperedGroups.map(function(g, i) { return buildAffixGroup(g, i, 'tempered'); }).join('') +
    '</div></div>';

  html += '</div>';
  grid.innerHTML = html;

  // 绑定点击事件
  grid.querySelectorAll('.affix-group-main').forEach(function(row) {
    row.addEventListener('click', function() {
      var group = this.closest('.affix-group');
      group.classList.toggle('expanded');
    });
  });
}

// 词缀分组函数
function groupAffixes(items) {
  var groups = {};
  items.forEach(function(item) {
    var key = item.key || '';
    var baseKey = key;
    while (true) {
      var parts = baseKey.split('_');
      if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
        baseKey = parts.slice(0, -1).join('_');
      } else {
        break;
      }
    }
    if (!groups[baseKey]) groups[baseKey] = [];
    groups[baseKey].push(item);
  });
  // 转换为数组
  return Object.keys(groups).map(function(k) { return { key: k, items: groups[k] }; });
}

// 构建词缀组
function buildAffixGroup(group, index, type) {
  // 取第一个词缀作为主行
  var first = group.items[0];
  var name = first.prefix || first.suffix || first.groupName || group.key || '';
  var desc = (typeof first.desc === 'string') ? first.desc : '';
  desc = desc.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '');
  desc = parseColoredDesc(escHtml(desc));

  // 子列表
  var subRows = group.items.slice(1).map(function(item) {
    var subDesc = (typeof item.desc === 'string') ? item.desc : '';
    subDesc = subDesc.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '');
    subDesc = parseColoredDesc(escHtml(subDesc));
    var equipTypes = (item.itemType || []).map(function(t) { return ITEM_TYPE_MAP[t] || t; }).join(', ');
    return '<div class="affix-row affix-row--sub">' +
      '<span class="affix-col-toggle affix-col-toggle--sub"></span>' +
      '<span class="affix-col-desc affix-col-desc--sub"><span class="database-line">' + subDesc + '</span>' +
      (equipTypes ? '<span class="affix-equip">' + escHtml(equipTypes) + '</span>' : '') +
      '</span>' +
      '</div>';
  }).join('');

  // 最后加装备类型（从第一个词缀取）
  var equipTypes = (first.itemType || []).map(function(t) { return ITEM_TYPE_MAP[t] || t; }).join(', ');
  if (equipTypes) {
    subRows += '<div class="affix-row affix-row--sub affix-row--equip">' +
      '<span class="affix-col-toggle affix-col-toggle--sub"></span>' +
      '<span class="affix-equip">' + escHtml(equipTypes) + '</span>' +
      '</div>';
  }

  var cls = (type === 'tempered') ? ' affix-group--tempered' : '';

  return '<div class="affix-group' + cls + '" data-group-index="' + index + '">' +
    '<div class="affix-group-main affix-row affix-row--main">' +
      '<span class="affix-col-toggle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></span>' +
      '<span class="affix-col-name"><span class="affix-name-text">' + escHtml(name) + '</span></span>' +
      '<span class="affix-col-desc"><span class="database-line">' + desc + '</span></span>' +
    '</div>' +
    '<div class="affix-sub-list">' + subRows + '</div>' +
    '</div>';
}

// ----- 构造卡片 HTML -----
function buildCard(tab, item, idx) {
  var color   = getCardAccentColor(tab, item);
  var iconUrl = getItemImageUrl(item.icon, tab, item.key);
  var badges  = buildBadges(tab, item);
  var desc    = buildCardDesc(tab, item);
  var flavor  = item.flavor ? parseFlavor(item.flavor) : '';

  return '<div class="d4-card" data-idx="' + idx + '" style="--card-accent:' + color + '">' +
    '<div class="d4-card__header">' +
      '<div class="d4-card__icon-wrap">' +
        (iconUrl ? '<img class="d4-card__icon" src="' + iconUrl + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
      '</div>' +
      '<div class="d4-card__title-row">' +
        '<div class="d4-card__title" style="color:' + color + '">' + escHtml(item.name || '') + '</div>' +
        (item.subtitle ? '<div class="d4-card__subtitle">' + escHtml(item.subtitle) + '</div>' : '') +
      '</div>' +
    '</div>' +
    (badges ? '<div class="d4-card__badges">' + badges + '</div>' : '') +
    '<div class="d4-card__divider"></div>' +
    (desc ? '<div class="d4-card__desc">' + desc + '</div>' : '') +
    (flavor ? '<div class="d4-card__flavor">' + flavor + '</div>' : '') +
    '</div>';
}

function getCardAccentColor(tab, item) {
  var colors = {
    summon:'#e74c3c', uniqueItem:'#f39c12', aspect:'#9b59b6',
    skill:'#3498db', gem:'#1abc9c', rune:'#e67e22',
    elixir:'#2ecc71', builds:'#e91e63', affix:'#a29bfe'
  };
  // uniqueItem: 职业颜色优先
  if (tab === 'uniqueItem' && item.charName && CHAR_COLOR[item.charName]) {
    return CHAR_COLOR[item.charName];
  }
  return colors[tab] || '#8a8a9a';
}

function buildBadges(tab, item) {
  var badges = [];

  if (tab === 'uniqueItem') {
    if (item.equipTypeName) badges.push('<span class="badge-item type">' + escHtml(item.equipTypeName) + '</span>');
    if (item.charName)     badges.push('<span class="badge-item class">' + escHtml(item.charName) + '</span>');
    if (item.isMythic)     badges.push('<span class="badge-item mythic">神话</span>');
    if (item.armor)       badges.push('<span class="badge-item">' + escHtml(item.armor) + '</span>');
  }
  else if (tab === 'aspect') {
    if (item.source === 'Codex')      badges.push('<span class="badge-item source">能量法典</span>');
    else if (item.source === 'Legendary') badges.push('<span class="badge-item source">传奇威能</span>');
    if (item.charName) badges.push('<span class="badge-item class">' + escHtml(item.charName) + '</span>');
    if (item.type)     badges.push('<span class="badge-item tag">' + escHtml(item.type) + '</span>');
  }
  else if (tab === 'skill') {
    if (item.charName) badges.push('<span class="badge-item class">' + escHtml(item.charName) + '</span>');
    if (item.tags && item.tags.length) {
      item.tags.slice(0, 3).forEach(function(tag) {
        badges.push('<span class="badge-item tag">' + escHtml(tag) + '</span>');
      });
    }
  }
  else if (tab === 'rune') {
    if (item.charName) badges.push('<span class="badge-item class">' + escHtml(item.charName) + '</span>');
    if (item.type)     badges.push('<span class="badge-item type">' + escHtml(item.type) + '</span>');
  }
  else if (tab === 'affix') {
    if (item.tempered)     badges.push('<span class="badge-item source">回火</span>');
    else                  badges.push('<span class="badge-item source">普通</span>');
    if (item.charName)    badges.push('<span class="badge-item class">' + escHtml(item.charName) + '</span>');
    if (item.groupName)   badges.push('<span class="badge-item tag">' + escHtml(item.groupName) + '</span>');
  }
  else if (tab === 'gem') {
    if (item.quality) badges.push('<span class="badge-item">' + escHtml(item.quality) + '</span>');
  }
  else if (tab === 'builds') {
    if (item.className) badges.push('<span class="badge-item class">' + escHtml(item.className) + '</span>');
    if (item.charName)  badges.push('<span class="badge-item class">' + escHtml(item.charName) + '</span>');
  }

  return badges.join('');
}

function buildCardDesc(tab, item) {
  var text = '';

  if (tab === 'uniqueItem') {
    text = item._descText || parseDescText(item.desc || []);
    if (item.affixesDesc && item.affixesDesc.length) {
      text = item.affixesDesc.slice(0, 2).map(function(a) {
        return a.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '');
      }).join(' ');
    }
  }
  else if (tab === 'aspect') {
    text = (item.affixesDesc || '').replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '').slice(0, 120);
  }
  else if (tab === 'affix') {
    // affix.desc 是 string，不是 array
    text = typeof item.desc === 'string' ? item.desc.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '') : '';
  }
  else if (tab === 'gem') {
    // gem 用 affixesDesc 数组（武器/防具/首饰三行）
    if (Array.isArray(item.affixesDesc)) {
      text = item.affixesDesc.slice(0, 2).map(function(a) {
        return a.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '');
      }).join(' | ');
    }
  }
  else if (tab === 'rune') {
    if (Array.isArray(item.affixesDesc)) {
      text = item.affixesDesc.map(function(a) {
        return (a.line || a).replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '');
      }).join(' ');
    }
  }
  else if (tab === 'skill') {
    text = parseDescText(item.desc || []).slice(0, 150);
  }
  else if (tab === 'summon') {
    text = item._descText || parseDescText(item.desc || []);
  }
  else {
    text = item._descText || parseDescText(item.desc || []);
  }

  return parseColoredDesc(escHtml(text));
}

function parseFlavor(flavorStr) {
  if (!flavorStr) return '';
  return flavorStr.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '').trim();
}

// ----- Modal -----
function showModal(tab, item) {
  var modal   = document.getElementById('modal');
  var body    = document.getElementById('modalBody');
  var color   = getCardAccentColor(tab, item);
  var iconUrl = getItemImageUrl(item.icon, tab, item.key);
  var badges  = buildBadges(tab, item);
  var descLines = buildModalDescLines(tab, item);

  body.innerHTML =
    '<div class="modal-close" onclick="closeModal()">×</div>' +
    '<div class="modal-header">' +
      (iconUrl ? '<div class="modal-icon-wrap">' +
        '<img src="' + iconUrl + '" alt="" onerror="this.parentElement.style.background=\'rgba(255,255,255,0.04)\'">' +
      '</div>' : '') +
      '<div class="modal-title-block">' +
        '<div class="modal-title" style="color:' + color + '">' + escHtml(item.name || '') + '</div>' +
        (item.subtitle ? '<div class="modal-subtitle">' + escHtml(item.subtitle) + '</div>' : '') +
        (badges ? '<div class="modal-badges">' + badges + '</div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="modal-body">' +
      (descLines ? '<div class="modal-section"><div class="modal-section-title">效果</div>' + descLines + '</div>' : '') +
    '</div>' +
    (item.flavor ? '<div class="modal-flavor">' + parseColoredDesc(escHtml(parseFlavor(item.flavor))) + '</div>' : '');

  modal.classList.add('active');
}

function buildModalDescLines(tab, item) {
  if (tab === 'uniqueItem') {
    var lines = (item.affixesDesc || []).map(function(affix) {
      return '<div class="modal-desc-line">' + parseColoredDesc(escHtml(affix.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, ''))) + '</div>';
    });
    if (item.armor) lines.unshift('<div class="modal-desc-line">' + escHtml(item.armor) + '</div>');
    return lines.join('');
  }
  if (tab === 'aspect') {
    return (item.affixesDesc || '').split('\n').map(function(line) {
      return '<div class="modal-desc-line">' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, ''))) + '</div>';
    }).join('');
  }
  if (tab === 'affix') {
    // affix.desc 是 string
    var affixDesc = typeof item.desc === 'string' ? item.desc : '';
    return '<div class="modal-desc-line">' + parseColoredDesc(escHtml(affixDesc.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, ''))) + '</div>';
  }
  if (tab === 'gem') {
    return (item.affixesDesc || []).map(function(line) {
      return '<div class="modal-desc-line">' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, ''))) + '</div>';
    }).join('');
  }
  if (tab === 'rune') {
    return (item.affixesDesc || []).map(function(a) {
      var line = (a.line || a);
      return '<div class="modal-desc-line">' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, ''))) + '</div>';
    }).join('');
  }
  if (tab === 'elixir') {
    return (item.desc || '').split('\n').map(function(line) {
      return '<div class="modal-desc-line">' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, ''))) + '</div>';
    }).join('');
  }
  if (tab === 'skill') {
    return (item.desc || []).map(function(line) {
      return '<div class="modal-desc-line">' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, ''))) + '</div>';
    }).join('');
  }
  if (tab === 'summon') {
    return (item.desc || []).map(function(line) {
      return '<div class="modal-desc-line">' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, ''))) + '</div>';
    }).join('');
  }
  return '';
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

// 点击背景关闭
document.addEventListener('click', function(e) {
  var modal = document.getElementById('modal');
  if (e.target === modal) closeModal();
});

// ----- HTML 转义 -----
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '&quot;');
}

// ----- 启动 -----
(function init() {
  buildTabBar();
  onTabChange(currentTab);
})();
