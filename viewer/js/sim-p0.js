/**
 * sim-p0.js - 模拟器 P0 重构（v2）
 * 三栏布局：左侧装备垂直列表 | 中间角色+技能栏 | 右侧符文/誓约/药剂/巅峰
 *
 * v2 修复：
 * 1. 装备名模糊匹配 uniqueItem（去掉"之威能"+部位后缀）
 * 2. 图标 URL 使用 uniqueItem 数据的 icon 字段
 * 3. 符文/药剂/巅峰面板加载真实数据
 * 4. 布局向 d2core 参考图靠拢（紧凑、图标突出）
 */

var SimStateP0 = {
  currentChar: 'Barbarian',
  charNames: {
    Barbarian:'野蛮人', Sorceress:'法师', Rogue:'游侠',
    Necromancer:'死灵法师', Druid:'德鲁伊', Spiritborn:'魂灵', Paladin:'圣骑士'
  },

  // 装备 {slot: nameStr}
  equipment: {},
  // 装备详情 {name: itemData}，用于 tooltip + 图标
  equipDataMap: {},

  // 符文 4 格
  runes: [null, null, null, null],
  // 誓约 1 格
  pact: null,
  // 药剂 4 格
  elixirs: [null, null, null, null],
  // 巅峰 5 节点
  paragonNodes: [
    { name:'修磨', subtitle:'开始',   active:false },
    { name:'灵力', subtitle:'不懈',   active:false },
    { name:'仲裁宫', subtitle:'神性', active:false },
    { name:'使徒', subtitle:'壁垒',   active:false },
    { name:'精明', subtitle:'负盾者',  active:false }
  ],

  // 技能栏 6 格
  skillBar: [null, null, null, null, null, null],
  // 被动栏 4 格
  passiveBar: [null, null, null, null, null, null],

  allSkills: [],
  activeSkills: [],
  passiveSkills: [],

  runeData: [],
  elixirData: [],
  uniqueItemData: [],

  initialized: false,
  pendingBuild: null
};

// ========== localStorage 持久化 ==========
function simP0SaveToStorage() {
  try {
    var data = {
      currentChar: SimStateP0.currentChar,
      equipment: SimStateP0.equipment,
      equipDataMap: SimStateP0.equipDataMap,
      runes: SimStateP0.runes,
      pact: SimStateP0.pact,
      elixirs: SimStateP0.elixirs,
      paragonNodes: SimStateP0.paragonNodes,
      skillBar: SimStateP0.skillBar
    };
    localStorage.setItem('d4sim_p0', JSON.stringify(data));
    console.log('[simP0SaveToStorage] saved');
  } catch(e) {
    console.warn('[simP0SaveToStorage] error:', e);
  }
}

function simP0LoadFromStorage() {
  try {
    var raw = localStorage.getItem('d4sim_p0');
    if (!raw) return null;
    var data = JSON.parse(raw);
    console.log('[simP0LoadFromStorage] loaded:', data.currentChar);
    return data;
  } catch(e) {
    console.warn('[simP0LoadFromStorage] error:', e);
    return null;
  }
}

function simP0ClearStorage() {
  try {
    localStorage.removeItem('d4sim_p0');
    console.log('[simP0ClearStorage] cleared');
  } catch(e) {
    console.warn('[simP0ClearStorage] error:', e);
  }
}

// ========== 入口 ==========
function initSimulatorP0(skillData, opts) {
  opts = opts || {};
  SimStateP0.initialized = true;

  simP0InjectHTML();
  simP0BindEvents();

  SimStateP0.allSkills = skillData || [];
  simP0FilterSkills();
  simP0RenderSkillGrid();

  simP0RenderEquipList();
  simP0RenderSkillBar();
  simP0RenderRunePanel();
  simP0RenderPactPanel();
  simP0RenderElixirPanel();
  simP0RenderParagonPanel();

  // 优先从 opts 加载，否则尝试 localStorage
  if (opts.build) {
    simP0LoadBuild(opts.build, opts.detail);
  } else {
    var saved = simP0LoadFromStorage();
    if (saved) {
      // 恢复保存的状态
      if (saved.currentChar) SimStateP0.currentChar = saved.currentChar;
      if (saved.equipment) SimStateP0.equipment = saved.equipment;
      if (saved.equipDataMap) SimStateP0.equipDataMap = saved.equipDataMap;
      if (saved.runes) SimStateP0.runes = saved.runes;
      if (saved.pact) SimStateP0.pact = saved.pact;
      if (saved.elixirs) SimStateP0.elixirs = saved.elixirs;
      if (saved.paragonNodes) SimStateP0.paragonNodes = saved.paragonNodes;
      if (saved.skillBar) SimStateP0.skillBar = saved.skillBar;
      // 重新渲染
      simP0RenderEquipList();
      simP0RenderSkillBar();
      simP0RenderRunePanel();
      simP0RenderPactPanel();
      simP0RenderElixirPanel();
      simP0RenderParagonPanel();
    }
  }
}

