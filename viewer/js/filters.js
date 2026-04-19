// ============================================================
// filters.js - 工具栏动态筛选逻辑
// 根据 tab 类型动态生成/显示筛选控件，处理 filter 变化
// ============================================================

// 当前筛选状态
const filters = {
  // uniqueItem
  class:     '',
  equipType: '',
  boss:      '',
  // aspect
  aspectClass:   '',
  aspectSource:  '',
  // affix
  affixClass: '',
  affixEquip: '',
  // skill
  skillClass: '',
  skillType:  '',
  // rune
  runeClass: '',
  // gem
  gemQuality: '',
  // common
  search:    ''
};

// ----- 从数据中提取唯一值列表 -----
function getUniqueValues(data, key) {
  var set = {};
  data.forEach(function(item) {
    var v = item[key];
    if (Array.isArray(v)) v.forEach(function(x) { set[x] = true; });
    else if (v) set[v] = true;
  });
  return Object.keys(set).sort();
}

// ----- 初始化筛选控件（调用一次，由 app.js 触发） -----
function initFiltersForTab(tab, data) {
  var toolbar = document.getElementById('toolbar');
  if (!toolbar) return;

  // 清除旧 filter-group
  toolbar.querySelectorAll('.tb-filter').forEach(function(el) { el.remove(); });

  var html = '';

  if (tab === 'uniqueItem') {
    var classes = getUniqueValues(data, 'charName');
    var types  = getUniqueValues(data, 'equipTypeName');
    var bosses = getUniqueValues(data, 'dropBoss');

    html += buildFilterGroup('filterClass',   '职业', classes, '全部');
    html += buildFilterGroup('filterEquipType','部位', types, '全部');
    html += buildFilterGroup('filterBoss',    '首领', bosses, '全部');
  }
  else if (tab === 'aspect') {
    var classes  = getUniqueValues(data, 'charName').filter(function(c) { return c; });
    var sources  = getUniqueValues(data, 'source');
    html += buildFilterGroup('filterAspectClass',  '职业', classes, '全部');
    html += buildFilterGroup('filterAspectSource', '来源', sources, '全部');
  }
  else if (tab === 'affix') {
    // affix 用 charType（数组），需展开
    var classSet = {};
    data.forEach(function(item) {
      if (Array.isArray(item.charType)) {
        item.charType.forEach(function(c) { if (c) classSet[c] = true; });
      }
    });
    var classes = Object.keys(classSet).map(function(en) {
      return CHAR_MAP[en] || en;
    }).sort();
    html += buildFilterGroup('filterAffixClass', '职业', classes, '全部');
    // 回火/普通筛选
    html += buildFilterGroup('filterAffixType', '类型', ['普通词缀', '回火词缀'], '全部');
  }
  else if (tab === 'skill') {
    var classes = getUniqueValues(data, 'charName').filter(function(c) { return c; });
    html += buildFilterGroup('filterSkillClass', '职业', classes, '全部');
  }

  // 搜索框（所有 tab 都有）
  html += '<input class="tb-search" id="tbSearch" type="search" placeholder="搜索名称、描述..." autocomplete="off">';

  // 统计
  html += '<span class="tb-stats" id="tbStats"></span>';
  html += '<button class="tb-reset" id="tbReset">重置</button>';

  // 在 stats 前面插入
  toolbar.innerHTML = html;

  // 绑定事件
  bindFilterEvents(tab);
}

function buildFilterGroup(id, label, values, firstLabel) {
  if (!values || values.length === 0) return '';
  var opts = '<option value="">' + firstLabel + '</option>';
  values.forEach(function(v) { opts += '<option value="' + v + '">' + v + '</option>'; });
  return '<span class="tb-filter" id="' + id + '-wrap">' +
    '<span class="tb-label">' + label + '</span>' +
    '<select class="tb-select" id="' + id + '">' + opts + '</select>' +
    '</span>';
}

function bindFilterEvents(tab) {
  var searchEl = document.getElementById('tbSearch');
  if (searchEl) {
    searchEl.value = filters.search || '';
    searchEl.addEventListener('input', function() {
      filters.search = this.value.trim();
      applyCurrentFilters(tab);
    });
  }

  // select 变化
  document.querySelectorAll('.tb-select').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var key = sel.id; // id == filter key
      filters[key] = sel.value;
      applyCurrentFilters(tab);
    });
  });

  // 重置
  var resetBtn = document.getElementById('tbReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      Object.keys(filters).forEach(function(k) { filters[k] = ''; });
      var se = document.getElementById('tbSearch');
      if (se) se.value = '';
      document.querySelectorAll('.tb-select').forEach(function(s) { s.value = ''; });
      applyCurrentFilters(tab);
    });
  }
}

