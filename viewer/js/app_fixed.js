
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
    html += '&lt;div class="tab-item' + active + '" data-tab="' + key + '"&gt;' +
      '&lt;span class="tab-dot" style="color:' + dotColor + '"&gt;&lt;/span&gt;' +
      cfg.label +
      '&lt;/div&gt;';
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
    rune:'#e67e22', elixir:'#2ecc71', builds:'#e91e63'
  };
  return map[tab] || '#8a8a9a';
}

// ----- Tab 切换 -----
function onTabChange(tab) {
  // 更新 stats bar
  var statsEl = document.getElementById('tbStats');
  if (statsEl) statsEl.textContent = '加载中…';

  // 加载数据 → 刷新筛选 → 渲染
  loadTabData(tab).then(function(data) {
    initFiltersForTab(tab, data);
    refreshFilterValues(tab, data);
    applyCurrentFilters(tab);
  }).catch(function(e) {
    var grid = document.getElementById('grid');
    if (grid) grid.innerHTML = '&lt;div class="empty"&gt;加载失败: ' + e.message + '&lt;/div&gt;';
  });
}

// ----- 渲染 Grid -----
function renderGrid(tab, data) {
  var grid = document.getElementById('grid');
  var statsEl = document.getElementById('tbStats');

  if (statsEl) statsEl.textContent = '共 ' + data.length + ' 条';

  if (!data || data.length === 0) {
    grid.innerHTML = '&lt;div class="empty"&gt;暂无数据&lt;/div&gt;';
    return;
  }

  // 词缀用专用列表布局（参考 d2core）
  if (tab === 'affix') {
    renderAffixList(data);
    return;
  }

  grid.innerHTML = data.map(function(item, i) { return buildCard(tab, item, i); }).join('');

  // 卡片点击 → modal
  grid.querySelectorAll('.d4-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var idx = parseInt(card.dataset.idx, 10);
      showModal(tab, data[idx]);
    });
  });
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

  var html = '&lt;div class="affix-layout"&gt;';

  // 左栏 — 普通词缀
  html += '&lt;div class="affix-panel"&gt;' +
    '&lt;div class="affix-panel-header"&gt;&lt;span class="affix-panel-title"&gt;普通&lt;/span&gt;&lt;/div&gt;' +
    '&lt;div class="affix-header-row"&gt;' +
      '&lt;span class="affix-col-toggle"&gt;&lt;/span&gt;' +
      '&lt;span class="affix-col-name"&gt;词缀&lt;/span&gt;' +
      '&lt;span class="affix-col-desc"&gt;属性&lt;/span&gt;' +
    '&lt;/div&gt;' +
    '&lt;div class="affix-list"&gt;' +
      normalGroups.map(function(g, i) { return buildAffixGroup(g, i, 'normal'); }).join('') +
    '&lt;/div&gt;&lt;/div&gt;';

  // 右栏 — 回火词缀
  html += '&lt;div class="affix-panel"&gt;' +
    '&lt;div class="affix-panel-header"&gt;&lt;span class="affix-panel-title" style="color:#e67e22"&gt;回火&lt;/span&gt;&lt;/div&gt;' +
    '&lt;div class="affix-header-row"&gt;' +
      '&lt;span class="affix-col-toggle"&gt;&lt;/span&gt;' +
      '&lt;span class="affix-col-name"&gt;词缀&lt;/span&gt;' +
      '&lt;span class="affix-col-desc"&gt;属性&lt;/span&gt;' +
    '&lt;/div&gt;' +
    '&lt;div class="affix-list"&gt;' +
      temperedGroups.map(function(g, i) { return buildAffixGroup(g, i, 'tempered'); }).join('') +
    '&lt;/div&gt;&lt;/div&gt;';

  html += '&lt;/div&gt;';
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
  desc = desc.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, '');
  desc = parseColoredDesc(escHtml(desc));

  // 子列表
  var subRows = group.items.slice(1).map(function(item) {
    var subDesc = (typeof item.desc === 'string') ? item.desc : '';
    subDesc = subDesc.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, '');
    subDesc = parseColoredDesc(escHtml(subDesc));
    var equipTypes = (item.itemType || []).map(function(t) { return ITEM_TYPE_MAP[t] || t; }).join(', ');
    return '&lt;div class="affix-row affix-row--sub"&gt;' +
      '&lt;span class="affix-col-toggle affix-col-toggle--sub"&gt;&lt;/span&gt;' +
      '&lt;span class="affix-col-desc affix-col-desc--sub"&gt;&lt;span class="database-line"&gt;' + subDesc + '&lt;/span&gt;' +
      (equipTypes ? '&lt;span class="affix-equip"&gt;' + escHtml(equipTypes) + '&lt;/span&gt;' : '') +
      '&lt;/span&gt;' +
      '&lt;/div&gt;';
  }).join('');

  // 最后加装备类型（从第一个词缀取）
  var equipTypes = (first.itemType || []).map(function(t) { return ITEM_TYPE_MAP[t] || t; }).join(', ');
  if (equipTypes) {
    subRows += '&lt;div class="affix-row affix-row--sub affix-row--equip"&gt;' +
      '&lt;span class="affix-col-toggle affix-col-toggle--sub"&gt;&lt;/span&gt;' +
      '&lt;span class="affix-equip"&gt;' + escHtml(equipTypes) + '&lt;/span&gt;' +
      '&lt;/div&gt;';
  }

  var cls = (type === 'tempered') ? ' affix-group--tempered' : '';

  return '&lt;div class="affix-group' + cls + '" data-group-index="' + index + '"&gt;' +
    '&lt;div class="affix-group-main affix-row affix-row--main"&gt;' +
      '&lt;span class="affix-col-toggle"&gt;&lt;svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"&gt;&lt;path d="m9 18 6-6-6-6"/&gt;&lt;/svg&gt;&lt;/span&gt;' +
      '&lt;span class="affix-col-name"&gt;&lt;span class="affix-name-text"&gt;' + escHtml(name) + '&lt;/span&gt;&lt;/span&gt;' +
      '&lt;span class="affix-col-desc"&gt;&lt;span class="database-line"&gt;' + desc + '&lt;/span&gt;&lt;/span&gt;' +
    '&lt;/div&gt;' +
    '&lt;div class="affix-sub-list"&gt;' + subRows + '&lt;/div&gt;' +
    '&lt;/div&gt;';
}