// ========== 注入 HTML ==========
function simP0InjectHTML() {
  var panel = document.getElementById('simulatorPanel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="sp0-layout">
      <!-- ===== 左侧：装备垂直列表 ===== -->
      <div class="sp0-left">
        <div class="sp0-card sp0-equip-card">
          <div class="sp0-card-title">
            <span class="sp0-title-icon">&#x2694;</span> 装备栏
          </div>
          <div class="sp0-equip-list" id="sp0EquipList"></div>
        </div>
      </div>

      <!-- ===== 中间：角色模型 + 技能栏 ===== -->
      <div class="sp0-center">
        <div class="sp0-char-zone" id="sp0CharZone">
          <div class="sp0-char-placeholder" id="sp0CharPlaceholder">
            <div class="sp0-char-silhouette">&#x2694;</div>
            <div class="sp0-char-label" id="sp0CharLabel">野蛮人</div>
          </div>
          <div class="sp0-power-tags" id="sp0PowerTags"></div>
        </div>
        <!-- 技能网格 -->
        <div class="sp0-skill-grid-wrap">
          <div class="sp0-skill-grid-header">
            <span class="sp0-title-icon">&#x2600;</span> 技能树
            <input type="text" class="sp0-skill-search" id="sp0SkillSearch" placeholder="搜索技能...">
          </div>
          <div class="sp0-skill-grid" id="sp0SkillGrid"></div>
        </div>
        <div class="sp0-skill-bar" id="sp0SkillBar"></div>
      </div>

      <!-- ===== 右侧：符文/誓约/药剂/巅峰 ===== -->
      <div class="sp0-right">
        <div class="sp0-card">
          <div class="sp0-card-title">
            <span class="sp0-title-icon">&#x25C6;</span> 符文
          </div>
          <div class="sp0-rune-grid" id="sp0RuneGrid"></div>
        </div>
        <div class="sp0-card">
          <div class="sp0-card-title">
            <span class="sp0-title-icon">&#x25C8;</span> 誓约
          </div>
          <div class="sp0-pact-grid" id="sp0PactGrid"></div>
        </div>
        <div class="sp0-card">
          <div class="sp0-card-title">
            <span class="sp0-title-icon">&#x1F9EA;</span> 药剂
          </div>
          <div class="sp0-elixir-grid" id="sp0ElixirGrid"></div>
        </div>
        <div class="sp0-card">
          <div class="sp0-card-title">
            <span class="sp0-title-icon">&#x2605;</span> 巅峰
          </div>
          <div class="sp0-paragon-grid" id="sp0ParagonGrid"></div>
        </div>
      </div>
    </div>

    <!-- 技能列表浮层 -->
    <div class="sp0-picker-modal" id="sp0PickerModal">
      <div class="sp0-picker-content">
        <div class="sp0-picker-header">
          <input type="text" class="sp0-search" id="sp0PickerSearch" placeholder="搜索...">
          <button class="sp0-picker-close" id="sp0PickerClose">&#xD7;</button>
        </div>
        <div class="sp0-picker-grid" id="sp0PickerGrid"></div>
      </div>
    </div>

    <!-- 通用详情弹窗 -->
    <div class="sp0-detail-modal" id="sp0DetailModal">
      <div class="sp0-detail-content">
        <div class="sp0-detail-header" id="sp0DetailHeader"></div>
        <div class="sp0-detail-body" id="sp0DetailBody"></div>
        <button class="sp0-detail-close" id="sp0DetailClose">&#xD7;</button>
      </div>
    </div>
  `;
}

// ========== 渲染：装备列表（紧凑单列：图标+金色名+灰色部位） ==========
function simP0RenderEquipList() {
  var list = document.getElementById('sp0EquipList');
  if (!list) return;

  var slotDefs = [
    {key:'helm',    label:'头盔',  slotType:'helm'},
    {key:'chest',   label:'胸甲',  slotType:'chest'},
    {key:'gloves',  label:'手套',  slotType:'gloves'},
    {key:'legs',    label:'护腿',  slotType:'legs'},
    {key:'boots',   label:'靴子',  slotType:'boots'},
    {key:'amulet',  label:'护符',  slotType:'amulet'},
    {key:'ring',    label:'戒指',  slotType:'ring'},
    {key:'weapon',  label:'武器',  slotType:'weapon'},
    {key:'offhand', label:'副手',  slotType:'offhand'},
    {key:'ring2',   label:'戒指2', slotType:'ring'}
  ];

  var html = slotDefs.map(function(def) {
    var name      = SimStateP0.equipment[def.key] || '';
    var hasItem   = !!name;
    var itemData  = hasItem ? (SimStateP0.equipDataMap[name] || null) : null;
    var iconId    = (itemData && itemData.icon) || 0;
    var isMythic  = !!(itemData && itemData.isMythic);
    var rarityCls = hasItem ? (isMythic ? 'sp0-eq-mythic' : 'sp0-eq-legendary') : 'sp0-eq-empty';

    // 图标 URL（优先用 uniqueItem 的 icon，否则用 slot 默认图）
    var iconUrl = hasItem && iconId
      ? simP0GetEquipIconUrl(iconId)
      : simP0GetSlotDefaultIcon(def.slotType);

    return '<div class="sp0-eq-row ' + rarityCls + '" data-slot="' + def.key + '">' +
      '<div class="sp0-eq-icon-wrap">' +
        (hasItem
          ? '<img class="sp0-eq-icon" src="' + iconUrl + '" alt="" data-name="' + simP0Esc(name) + '" onerror="this.style.opacity=0.15">'
          : '<div class="sp0-eq-icon-placeholder">+</div>'
        ) +
      '</div>' +
      '<div class="sp0-eq-info">' +
        '<div class="sp0-eq-name' + (hasItem ? '' : ' sp0-eq-name--empty') + '">' +
          (hasItem ? simP0Esc(name) : '未装备') +
        '</div>' +
        '<div class="sp0-eq-slot-label">' + def.label + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  list.innerHTML = html;
}

// ========== 渲染：技能栏 6 格 ==========
function simP0RenderSkillBar() {
  var bar = document.getElementById('sp0SkillBar');
  if (!bar) return;

  var keys = ['1','2','3','4','L','R'];
  var html = keys.map(function(key, idx) {
    var item = SimStateP0.skillBar[idx];
    if (item) {
      var iconUrl = simP0GetSkillIconUrl(item.icon);
      return '<div class="sp0-sb-slot filled" data-idx="' + idx + '">' +
        '<span class="sp0-sb-key">' + key + '</span>' +
        '<img class="sp0-sb-icon" src="' + iconUrl + '" alt="" onerror="this.style.opacity=0.3">' +
        '<button class="sp0-sb-remove" data-idx="' + idx + '">&#xD7;</button>' +
      '</div>';
    } else {
      return '<div class="sp0-sb-slot" data-idx="' + idx + '">' +
        '<span class="sp0-sb-key">' + key + '</span>' +
        '<span class="sp0-sb-empty">+</span>' +
      '</div>';
    }
  }).join('');
  bar.innerHTML = html;

  bar.querySelectorAll('.sp0-sb-remove').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var idx = parseInt(btn.dataset.idx, 10);
      SimStateP0.skillBar[idx] = null;
      simP0RenderSkillBar();
    });
  });
}

// ========== 渲染：符文面板（2×2 网格，有数据时显示图标+名称+简述） ==========
function simP0RenderRunePanel() {
  var grid = document.getElementById('sp0RuneGrid');
  if (!grid) return;

  var hasRuneData = SimStateP0.runeData && SimStateP0.runeData.length > 0;
  var html = '';

  for (var i = 0; i < 4; i++) {
    var rune = SimStateP0.runes[i];
    if (rune) {
      var iconUrl = simP0GetRuneIconUrl(rune.icon);
      var shortDesc = (rune._shortDesc || '').slice(0, 36);
      html += '<div class="sp0-rune-slot filled" data-idx="' + i + '">' +
        '<img class="sp0-rune-icon" src="' + iconUrl + '" alt="" onerror="this.style.opacity=0.15">' +
        '<div class="sp0-rune-name">' + simP0Esc(rune.name || '') + '</div>' +
        (shortDesc ? '<div class="sp0-rune-desc">' + simP0Esc(shortDesc) + '</div>' : '') +
        '<button class="sp0-sb-remove" data-idx="' + i + '" data-type="rune">&#xD7;</button>' +
      '</div>';
    } else {
      // 空槽：可点击时显示"选择符文"，否则显示第一条数据预览
      var preview = (hasRuneData && i === 0) ? SimStateP0.runeData[0] : null;
      if (preview && !hasItem) {
        // 预览模式（仅在没有任何符文时显示第一条作为引导）
      }
      html += '<div class="sp0-rune-slot' + (hasRuneData ? ' clickable' : '') + '" data-idx="' + i + '" data-type="rune">' +
        '<div class="sp0-rune-icon-placeholder">+</div>' +
        '<div class="sp0-rune-name sp0-empty-text">选择符文</div>' +
      '</div>';
    }
  }

  grid.innerHTML = html;
}

// ========== 渲染：誓约面板（1 格） ==========
function simP0RenderPactPanel() {
  var grid = document.getElementById('sp0PactGrid');
  if (!grid) return;

  var pact = SimStateP0.pact;
  if (pact) {
    grid.innerHTML = '<div class="sp0-pact-slot filled" data-type="pact">' +
      '<div class="sp0-pact-icon-placeholder">&#x25C8;</div>' +
      '<div class="sp0-pact-name">' + simP0Esc(pact.name || '虚盾者') + '</div>' +
      '<button class="sp0-sb-remove" data-type="pact">&#xD7;</button>' +
    '</div>';
  } else {
    grid.innerHTML = '<div class="sp0-pact-slot clickable" data-type="pact">' +
      '<div class="sp0-pact-icon-placeholder">+</div>' +
      '<div class="sp0-pact-name sp0-empty-text">选择誓约</div>' +
    '</div>';
  }
}

// ========== 渲染：药剂面板（4 行，有数据时显示实际药剂） ==========
function simP0RenderElixirPanel() {
  var grid = document.getElementById('sp0ElixirGrid');
  if (!grid) return;

  var hasElixirData = SimStateP0.elixirData && SimStateP0.elixirData.length > 0;
  var html = '';

  for (var i = 0; i < 4; i++) {
    var elixir = SimStateP0.elixirs[i];
    if (elixir) {
      var iconUrl = simP0GetElixirIconUrl(elixir.icon);
      html += '<div class="sp0-elixir-row filled" data-idx="' + i + '">' +
        '<img class="sp0-elixir-icon" src="' + iconUrl + '" alt="" onerror="this.style.opacity=0.15">' +
        '<div class="sp0-elixir-name">' + simP0Esc(elixir.name || '') + '</div>' +
        '<button class="sp0-sb-remove" data-idx="' + i + '" data-type="elixir">&#xD7;</button>' +
      '</div>';
    } else {
      // 空槽：有数据时显示第一条预览
      var preview = (hasElixirData && i === 0) ? SimStateP0.elixirData[0] : null;
      if (preview) {
        var pUrl = simP0GetElixirIconUrl(preview.icon);
        html += '<div class="sp0-elixir-row preview' + (hasElixirData ? ' clickable' : '') + '" data-idx="' + i + '" data-type="elixir">' +
          '<img class="sp0-elixir-icon" src="' + pUrl + '" alt="" onerror="this.style.opacity=0.15">' +
          '<div class="sp0-elixir-name sp0-empty-text">选择药剂</div>' +
        '</div>';
      } else {
        html += '<div class="sp0-elixir-row' + (hasElixirData ? ' clickable' : '') + '" data-idx="' + i + '" data-type="elixir">' +
          '<div class="sp0-elixir-icon-placeholder">+</div>' +
          '<div class="sp0-elixir-name sp0-empty-text">药剂</div>' +
        '</div>';
      }
    }
  }
  grid.innerHTML = html;
}

// ========== 渲染：巅峰面板（5 圆形节点） ==========
function simP0RenderParagonPanel() {
  var grid = document.getElementById('sp0ParagonGrid');
  if (!grid) return;

  var nodes = SimStateP0.paragonNodes;
  var html = nodes.map(function(node, i) {
    var cls = node.active ? 'active' : '';
    return '<div class="sp0-paragon-node ' + cls + '" data-idx="' + i + '">' +
      '<div class="sp0-paragon-circle">' +
        '<div class="sp0-paragon-name">' + simP0Esc(node.name) + '</div>' +
      '</div>' +
      '<div class="sp0-paragon-subtitle">' + simP0Esc(node.subtitle) + '</div>' +
    '</div>';
  }).join('');
  grid.innerHTML = html;
}

// ========== 角色区 ==========
var _sp0CharColors = {
  Barbarian: '#c0392b',
  Sorceress: '#9b59b6',
  Rogue: '#2980b9',
  Necromancer: '#8e44ad',
  Druid: '#27ae60',
  Spiritborn: '#e67e22',
  Paladin: '#f1c40f'
};

function simP0RenderCharZone() {
  var label = document.getElementById('sp0CharLabel');
  if (label) {
    var charName = SimStateP0.charNames[SimStateP0.currentChar] || SimStateP0.currentChar;
    label.textContent = charName;
    
    // 职业颜色
    var color = _sp0CharColors[SimStateP0.currentChar] || '#f39c12';
    label.style.color = color;
    label.style.textShadow = '0 0 20px ' + color;
  }

  // 图标颜色
  var silhouette = document.querySelector('.sp0-char-silhouette');
  if (silhouette) {
    var color = _sp0CharColors[SimStateP0.currentChar] || '#ffffff';
    silhouette.style.color = color;
  }

  var tagsEl = document.getElementById('sp0PowerTags');
  if (tagsEl) {
    var powers = [];
    var eq = SimStateP0.equipment;
    for (var key in eq) {
      var name = eq[key];
      if (name && name.indexOf('之威能') > 0) {
        var shortName = name.replace(/之威能[^\s]*/, '');
        powers.push(shortName);
      }
    }
    tagsEl.innerHTML = powers.slice(0, 5).map(function(p, i) {
      var angle = -60 + i * 30;
      return '<div class="sp0-power-tag" style="transform:rotate(' + angle + 'deg) translateX(60px)">' +
        simP0Esc(p) + '</div>';
    }).join('');
  }
}

// ========== 筛选技能 ==========
function simP0FilterSkills() {
  var c = SimStateP0.currentChar;
  var active = [], passive = [];
  (SimStateP0.allSkills || []).forEach(function(s) {
    if (s.char !== c) return;
    if (s.active) active.push(s); else passive.push(s);
  });
  SimStateP0.activeSkills = active;
  SimStateP0.passiveSkills = passive;
}

// ========== 渲染：技能网格 ==========
function simP0RenderSkillGrid() {
  var grid = document.getElementById('sp0SkillGrid');
  if (!grid) return;

  var skills = SimStateP0.activeSkills || [];
  
  // 合并被动技能显示
  var allSkills = skills.concat(SimStateP0.passiveSkills || []);

  var html = allSkills.map(function(sk, i) {
    var iconId = sk.icon || sk.icons || sk.iconId || 0;
    var name = sk.name || sk.sName || '';
    var desc = sk.desc || sk.description || '';
    var isPassive = sk.isPassive || sk.type === 'passive' || (sk.tags && sk.tags.indexOf('passive') >= 0);
    
    // 图标 URL
    var iconUrl = iconId ? simP0GetSkillIconUrl(iconId) : '';
    
    // 检查是否已在技能栏
    var inBar = SimStateP0.skillBar.some(function(s) { return s && s.icon === iconId; });
    
    // 类型标签
    var typeLabel = isPassive ? '被动' : '主动';
    var typeClass = isPassive ? 'sp0-sk-passive' : 'sp0-sk-active';
    
    return '<div class="sp0-skill-item ' + typeClass + (inBar ? ' sp0-sk-inbar' : '') + '" data-idx="' + i + '">' +
      '<div class="sp0-skill-icon-wrap">' +
        (iconUrl ? '<img class="sp0-skill-icon" src="' + iconUrl + '" alt="" onerror="this.style.opacity=0.2">' : '<div class="sp0-skill-icon-placeholder">&#x2600;</div>') +
        (inBar ? '<div class="sp0-skill-badge">&#x2713;</div>' : '') +
      '</div>' +
      '<div class="sp0-skill-info">' +
        '<div class="sp0-skill-name">' + simP0Esc(name) + '</div>' +
        '<div class="sp0-skill-type">' + typeLabel + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  grid.innerHTML = html || '<div class="sp0-empty">暂无技能数据</div>';

  // 绑定点击事件
  grid.querySelectorAll('.sp0-skill-item').forEach(function(item, i) {
    item.addEventListener('click', function() {
      var sk = allSkills[i];
      simP0OnSkillGridItemClick(sk, i);
    });
  });
}

function simP0OnSkillGridItemClick(skill, idx) {
  // 查找第一个空槽
  var emptyIdx = SimStateP0.skillBar.findIndex(function(s) { return !s; });
  
  var iconId = skill.icon || skill.icons || skill.iconId || 0;
  var name = skill.name || skill.sName || '';
  
  if (emptyIdx >= 0) {
    // 有空槽，直接添加
    SimStateP0.skillBar[emptyIdx] = {icon: iconId, name: name, active: true};
    simP0RenderSkillBar();
    simP0RenderSkillGrid(); // 更新网格状态
    simP0SaveToStorage();
  } else {
    // 技能栏已满，弹出选择器让用户选择替换哪个槽
    simP0OpenSkillPickerForReplace(skill);
  }
}

function simP0OpenSkillPickerForReplace(skill) {
  // 显示一个特殊的选择器，让用户选择替换哪个槽位
  var modal = document.getElementById('sp0PickerModal');
  var grid = document.getElementById('sp0PickerGrid');
  var search = document.getElementById('sp0PickerSearch');
  
  if (!modal || !grid) return;
  
  var iconId = skill.icon || skill.icons || skill.iconId || 0;
  var name = skill.name || skill.sName || '';
  
  // 显示当前技能栏，让用户选择替换哪个槽
  var html = '<div class="sp0-picker-hint">选择要替换的技能槽：</div>';
  SimStateP0.skillBar.forEach(function(s, i) {
    if (s) {
      var sIcon = s.icon ? simP0GetSkillIconUrl(s.icon) : '';
      var sName = s.name || '技能 ' + (i + 1);
      html += '<div class="sp0-picker-item sp0-replace-slot" data-idx="' + i + '">' +
        (sIcon ? '<img class="sp0-picker-icon" src="' + sIcon + '" alt="">' : '') +
        '<div class="sp0-picker-info">' +
          '<div class="sp0-picker-name">' + simP0Esc(sName) + '</div>' +
          '<div class="sp0-picker-sub">槽位 ' + (i + 1) + '</div>' +
        '</div>' +
      '</div>';
    }
  });
  
  grid.innerHTML = html;
  if (search) search.style.display = 'none';
  modal.classList.add('active');
  
  // 绑定点击事件
  grid.querySelectorAll('.sp0-replace-slot').forEach(function(item) {
    item.addEventListener('click', function() {
      var slotIdx = parseInt(item.dataset.idx, 10);
      SimStateP0.skillBar[slotIdx] = {icon: iconId, name: name, active: true};
      simP0RenderSkillBar();
      simP0RenderSkillGrid();
      simP0SaveToStorage();
      simP0ClosePicker();
    });
  });
}

// 技能网格搜索
function simP0FilterSkillGrid(query) {
  var q = (query || '').toLowerCase();
  
  var allSkills = (SimStateP0.activeSkills || []).concat(SimStateP0.passiveSkills || []);
  
  var filtered = allSkills.filter(function(sk) {
    var name = (sk.name || sk.sName || '').toLowerCase();
    var desc = (sk.desc || sk.description || '').toLowerCase();
    return !q || name.indexOf(q) >= 0 || desc.indexOf(q) >= 0;
  });
  
  var grid = document.getElementById('sp0SkillGrid');
  if (!grid) return;
  
  var html = filtered.map(function(sk, i) {
    var iconId = sk.icon || sk.icons || sk.iconId || 0;
    var name = sk.name || sk.sName || '';
    var isPassive = sk.isPassive || sk.type === 'passive' || (sk.tags && sk.tags.indexOf('passive') >= 0);
    
    var iconUrl = iconId ? simP0GetSkillIconUrl(iconId) : '';
    var inBar = SimStateP0.skillBar.some(function(s) { return s && s.icon === iconId; });
    var typeLabel = isPassive ? '被动' : '主动';
    var typeClass = isPassive ? 'sp0-sk-passive' : 'sp0-sk-active';
    
    return '<div class="sp0-skill-item ' + typeClass + (inBar ? ' sp0-sk-inbar' : '') + '" data-idx="' + i + '">' +
      '<div class="sp0-skill-icon-wrap">' +
        (iconUrl ? '<img class="sp0-skill-icon" src="' + iconUrl + '" alt="" onerror="this.style.opacity=0.2">' : '<div class="sp0-skill-icon-placeholder">&#x2600;</div>') +
        (inBar ? '<div class="sp0-skill-badge">&#x2713;</div>' : '') +
      '</div>' +
      '<div class="sp0-skill-info">' +
        '<div class="sp0-skill-name">' + simP0Esc(name) + '</div>' +
        '<div class="sp0-skill-type">' + typeLabel + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  
  grid.innerHTML = html || '<div class="sp0-empty">无匹配技能</div>';
  
  // 重新绑定点击事件
  grid.querySelectorAll('.sp0-skill-item').forEach(function(item, i) {
    item.addEventListener('click', function() {
      var sk = filtered[i];
      simP0OnSkillGridItemClick(sk, i);
    });
  });
}

// ========== 从构筑加载数据 ==========
function simP0LoadBuild(build, detail) {
  if (!build) return;

  // 1. 职业
  var charMap = {
    '圣骑士':'Paladin', '野蛮人':'Barbarian', '死灵法师':'Necromancer',
    '游侠':'Rogue', '法师':'Sorceress', '德鲁伊':'Druid', '魂灵':'Spiritborn'
  };
  var charEn = charMap[build.class_zh] || build.class_en || 'Barbarian';
  SimStateP0.currentChar = charEn;

  // 2. 装备（存名称字符串 → JS 会自动做模糊匹配获取 icon）
  SimStateP0.equipment = {};
  var eqData = (detail && detail.equipment) || build._equipment || build.equipment || {};
  if (eqData && typeof eqData === 'object') {
    for (var k in eqData) {
      if (eqData[k]) SimStateP0.equipment[k] = eqData[k];
    }
  }

  // 3. 技能栏
  var skillsArr = (detail && detail.skillIcons) || build._skillIcons || build.equip_skills || [];
  SimStateP0.skillBar = [null, null, null, null, null, null];
  skillsArr.forEach(function(sk, idx) {
    if (idx >= 6) return;
    var iconId, skillName;
    if (typeof sk === 'number') {
      iconId = sk; skillName = '';
    } else if (sk && typeof sk === 'object') {
      iconId = sk.icon; skillName = sk.name || '';
    } else return;
    if (iconId) {
      SimStateP0.skillBar[idx] = {icon: iconId, name: skillName, active: true};
    }
  });

  // 4. 填充默认符文预览（从 runeData 取前 4 条）
  if (SimStateP0.runeData && SimStateP0.runeData.length > 0) {
    for (var ri = 0; ri < 4; ri++) {
      if (!SimStateP0.runes[ri] && SimStateP0.runeData[ri]) {
        // 仅在首次加载时填充预览槽（runes 全为 null 时）
        if (SimStateP0.runes.every(function(r) { return !r; })) {
          SimStateP0.runes[ri] = SimStateP0.runeData[ri];
        }
      }
    }
  }

  // 5. 填充默认药剂预览
  if (SimStateP0.elixirData && SimStateP0.elixirData.length > 0) {
    for (var ei = 0; ei < 4; ei++) {
      if (!SimStateP0.elixirs[ei] && SimStateP0.elixirData[ei]) {
        if (SimStateP0.elixirs.every(function(e) { return !e; })) {
          SimStateP0.elixirs[ei] = SimStateP0.elixirData[ei];
        }
      }
    }
  }

  simP0RenderEquipList();
  simP0RenderSkillBar();
  simP0RenderRunePanel();
  simP0RenderElixirPanel();
  simP0RenderCharZone();

  console.log('[simP0LoadBuild] done', {
    char: SimStateP0.currentChar,
    equip: Object.keys(SimStateP0.equipment).length,
    skills: SimStateP0.skillBar.filter(Boolean).length,
    runes: SimStateP0.runes.filter(Boolean).length,
    elixirs: SimStateP0.elixirs.filter(Boolean).length
  });
  simP0SaveToStorage();
}

// ========== 绑定事件 ==========
function simP0BindEvents() {
  var root = document.getElementById('simulatorPanel');

  // 装备行 hover → tooltip
  root.addEventListener('mouseover', function(e) {
    var row = e.target.closest('.sp0-eq-row');
    if (row && row.classList.contains('sp0-eq-legendary') || row && row.classList.contains('sp0-eq-mythic')) {
      var name = SimStateP0.equipment[row.dataset.slot] || '';
      if (name) {
        var data = SimStateP0.equipDataMap[name] || null;
        if (data) simP0ShowEquipTooltip(row, data);
      }
    }
  });

  root.addEventListener('mouseout', function(e) {
    var row = e.target.closest('.sp0-eq-row');
    if (row) simP0HideEquipTooltip(row);
  });

  // 点击事件
  root.addEventListener('click', function(e) {
    // 移除按钮
    var rmBtn = e.target.closest('.sp0-sb-remove');
    if (rmBtn) {
      e.stopPropagation();
      var idx = parseInt(rmBtn.dataset.idx, 10);
      var type = rmBtn.dataset.type || 'skill';
      if (type === 'rune') {
        SimStateP0.runes[idx] = null;
        simP0RenderRunePanel();
      } else if (type === 'elixir') {
        SimStateP0.elixirs[idx] = null;
        simP0RenderElixirPanel();
      } else if (type === 'pact') {
        SimStateP0.pact = null;
        simP0RenderPactPanel();
      } else {
        SimStateP0.skillBar[idx] = null;
        simP0RenderSkillBar();
      }
      simP0SaveToStorage();
      return;
    }

    // 符文槽点击
    var runeSlot = e.target.closest('.sp0-rune-slot.clickable, .sp0-rune-slot:not(.filled)');
    if (runeSlot) {
      var idx = parseInt(runeSlot.dataset.idx, 10);
      simP0OpenRunePicker(idx);
      return;
    }

    // 药剂行点击
    var elixirRow = e.target.closest('.sp0-elixir-row.clickable, .sp0-elixir-row:not(.filled)');
    if (elixirRow) {
      var idx = parseInt(elixirRow.dataset.idx, 10);
      simP0OpenElixirPicker(idx);
      return;
    }

    // 誓约槽点击
    var pactSlot = e.target.closest('.sp0-pact-slot.clickable, .sp0-pact-slot:not(.filled)');
    if (pactSlot) {
      simP0OpenPactPicker();
      return;
    }

    // 巅峰节点点击
    var paragonNode = e.target.closest('.sp0-paragon-node');
    if (paragonNode) {
      var idx = parseInt(paragonNode.dataset.idx, 10);
      SimStateP0.paragonNodes[idx].active = !SimStateP0.paragonNodes[idx].active;
      simP0RenderParagonPanel();
      simP0SaveToStorage();
      return;
    }

    // 技能栏点击
    var sbSlot = e.target.closest('.sp0-sb-slot');
    if (sbSlot) {
      var idx = parseInt(sbSlot.dataset.idx, 10);
      if (SimStateP0.skillBar[idx]) {
        simP0ShowSkillDetail(SimStateP0.skillBar[idx]);
      } else {
        simP0OpenSkillPicker(idx);
      }
    }
  });

  // 弹窗关闭
  var pickerClose = document.getElementById('sp0PickerClose');
  if (pickerClose) pickerClose.addEventListener('click', simP0ClosePicker);

  var pickerModal = document.getElementById('sp0PickerModal');
  if (pickerModal) pickerModal.addEventListener('click', function(e) {
    if (e.target.id === 'sp0PickerModal') simP0ClosePicker();
  });

  var detailClose = document.getElementById('sp0DetailClose');
  if (detailClose) detailClose.addEventListener('click', simP0CloseDetail);

  var detailModal = document.getElementById('sp0DetailModal');
  if (detailModal) detailModal.addEventListener('click', function(e) {
    if (e.target.id === 'sp0DetailModal') simP0CloseDetail();
  });

  // 搜索
  var searchInput = document.getElementById('sp0PickerSearch');
  if (searchInput) searchInput.addEventListener('input', function() {
    simP0FilterPicker(this.value);
  });

  // 技能网格搜索
  var skillSearchInput = document.getElementById('sp0SkillSearch');
  if (skillSearchInput) skillSearchInput.addEventListener('input', function() {
    simP0FilterSkillGrid(this.value);
  });

  // 导入导出功能（动态添加按钮）
  setTimeout(simP0AddImportExportBtns, 100);
}

// ========== 装备 Tooltip ==========
function simP0ShowEquipTooltip(row, data) {
  simP0HideEquipTooltip(row);

  var name      = data.name || '';
  var equipType = data.equipTypeName || '';
  var isMythic  = !!data.isMythic;
  var armor     = data.armor || '';
  var affixes   = data.affixesDesc || [];
  var flavor    = data.flavor || '';
  var charName  = data.charName || '';
  var iconId    = data.icon || 0;
  var iconUrl   = simP0GetEquipIconUrl(iconId);
  var nameColor = isMythic ? '#e74c3c' : '#f39c12';

  var tooltip = document.createElement('div');
  tooltip.className = 'sp0-eq-tooltip';
  tooltip.id = 'sp0EqTooltip_' + row.dataset.slot;

  var iconHtml = '<div class="sp0-tt-icon-wrap">' +
    '<img class="sp0-tt-icon" src="' + iconUrl + '" alt="" onerror="this.style.opacity=0.15">' +
    (isMythic ? '<div class="sp0-tt-mythic-badge">神话</div>' : '') +
  '</div>';

  var nameHtml = '<div class="sp0-tt-name-row">' +
    '<div class="sp0-tt-name" style="color:' + nameColor + '">' + simP0Esc(name) + '</div>' +
    '<div class="sp0-tt-type">' + simP0Esc(equipType) + '</div>' +
  '</div>';

  var tagsHtml = charName
    ? '<div class="sp0-tt-tags"><span class="sp0-tt-tag">' + simP0Esc(charName) + '</span></div>'
    : '';

  var propsHtml = '';
  if (armor) propsHtml += '<div class="sp0-tt-prop">' + simP0Esc(armor) + '</div>';
  affixes.forEach(function(line) {
    if (typeof line === 'string') {
      var clean = line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '');
      clean = simP0ParseColored(clean);
      propsHtml += '<div class="sp0-tt-prop sp0-tt-affix">' + clean + '</div>';
    }
  });

  var flavorHtml = '';
  if (flavor) {
    var cleanFlavor = flavor.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '').trim();
    flavorHtml = '<div class="sp0-tt-flavor">' + simP0ParseColored(simP0Esc(cleanFlavor)) + '</div>';
  }

  tooltip.innerHTML = iconHtml + nameHtml + tagsHtml + propsHtml + flavorHtml;
  row.appendChild(tooltip);
}

function simP0HideEquipTooltip(row) {
  var old = row.querySelector('.sp0-eq-tooltip');
  if (old) old.remove();
}

// ========== 技能详情弹窗 ==========
function simP0ShowSkillDetail(skill) {
  var modal = document.getElementById('sp0DetailModal');
  var header = document.getElementById('sp0DetailHeader');
  var body = document.getElementById('sp0DetailBody');
  if (!modal || !header || !body) return;

  var iconUrl = simP0GetSkillIconUrl(skill.icon);
  var tagsHtml = (skill.tags || []).slice(0, 3).map(function(t) {
    return '<span class="sp0-tt-tag">' + simP0Esc(t) + '</span>';
  }).join('');

  header.innerHTML = '<div class="sp0-tt-icon-wrap">' +
    '<img class="sp0-tt-icon" src="' + iconUrl + '" style="width:64px;height:64px" alt="" onerror="this.style.opacity=0.2">' +
    '</div>' +
    '<div class="sp0-tt-name-row">' +
      '<div class="sp0-tt-name" style="color:#3498db">' + simP0Esc(skill.name || '') + '</div>' +
      (tagsHtml ? '<div class="sp0-tt-tags">' + tagsHtml + '</div>' : '') +
    '</div>';

  var descHtml = '';
  (skill.desc || []).forEach(function(line) {
    if (typeof line === 'string') {
      var clean = simP0ParseColored(simP0Esc(line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '')));
      descHtml += '<div class="sp0-tt-prop">' + clean + '</div>';
    }
  });

  body.innerHTML = descHtml;
  modal.classList.add('active');
}

// ========== 选择器 ==========
var _sp0PickerCallback = null;
var _sp0PickerData = [];

function simP0OpenSkillPicker(slotIdx) {
  _sp0PickerCallback = function(item) {
    SimStateP0.skillBar[slotIdx] = item;
    simP0RenderSkillBar();
    simP0SaveToStorage();
    simP0ClosePicker();
  };
  _sp0PickerData = SimStateP0.activeSkills;
  document.getElementById('sp0PickerSearch').value = '';
  simP0RenderPickerGrid(SimStateP0.activeSkills);
  document.getElementById('sp0PickerModal').classList.add('active');
}

function simP0OpenRunePicker(slotIdx) {
  _sp0PickerCallback = function(item) {
    SimStateP0.runes[slotIdx] = item;
    simP0RenderRunePanel();
    simP0SaveToStorage();
    simP0ClosePicker();
  };
  _sp0PickerData = SimStateP0.runeData;
  document.getElementById('sp0PickerSearch').value = '';
  simP0RenderPickerGrid(SimStateP0.runeData);
  document.getElementById('sp0PickerModal').classList.add('active');
}

function simP0OpenElixirPicker(slotIdx) {
  _sp0PickerCallback = function(item) {
    SimStateP0.elixirs[slotIdx] = item;
    simP0RenderElixirPanel();
    simP0SaveToStorage();
    simP0ClosePicker();
  };
  _sp0PickerData = SimStateP0.elixirData;
  document.getElementById('sp0PickerSearch').value = '';
  simP0RenderPickerGrid(SimStateP0.elixirData);
  document.getElementById('sp0PickerModal').classList.add('active');
}

function simP0OpenPactPicker() {
  SimStateP0.pact = {name: '虚盾者'};
  simP0RenderPactPanel();
  simP0SaveToStorage();
}

function simP0RenderPickerGrid(list) {
  var grid = document.getElementById('sp0PickerGrid');
  if (!grid) return;

  var html = list.map(function(item, i) {
    var icon = '';
    if (item.icon) {
      if (item._iconType === 'elixir') icon = simP0GetElixirIconUrl(item.icon);
      else if (item._iconType === 'rune') icon = simP0GetRuneIconUrl(item.icon);
      else icon = simP0GetSkillIconUrl(item.icon);
    }
    var name = item.name || '';
    var sub  = item._shortDesc || item.subtitle || item.equipTypeName || '';
    return '<div class="sp0-picker-item" data-idx="' + i + '">' +
      '<img class="sp0-picker-icon" src="' + icon + '" alt="" onerror="this.style.opacity=0.15">' +
      '<div class="sp0-picker-info">' +
        '<div class="sp0-picker-name">' + simP0Esc(name) + '</div>' +
        (sub ? '<div class="sp0-picker-sub">' + simP0Esc(sub.slice(0, 60)) + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  grid.innerHTML = html || '<div class="sp0-empty">无匹配</div>';
}

function simP0FilterPicker(query) {
  var q = query.toLowerCase();
  var filtered = _sp0PickerData.filter(function(item) {
    return !q || (item.name || '').toLowerCase().indexOf(q) >= 0;
  });
  simP0RenderPickerGrid(filtered);
}

function simP0ClosePicker() {
  document.getElementById('sp0PickerModal').classList.remove('active');
  _sp0PickerCallback = null;
}

function simP0CloseDetail() {
  document.getElementById('sp0DetailModal').classList.remove('active');
}

// 选择器 item 点击（全局）
document.addEventListener('click', function(e) {
  var itemEl = e.target.closest('.sp0-picker-item');
  if (itemEl && _sp0PickerCallback) {
    var idx = parseInt(itemEl.dataset.idx, 10);
    var dataItem = _sp0PickerData[idx];
    if (dataItem) _sp0PickerCallback(dataItem);
  }
});

// ========== 加载外部数据 ==========
function simP0LoadEquipData(uniqueItems) {
  if (!uniqueItems || !Array.isArray(uniqueItems)) return;
  SimStateP0.uniqueItemData = uniqueItems;

  var map = {};
  uniqueItems.forEach(function(item) {
    if (item.name) map[item.name] = item;
  });

  // 装备名可能带"之威能"和部位后缀，尝试模糊匹配
  // 构建后缀列表用于去重
  var suffixes = ['头盔','胸甲','护肩','手套','护腿','靴子','腰带','护符','戒指','武器','副手','法器','盾牌','匕首'];

  uniqueItems.forEach(function(item) {
    if (!item.name) return;
    var base = item.name;
    map[base] = item;

    // 也存一个去掉部位后缀的版本（避免equip名带部位后缀时匹配不上）
    for (var si = 0; si < suffixes.length; si++) {
      var s = suffixes[si];
      if (base.endsWith(s)) {
        var stripped = base.slice(0, -s.length);
        // 避免覆盖已存在的
        if (!map[stripped]) map[stripped] = item;
        break;
      }
    }
  });

  SimStateP0.equipDataMap = map;
}

function simP0LoadRuneData(runes) {
  if (!runes || !Array.isArray(runes)) return;
  SimStateP0.runeData = runes.map(function(r) {
    r._shortDesc = (r.affixesDesc && r.affixesDesc[0] && r.affixesDesc[0].line)
      ? r.affixesDesc[0].line.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '').slice(0, 40)
      : (r.desc || '').replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '').slice(0, 40);
    r._iconType = 'rune';
    return r;
  });
}

function simP0LoadElixirData(elixirs) {
  if (!elixirs || !Array.isArray(elixirs)) return;
  SimStateP0.elixirData = elixirs.map(function(e) {
    e._shortDesc = (e.desc || '').replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '').replace(/\\r\\n/g, ' ').slice(0, 60);
    e._iconType = 'elixir';
    return e;
  });
}

// ========== 工具函数 ==========
function simP0GetEquipIconUrl(iconId) {
  if (!iconId) return '';
  return 'https://cloudstorage.d2core.com/data_img/d4/item/' + iconId + '.png?imageView2/2/ignore-error/1/w/64/q/80';
}

function simP0GetSlotDefaultIcon(slotType) {
  // 没有图标时用 slot 类型的默认图（d2core 风格）
  var defaults = {
    helm:    2403703901,
    chest:   2403703902,
    gloves:  2403703903,
    legs:    2403703904,
    boots:   2403703905,
    amulet:  2403703906,
    ring:    2403703907,
    weapon:  2403703908,
    offhand: 2403703909
  };
  var id = defaults[slotType] || 2403703901;
  return 'https://cloudstorage.d2core.com/data_img/d4/item/' + id + '.png?imageView2/2/ignore-error/1/w/64/q/80';
}

function simP0GetSkillIconUrl(iconId) {
  if (!iconId) return '';
  return 'https://cloudstorage.d2core.com/data_img/d4/skill/' + iconId + '.png?imageView2/2/ignore-error/1/w/64/q/80';
}

function simP0GetRuneIconUrl(iconId) {
  if (!iconId) return '';
  return 'https://cloudstorage.d2core.com/data_img/d4/rune/' + iconId + '.png?imageView2/2/ignore-error/1/w/48/q/80';
}

function simP0GetElixirIconUrl(iconId) {
  if (!iconId) return '';
  return 'https://cloudstorage.d2core.com/data_img/d4/elixir/' + iconId + '.png?imageView2/2/ignore-error/1/w/40/q/80';
}

function simP0Esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function simP0ParseColored(text) {
  if (!text) return '';
  return text
    .replace(/\{c_label\}([^{]*)\{\/c\}/g, '<span class="sp0-c-label">$1</span>')
    .replace(/\{c_important\}([^{]*)\{\/c\}/g, '<span class="sp0-c-important">$1</span>')
    .replace(/\{c_number\}([^{]*)\{\/c\}/g, '<span class="sp0-c-number">$1</span>')
    .replace(/\{c_resource\}([^{]*)\{\/c\}/g, '<span class="sp0-c-resource">$1</span>')
    .replace(/\{c_RuneCondition\}([^{]*)\{\/c\}/g, '<span class="sp0-c-rune">$1</span>')
    .replace(/\{[^}]+\}/g, '');
}

// ========== 导入导出功能 ==========
function simP0AddImportExportBtns() {
  var cardTitle = document.querySelector('.sp0-equip-card .sp0-card-title');
  if (!cardTitle) return;
  
  // 检查是否已添加
  if (document.getElementById('sp0ExportBtn')) return;
  
  var wrap = document.createElement('div');
  wrap.className = 'sp0-equip-actions';
  wrap.innerHTML = '<button class="sp0-btn sp0-btn-sm" id="sp0ExportBtn" title="导出配置">&#x2913;</button>' +
    '<button class="sp0-btn sp0-btn-sm" id="sp0ImportBtn" title="导入配置">&#x2912;</button>' +
    '<input type="file" id="sp0ImportFile" accept=".json" style="display:none">';
  cardTitle.appendChild(wrap);
  
  // 绑定事件
  document.getElementById('sp0ExportBtn').addEventListener('click', simP0ExportConfig);
  document.getElementById('sp0ImportBtn').addEventListener('click', function() {
    document.getElementById('sp0ImportFile').click();
  });
  document.getElementById('sp0ImportFile').addEventListener('change', simP0ImportConfig);
}

function simP0ExportConfig() {
  var config = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    currentChar: SimStateP0.currentChar,
    equipment: SimStateP0.equipment,
    equipDataMap: SimStateP0.equipDataMap,
    runes: SimStateP0.runes,
    pact: SimStateP0.pact,
    elixirs: SimStateP0.elixirs,
    paragonNodes: SimStateP0.paragonNodes,
    skillBar: SimStateP0.skillBar
  };
  
  var json = JSON.stringify(config, null, 2);
  var blob = new Blob([json], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  
  var a = document.createElement('a');
  a.href = url;
  a.download = 'd4sim_' + SimStateP0.charNames[SimStateP0.currentChar] + '_' + Date.now() + '.json';
  a.click();
  
  URL.revokeObjectURL(url);
  console.log('[simP0ExportConfig] exported');
}

function simP0ImportConfig(e) {
  var file = e.target.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var config = JSON.parse(ev.target.result);
      console.log('[simP0ImportConfig] loaded', config.version);
      
      // 恢复状态
      if (config.currentChar) SimStateP0.currentChar = config.currentChar;
      if (config.equipment) SimStateP0.equipment = config.equipment;
      if (config.equipDataMap) SimStateP0.equipDataMap = config.equipDataMap;
      if (config.runes) SimStateP0.runes = config.runes;
      if (config.pact) SimStateP0.pact = config.pact;
      if (config.elixirs) SimStateP0.elixirs = config.elixirs;
      if (config.paragonNodes) SimStateP0.paragonNodes = config.paragonNodes;
      if (config.skillBar) SimStateP0.skillBar = config.skillBar;
      
      // 重新渲染
      simP0FilterSkills();
      simP0RenderSkillGrid();
      simP0RenderEquipList();
      simP0RenderSkillBar();
      simP0RenderRunePanel();
      simP0RenderPactPanel();
      simP0RenderElixirPanel();
      simP0RenderParagonPanel();
      simP0RenderCharZone();
      
      simP0SaveToStorage();
      alert('配置导入成功！');
    } catch(err) {
      console.error('[simP0ImportConfig] error:', err);
      alert('导入失败：' + err.message);
    }
  };
  reader.readAsText(file);
  
  // 清空 input，允许重复导入同一文件
  e.target.value = '';
}