// ----- 执行筛选 -----
function applyCurrentFilters(tab) {
  var data = getTabData(tab);
  if (!data || data.length === 0) return;

  var filtered = data.filter(function(item) {
    // uniqueItem filters
    if (tab === 'uniqueItem') {
      if (filters.filterClass && item.charName !== filters.filterClass) return false;
      if (filters.filterEquipType && item.equipTypeName !== filters.filterEquipType) return false;
      if (filters.filterBoss) {
        var bosses = Array.isArray(item.dropBoss) ? item.dropBoss : [];
        if (!bosses.includes(filters.filterBoss)) return false;
      }
    }
    // aspect filters
    if (tab === 'aspect') {
      if (filters.filterAspectClass && item.charName !== filters.filterAspectClass) return false;
      if (filters.filterAspectSource && item.source !== filters.filterAspectSource) return false;
    }
    // affix filters
    if (tab === 'affix') {
      if (filters.filterAffixClass && item.charName !== filters.filterAffixClass) return false;
      if (filters.filterAffixType === '普通词缀' && item.tempered) return false;
      if (filters.filterAffixType === '回火词缀' && !item.tempered) return false;
    }
    // skill filters
    if (tab === 'skill') {
      if (filters.filterSkillClass && item.charName !== filters.filterSkillClass) return false;
    }
    // search
    if (filters.search) {
      var q = filters.search.toLowerCase();
      var text = JSON.stringify(item).toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  renderGrid(tab, filtered);
}

// 更新筛选控件的可用值（当 tab 切换时）
function refreshFilterValues(tab, data) {
  // 先隐藏所有 filter group
  document.querySelectorAll('.tb-filter').forEach(function(el) { el.style.display = 'none'; });

  if (tab === 'uniqueItem') {
    var wrap = document.getElementById('filterClass-wrap');
    var wrap2 = document.getElementById('filterEquipType-wrap');
    var wrap3 = document.getElementById('filterBoss-wrap');
    if (wrap)  wrap.style.display = 'flex';
    if (wrap2) wrap2.style.display = 'flex';
    if (wrap3) wrap3.style.display = 'flex';

    // 动态更新 options
    var classes = getUniqueValues(data, 'charName');
    var types   = getUniqueValues(data, 'equipTypeName');
    var bosses  = getUniqueValues(data, 'dropBoss');
    updateSelectOptions('filterClass',      classes, '全部');
    updateSelectOptions('filterEquipType', types,   '全部');
    updateSelectOptions('filterBoss',      bosses,  '全部');
  }
  if (tab === 'aspect') {
    var w = document.getElementById('filterAspectClass-wrap');
    var w2 = document.getElementById('filterAspectSource-wrap');
    if (w)  w.style.display  = 'flex';
    if (w2) w2.style.display = 'flex';
    var classes = getUniqueValues(data, 'charName').filter(function(c) { return c; });
    var sources = getUniqueValues(data, 'source');
    updateSelectOptions('filterAspectClass', classes, '全部');
    updateSelectOptions('filterAspectSource', sources, '全部');
  }
  if (tab === 'affix') {
    var w = document.getElementById('filterAffixClass-wrap');
    var w2 = document.getElementById('filterAffixType-wrap');
    if (w) w.style.display = 'flex';
    if (w2) w2.style.display = 'flex';
    var classSet = {};
    data.forEach(function(item) {
      if (Array.isArray(item.charType)) {
        item.charType.forEach(function(c) { if (c) classSet[c] = true; });
      }
    });
    var classes = Object.keys(classSet).map(function(en) {
      return CHAR_MAP[en] || en;
    }).sort();
    updateSelectOptions('filterAffixClass', classes, '全部');
    updateSelectOptions('filterAffixType', ['普通词缀', '回火词缀'], '全部');
  }
  if (tab === 'skill') {
    var w = document.getElementById('filterSkillClass-wrap');
    if (w) w.style.display = 'flex';
    var classes = getUniqueValues(data, 'charName').filter(function(c) { return c; });
    updateSelectOptions('filterSkillClass', classes, '全部');
  }
}

function updateSelectOptions(id, values, firstLabel) {
  var sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '<option value="">' + firstLabel + '</option>' +
    values.map(function(v) { return '<option value="' + v + '">' + v + '</option>'; }).join('');
}