// ----- 构造卡片 HTML -----
function buildCard(tab, item, idx) {
  var color   = getCardAccentColor(tab, item);
  var iconUrl = getItemImageUrl(item.icon, tab, item.key);
  var badges  = buildBadges(tab, item);
  var desc    = buildCardDesc(tab, item);
  var flavor  = item.flavor ? parseFlavor(item.flavor) : '';

  return '&lt;div class="d4-card" data-idx="' + idx + '" style="--card-accent:' + color + '"&gt;' +
    '&lt;div class="d4-card__header"&gt;' +
      '&lt;div class="d4-card__icon-wrap"&gt;' +
        (iconUrl ? '&lt;img class="d4-card__icon" src="' + iconUrl + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"&gt;' : '') +
      '&lt;/div&gt;' +
      '&lt;div class="d4-card__title-row"&gt;' +
        '&lt;div class="d4-card__title" style="color:' + color + '"&gt;' + escHtml(item.name || '') + '&lt;/div&gt;' +
        (item.subtitle ? '&lt;div class="d4-card__subtitle"&gt;' + escHtml(item.subtitle) + '&lt;/div&gt;' : '') +
      '&lt;/div&gt;' +
    '&lt;/div&gt;' +
    (badges ? '&lt;div class="d4-card__badges"&gt;' + badges + '&lt;/div&gt;' : '') +
    '&lt;div class="d4-card__divider"&gt;&lt;/div&gt;' +
    (desc ? '&lt;div class="d4-card__desc"&gt;' + desc + '&lt;/div&gt;' : '') +
    (flavor ? '&lt;div class="d4-card__flavor"&gt;' + flavor + '&lt;/div&gt;' : '') +
    '&lt;/div&gt;';
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
    if (item.equipTypeName) badges.push('&lt;span class="badge-item type"&gt;' + escHtml(item.equipTypeName) + '&lt;/span&gt;');
    if (item.charName)     badges.push('&lt;span class="badge-item class"&gt;' + escHtml(item.charName) + '&lt;/span&gt;');
    if (item.isMythic)     badges.push('&lt;span class="badge-item mythic"&gt;神话&lt;/span&gt;');
    if (item.armor)       badges.push('&lt;span class="badge-item"&gt;' + escHtml(item.armor) + '&lt;/span&gt;');
  }
  else if (tab === 'aspect') {
    if (item.source === 'Codex')      badges.push('&lt;span class="badge-item source"&gt;能量法典&lt;/span&gt;');
    else if (item.source === 'Legendary') badges.push('&lt;span class="badge-item source"&gt;传奇威能&lt;/span&gt;');
    if (item.charName) badges.push('&lt;span class="badge-item class"&gt;' + escHtml(item.charName) + '&lt;/span&gt;');
    if (item.type)     badges.push('&lt;span class="badge-item tag"&gt;' + escHtml(item.type) + '&lt;/span&gt;');
  }
  else if (tab === 'skill') {
    if (item.charName) badges.push('&lt;span class="badge-item class"&gt;' + escHtml(item.charName) + '&lt;/span&gt;');
    if (item.tags && item.tags.length) {
      item.tags.slice(0, 3).forEach(function(tag) {
        badges.push('&lt;span class="badge-item tag"&gt;' + escHtml(tag) + '&lt;/span&gt;');
      });
    }
  }
  else if (tab === 'rune') {
    if (item.charName) badges.push('&lt;span class="badge-item class"&gt;' + escHtml(item.charName) + '&lt;/span&gt;');
    if (item.type)     badges.push('&lt;span class="badge-item type"&gt;' + escHtml(item.type) + '&lt;/span&gt;');
  }
  else if (tab === 'affix') {
    if (item.tempered)     badges.push('&lt;span class="badge-item source"&gt;回火&lt;/span&gt;');
    else                  badges.push('&lt;span class="badge-item source"&gt;普通&lt;/span&gt;');
    if (item.charName)    badges.push('&lt;span class="badge-item class"&gt;' + escHtml(item.charName) + '&lt;/span&gt;');
    if (item.groupName)   badges.push('&lt;span class="badge-item tag"&gt;' + escHtml(item.groupName) + '&lt;/span&gt;');
  }
  else if (tab === 'gem') {
    if (item.quality) badges.push('&lt;span class="badge-item"&gt;' + escHtml(item.quality) + '&lt;/span&gt;');
  }
  else if (tab === 'builds') {
    if (item.className) badges.push('&lt;span class="badge-item class"&gt;' + escHtml(item.className) + '&lt;/span&gt;');
    if (item.charName)  badges.push('&lt;span class="badge-item class"&gt;' + escHtml(item.charName) + '&lt;/span&gt;');
  }

  return badges.join('');
}

