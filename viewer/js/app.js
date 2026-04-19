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
    if (grid) grid.innerHTML = '<div class="empty">加载失败: ' + e.message + '</div>';
  });
}

// ----- 渲染 Grid -----
function renderGrid(tab, data) {
  var grid = document.getElementById('grid');
  var statsEl = document.getElementById('tbStats');

  if (statsEl) statsEl.textContent = '共 ' + data.length + ' 条';

  if (!data || data.length === 0) {
    grid.innerHTML = '<div class="empty">暂无数据</div>';
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

// ----- 构造卡片 HTML -----
function buildCard(tab, item, idx) {
  var color  = getCardAccentColor(tab, item);
  var iconUrl = getItemImageUrl(item.icon, tab);
  var badges  = buildBadges(tab, item);
  var desc    = buildCardDesc(tab, item);
  var flavor  = item.flavor ? parseFlavor(item.flavor) : '';

  return '<div class="d4-card" data-idx="' + idx + '" style="--card-accent:' + color + '">' +
    '<div class="d4-card__header">' +
      '<div class="d4-card__icon-wrap">' +
        '<img class="d4-card__icon" src="' + iconUrl + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' +
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
  // uniqueItem: 职业色优先
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
  var iconUrl = getItemImageUrl(item.icon, tab);
  var badges  = buildBadges(tab, item);
  var descLines = buildModalDescLines(tab, item);

  body.innerHTML =
    '<div class="modal-close" onclick="closeModal()">×</div>' +
    '<div class="modal-header">' +
      '<div class="modal-icon-wrap">' +
        '<img src="' + iconUrl + '" alt="" onerror="this.parentElement.style.background=\'rgba(255,255,255,0.04)\'">' +
      '</div>' +
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
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ----- 启动 -----
(function init() {
  buildTabBar();
  onTabChange(currentTab);
})();