function buildCardDesc(tab, item) {
  var text = '';

  if (tab === 'uniqueItem') {
    text = item._descText || parseDescText(item.desc || []);
    if (item.affixesDesc && item.affixesDesc.length) {
      text = item.affixesDesc.slice(0, 2).map(function(a) {
        return a.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, '');
      }).join(' ');
    }
  }
  else if (tab === 'aspect') {
    text = (item.affixesDesc || '').replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, '').slice(0, 120);
  }
  else if (tab === 'affix') {
    // affix.desc 是 string，不是 array
    text = typeof item.desc === 'string' ? item.desc.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, '') : '';
  }
  else if (tab === 'gem') {
    // gem 用 affixesDesc 数组（武器/防具/首饰三行）
    if (Array.isArray(item.affixesDesc)) {
      text = item.affixesDesc.slice(0, 2).map(function(a) {
        return a.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, '');
      }).join(' | ');
    }
  }
  else if (tab === 'rune') {
    if (Array.isArray(item.affixesDesc)) {
      text = item.affixesDesc.map(function(a) {
        return (a.line || a).replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, '');
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
  return flavorStr.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, '').trim();
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
    '&lt;div class="modal-close" onclick="closeModal()"&gt;×&lt;/div&gt;' +
    '&lt;div class="modal-header"&gt;' +
      (iconUrl ? '&lt;div class="modal-icon-wrap"&gt;' +
        '&lt;img src="' + iconUrl + '" alt="" onerror="this.parentElement.style.background=\'rgba(255,255,255,0.04)\'"&gt;' +
      '&lt;/div&gt;' : '') +
      '&lt;div class="modal-title-block"&gt;' +
        '&lt;div class="modal-title" style="color:' + color + '"&gt;' + escHtml(item.name || '') + '&lt;/div&gt;' +
        (item.subtitle ? '&lt;div class="modal-subtitle"&gt;' + escHtml(item.subtitle) + '&lt;/div&gt;' : '') +
        (badges ? '&lt;div class="modal-badges"&gt;' + badges + '&lt;/div&gt;' : '') +
      '&lt;/div&gt;' +
    '&lt;/div&gt;' +
    '&lt;div class="modal-body"&gt;' +
      (descLines ? '&lt;div class="modal-section"&gt;&lt;div class="modal-section-title"&gt;效果&lt;/div&gt;' + descLines + '&lt;/div&gt;' : '') +
    '&lt;/div&gt;' +
    (item.flavor ? '&lt;div class="modal-flavor"&gt;' + parseColoredDesc(escHtml(parseFlavor(item.flavor))) + '&lt;/div&gt;' : '');

  modal.classList.add('active');
}

function buildModalDescLines(tab, item) {
  if (tab === 'uniqueItem') {
    var lines = (item.affixesDesc || []).map(function(affix) {
      return '&lt;div class="modal-desc-line"&gt;' + parseColoredDesc(escHtml(affix.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, ''))) + '&lt;/div&gt;';
    });
    if (item.armor) lines.unshift('&lt;div class="modal-desc-line"&gt;' + escHtml(item.armor) + '&lt;/div&gt;');
    return lines.join('');
  }
  if (tab === 'aspect') {
    return (item.affixesDesc || '').split('\n').map(function(line) {
      return '&lt;div class="modal-desc-line"&gt;' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, ''))) + '&lt;/div&gt;';
    }).join('');
  }
  if (tab === 'affix') {
    // affix.desc 是 string
    var affixDesc = typeof item.desc === 'string' ? item.desc : '';
    return '&lt;div class="modal-desc-line"&gt;' + parseColoredDesc(escHtml(affixDesc.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, ''))) + '&lt;/div&gt;';
  }
  if (tab === 'gem') {
    return (item.affixesDesc || []).map(function(line) {
      return '&lt;div class="modal-desc-line"&gt;' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, ''))) + '&lt;/div&gt;';
    }).join('');
  }
  if (tab === 'rune') {
    return (item.affixesDesc || []).map(function(a) {
      var line = (a.line || a);
      return '&lt;div class="modal-desc-line"&gt;' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, ''))) + '&lt;/div&gt;';
    }).join('');
  }
  if (tab === 'elixir') {
    return (item.desc || '').split('\n').map(function(line) {
      return '&lt;div class="modal-desc-line"&gt;' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, ''))) + '&lt;/div&gt;';
    }).join('');
  }
  if (tab === 'skill') {
    return (item.desc || []).map(function(line) {
      return '&lt;div class="modal-desc-line"&gt;' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, ''))) + '&lt;/div&gt;';
    }).join('');
  }
  if (tab === 'summon') {
    return (item.desc || []).map(function(line) {
      return '&lt;div class="modal-desc-line"&gt;' + parseColoredDesc(escHtml(line.replace(/\{[^}]+\}/g, '').replace(/&lt;[^&gt;]+&gt;/g, ''))) + '&lt;/div&gt;';
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
    .replace(/&amp;/g, '&amp;amp;')
    .replace(/&lt;/g, '&amp;lt;')
    .replace(/&gt;/g, '&amp;gt;')
    .replace(/"/g, '&amp;quot;');
}

// ----- 启动 -----
(function init() {
  buildTabBar();
  onTabChange(currentTab);
})();
