// ============================================================
// skills-app.js - 技能模拟器（整合到 index.html）
// 功能：职业选择 + 技能列表 + 6格技能栏 + 被动技能 + mod分支 + 点数系统
// ============================================================

var SimState = {
  currentChar: 'Barbarian',
  allSkills: [],
  activeSkills: [],
  passiveSkills: [],
  filteredSkills: [],
  selectedSkill: null,
  // 技能栏：6格 [1,2,3,4,L,R]，每格存储 {skill, modId}
  skillBar: [null, null, null, null, null, null],
  // 被动栏：4格，每格存储 {skill, rank}
  passiveBar: [null, null, null, null],
  // 已分配点数
  assignedPoints: 0,
  totalPoints: 71,
  // 当前筛选
  currentFilter: 'all',
  // 弹窗目标
  pickerTarget: null,
  // 是否已初始化
  initialized: false,
  pendingBuild: null
};

// ========== 初始化入口 ==========

// ========== 从构筑加载装备/技能 ==========
function simLoadBuild(build, detail){
  if(!build) return;
  console.log("[simLoadBuild] build:", build.build_id, "detail:", detail ? "has data" : "no detail");
  
  // 1. 设置职业
  var charMap = {"圣骑士":"Paladin","野蛮人":"Barbarian","死灵法师":"Necromancer",
                "游侠":"Rogue","法师":"Sorceress","德鲁伊":"Druid","魂灵":"Spiritborn"};
  var charEn = charMap[build.class_zh] || build.class_en || "Barbarian";
  SimState.currentChar = charEn;
  
  // 2. 加载装备到 SimState.equipment
  SimState.equipment = {};
  var eqData = (detail && detail.equipment) || build._equipment || build.equipment || {};
  if(eqData && typeof eqData === 'object'){
    SimState.equipment = eqData;
  }
  
  // 3. 加载技能到技能栏
  var skillsArr = (detail && detail.skillIcons) || build._skillIcons || build.equip_skills || [];
  // 重置技能栏
  SimState.skillBar = [null, null, null, null, null, null];
  skillsArr.forEach(function(sk, idx){
    if(idx >= 6) return;
    // 兼容两种格式：数字(iconId) 或 对象({name, icon, rank, mods})
    var iconId, skillName;
    if(typeof sk === 'number'){
      iconId = sk;
      skillName = '';
    } else if(sk && typeof sk === 'object'){
      iconId = sk.icon;
      skillName = sk.name || '';
    } else {
      return;
    }
    if(iconId){
      SimState.skillBar[idx] = {skill: {icon: iconId, name: skillName, active: true}, modId: 0};
    }
  });
  
  // 4. 刷新 UI
  simRenderCharGrid();
  simRenderSkillBar();
  simRenderEquipGrid();
  simFilterSkills();
  simRenderSkillGrid();
  simUpdatePoints();
  console.log("[simLoadBuild] done, char:", SimState.currentChar, "equip:", Object.keys(SimState.equipment).length, "skills:", SimState.skillBar.filter(Boolean).length);
}


function initSimulator(skillData) {
  if (SimState.initialized) {
    // 已初始化，只更新数据
    SimState.allSkills = skillData || [];
    simFilterSkills();
    simRenderSkillGrid();
    return;
  }
  
  SimState.allSkills = skillData || [];
  SimState.initialized = true;
  
  // 注入 HTML 结构
  simInjectHTML();
  
  // 绑定事件
  simBindEvents();
  
  // 初始渲染
  simFilterSkills();
  simRenderSkillGrid();
  simRenderSkillBar();
  simRenderPassiveBar();
  simUpdatePoints();
}

// ========== 注入 HTML 结构 ==========
function simInjectHTML() {
  var panel = document.getElementById('simulatorPanel');
  if (!panel) return;
  
  panel.innerHTML = '\
    <div class="sim-layout">\
      <!-- 左侧：职业选择 + 装备栏 + 技能栏 -->\
      <div class="sim-left">\
        <div class="sim-card">\
          <div class="sim-card-title">职业选择</div>\
          <div class="sim-char-grid" id="simCharGrid"></div>\
        </div>\
        <div class="sim-card">\
          <div class="sim-card-title">装备栏</div>\
          <div class="sim-equip-grid" id="simEquipGrid"></div>\
        </div>\
        <div class="sim-card">\
          <div class="sim-card-title">技能栏</div>\
          <div class="sim-skill-bar" id="simSkillBar"></div>\
        </div>\
      </div>\
      <!-- 中间：技能列表 -->\
      <div class="sim-center">\
        <div class="sim-card sim-flex-col">\
          <div class="sim-toolbar">\
            <input type="text" class="sim-search" id="simSearch" placeholder="搜索技能...">\
            <div class="sim-filters" id="simFilters"></div>\
          </div>\
          <div class="sim-skill-grid" id="simSkillGrid"></div>\
        </div>\
      </div>\
      <!-- 右侧：被动 + 药剂 + 符文 -->\
      <div class="sim-right">\
        <div class="sim-card">\
          <div class="sim-card-title">被动技能</div>\
          <div class="sim-passive-grid" id="simPassiveGrid"></div>\
        </div>\
        <div class="sim-card">\
          <div class="sim-card-title">药剂</div>\
          <div class="sim-elixir-grid" id="simElixirGrid"></div>\
        </div>\
        <div class="sim-card">\
          <div class="sim-card-title">点数</div>\
          <div class="sim-points">\
            已分配: <span id="simAssignedPoints">0</span> / \
            剩余: <span id="simRemainingPoints">71</span>\
          </div>\
        </div>\
      </div>\
    </div>\
    <!-- 技能详情弹窗 -->\
    <div class="sim-modal" id="simModal">\
      <div class="sim-modal-content">\
        <div class="sim-modal-header">\
          <div class="sim-modal-icon" id="simModalIcon"></div>\
          <div class="sim-modal-info">\
            <div class="sim-modal-name" id="simModalName"></div>\
            <div class="sim-modal-tags" id="simModalTags"></div>\
          </div>\
          <button class="sim-modal-close" id="simModalClose">×</button>\
        </div>\
        <div class="sim-modal-body" id="simModalBody"></div>\
        <div class="sim-modal-footer" id="simModalFooter"></div>\
      </div>\
    </div>\
    <!-- 技能选择器弹窗 -->\
    <div class="sim-modal" id="simPickerModal">\
      <div class="sim-modal-content sim-picker-content">\
        <div class="sim-modal-header">\
          <input type="text" class="sim-search" id="simPickerSearch" placeholder="搜索...">\
          <button class="sim-modal-close" id="simPickerClose">×</button>\
        </div>\
        <div class="sim-picker-grid" id="simPickerGrid"></div>\
      </div>\
    </div>\
  ';
  
  // 渲染职业选择
  var charGrid = document.getElementById('simCharGrid');
  var chars = ['Barbarian','Druid','Necromancer','Sorcerer','Rogue','Paladin','Spiritborn'];
  var charNames = {Barbarian:'野蛮人',Druid:'德鲁伊',Necromancer:'死灵法师',Sorcerer:'巫师',Rogue:'游侠',Paladin:'圣骑士',Spiritborn:'魂灵'};
  charGrid.innerHTML = chars.map(function(c) {
    var checked = c === SimState.currentChar ? ' checked' : '';
    return '<label class="sim-char-item' + (checked ? ' active' : '') + '">\
      <input type="radio" name="simChar" value="' + c + '"' + checked + '>\
      <span>' + charNames[c] + '</span>\
    </label>';
  }).join('');
  
  // 渲染装备栏（空占位）
  var equipGrid = document.getElementById('simEquipGrid');
  var equipSlots = ['头盔','胸甲','手套','裤子','靴子','主手','副手','护符','戒指1','戒指2'];
  equipGrid.innerHTML = equipSlots.map(function(name) {
    return '<div class="sim-equip-slot"><span>' + name + '</span></div>';
  }).join('');
  
  // 渲染技能栏
  simRenderSkillBar();
  
  // 渲染被动栏
  simRenderPassiveBar();
  
  // 渲染药剂栏
  var elixirGrid = document.getElementById('simElixirGrid');
  elixirGrid.innerHTML = '<div class="sim-elixir-slot">+</div>';
  
  // 渲染筛选按钮
  var filters = document.getElementById('simFilters');
  var filterBtns = [
    {type:'all',label:'全部'},
    {type:'basic',label:'基础'},
    {type:'core',label:'核心'},
    {type:'defensive',label:'防御'},
    {type:'ultimate',label:'终极'},
    {type:'passive',label:'被动'}
  ];
  filters.innerHTML = filterBtns.map(function(f) {
    return '<button class="sim-filter-btn' + (f.type === 'all' ? ' active' : '') + '" data-type="' + f.type + '">' + f.label + '</button>';
  }).join('');
}

// ========== 绑定事件 ==========
function simBindEvents() {
  // 职业选择
  document.getElementById('simCharGrid').addEventListener('change', function(e) {
    if (e.target.name === 'simChar') {
      // 更新样式
      document.querySelectorAll('.sim-char-item').forEach(function(el) {
        el.classList.toggle('active', el.querySelector('input').checked);
      });
      SimState.currentChar = e.target.value;
      simResetBuild();
      simFilterSkills();
      simRenderSkillGrid();
    }
  });
  
  // 筛选按钮
  document.getElementById('simFilters').addEventListener('click', function(e) {
    var btn = e.target.closest('.sim-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.sim-filter-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    SimState.currentFilter = btn.dataset.type;
    simFilterSkills();
    simRenderSkillGrid();
  });
  
  // 搜索
  document.getElementById('simSearch').addEventListener('input', function() {
    simFilterSkills();
    simRenderSkillGrid();
  });
  
  // 技能栏点击
  document.getElementById('simSkillBar').addEventListener('click', function(e) {
    var slot = e.target.closest('.sim-skill-slot');
    if (!slot) return;
    var idx = parseInt(slot.dataset.idx, 10);
    if (SimState.skillBar[idx]) {
      // 已有技能，显示详情
      simShowSkillDetail(SimState.skillBar[idx].skill, SimState.skillBar[idx].modId);
    } else {
      // 空槽，打开选择器
      simOpenPicker(idx, 'active');
    }
  });
  
  // 被动栏点击
  document.getElementById('simPassiveGrid').addEventListener('click', function(e) {
    var slot = e.target.closest('.sim-passive-slot');
    if (!slot) return;
    var idx = parseInt(slot.dataset.idx, 10);
    if (SimState.passiveBar[idx]) {
      simShowSkillDetail(SimState.passiveBar[idx].skill);
    } else {
      simOpenPicker(idx, 'passive');
    }
  });
  
  // 技能列表点击
  document.getElementById('simSkillGrid').addEventListener('click', function(e) {
    var card = e.target.closest('.sim-skill-card');
    if (!card) return;
    var idx = parseInt(card.dataset.idx, 10);
    var skill = SimState.filteredSkills[idx];
    simShowSkillDetail(skill);
  });
  
  // 弹窗关闭
  document.getElementById('simModalClose').addEventListener('click', simCloseModal);
  document.getElementById('simModal').addEventListener('click', function(e) {
    if (e.target.id === 'simModal') simCloseModal();
  });
  
  // 选择器弹窗
  document.getElementById('simPickerClose').addEventListener('click', simClosePicker);
  document.getElementById('simPickerModal').addEventListener('click', function(e) {
    if (e.target.id === 'simPickerModal') simClosePicker();
  });
  document.getElementById('simPickerSearch').addEventListener('input', function() {
    var q = this.value.toLowerCase();
    var list = (SimState.pickerTarget && SimState.pickerTarget.type === 'passive') 
      ? SimState.passiveSkills : SimState.activeSkills;
    var filtered = list.filter(function(s) {
      if (!q) return true;
      return (s.name||'').toLowerCase().indexOf(q) >= 0 
        || (s.engName||'').toLowerCase().indexOf(q) >= 0;
    });
    simRenderPickerGrid(filtered);
  });
  
  // 选择器列表点击
  document.getElementById('simPickerGrid').addEventListener('click', function(e) {
    var item = e.target.closest('.sim-picker-item');
    if (!item) return;
    var idx = parseInt(item.dataset.idx, 10);
    var list = (SimState.pickerTarget && SimState.pickerTarget.type === 'passive') 
      ? SimState.passiveSkills : SimState.activeSkills;
    var skill = list[idx];
    simPickSkill(skill);
  });
}

// ========== 重置构筑 ==========
function simResetBuild() {
  SimState.skillBar = [null, null, null, null, null, null];
  SimState.passiveBar = [null, null, null, null];
  SimState.assignedPoints = 0;
  simRenderSkillBar();
  simRenderPassiveBar();
  simUpdatePoints();
}

// ========== 筛选技能 ==========
function simFilterSkills() {
  var q = (document.getElementById('simSearch').value || '').toLowerCase();
  var f = SimState.currentFilter;
  var c = SimState.currentChar;
  var active = [], passive = [], all = [];
  
  SimState.allSkills.forEach(function(s) {
    if (s.char !== c) return;
    
    var tags = s.tags || [];
    var ok = (f === 'all');
    if (!ok) {
      switch(f) {
        case 'basic': ok = tags.indexOf('基础') >= 0; break;
        case 'core': ok = tags.indexOf('核心') >= 0; break;
        case 'defensive': ok = tags.indexOf('防御') >= 0 || tags.indexOf('防御技能') >= 0; break;
        case 'ultimate': ok = tags.indexOf('终极') >= 0 || tags.indexOf('终极技能') >= 0; break;
        case 'passive': ok = !s.active; break;
      }
    }
    if (!ok) return;
    
    if (q) {
      var n = (s.name||'').toLowerCase();
      var en = (s.engName||'').toLowerCase();
      if (n.indexOf(q) < 0 && en.indexOf(q) < 0) return;
    }
    
    if (s.active) active.push(s); else passive.push(s);
    all.push(s);
  });
  
  SimState.activeSkills = active;
  SimState.passiveSkills = passive;
  SimState.filteredSkills = all;
}

// ========== 渲染技能列表 ==========
function simRenderSkillGrid() {
  var grid = document.getElementById('simSkillGrid');
  if (!grid) return;
  
  var html = SimState.filteredSkills.map(function(s, i) {
    var icon = simGetIconUrl(s.icon);
    var tags = (s.tags || []).slice(0, 2).map(function(t) {
      return '<span class="sim-tag">' + simEsc(t) + '</span>';
    }).join(' ');
    var typeClass = s.active ? 'sim-skill-active' : 'sim-skill-passive';
    return '<div class="sim-skill-card ' + typeClass + '" data-idx="' + i + '">\
      <img class="sim-skill-icon" src="' + icon + '" onerror="this.style.opacity=0.3">\
      <div class="sim-skill-name">' + simEsc(s.name || '') + '</div>\
      <div class="sim-skill-tags">' + tags + '</div>\
    </div>';
  }).join('');
  
  grid.innerHTML = html || '<div class="sim-empty">无匹配技能</div>';
}

// ========== 渲染职业选择网格 ==========
function simRenderCharGrid() {
  var grid = document.getElementById('simCharGrid');
  if (!grid) return;
  var chars = [
    {en:'Barbarian',zh:'野蛮人'},
    {en:'Sorceress',zh:'法师'},
    {en:'Rogue',zh:'游侠'},
    {en:'Necromancer',zh:'死灵法师'},
    {en:'Druid',zh:'德鲁伊'},
    {en:'Spiritborn',zh:'魂灵'},
    {en:'Paladin',zh:'圣骑士'}
  ];
  var html = chars.map(function(ch) {
    var checked = SimState.currentChar === ch.en ? 'checked' : '';
    var active = SimState.currentChar === ch.en ? ' active' : '';
    return '<label class="sim-char-item' + active + '">' +
      '<input type="radio" name="simChar" value="' + ch.en + '" ' + checked + '>' +
      '<span>' + ch.zh + '</span></label>';
  }).join('');
  grid.innerHTML = html;
}

// ========== 渲染装备栏 ==========
function simRenderEquipGrid() {
  var grid = document.getElementById('simEquipGrid');
  if (!grid) return;
  var slots = ['头盔','手套','护腿','靴子','护符','戒指1','武器','副手','戒指2'];
  var slotKeys = ['helm','gloves','legs','boots','amulet','ring','weapon','offhand','ring2'];
  var html = slots.map(function(name, idx) {
    var key = slotKeys[idx];
    var item = SimState.equipment ? SimState.equipment[key] : '';
    var itemName = (item && item.name) ? item.name : (item || '');
    return '<div class="sim-equip-slot" data-slot="' + key + '" title="' + simEsc(itemName || name) + '">' +
      '<span class="sim-equip-label">' + name + '</span>' +
      (itemName ? '<span class="sim-equip-name">' + simEsc(itemName) + '</span>' : '') +
    '</div>';
  }).join('');
  grid.innerHTML = html;
}

// ========== 渲染技能栏 ==========
function simRenderSkillBar() {
  var bar = document.getElementById('simSkillBar');
  if (!bar) return;
  
  var keys = ['1','2','3','4','L','R'];
  var html = keys.map(function(key, idx) {
    var item = SimState.skillBar[idx];
    if (item) {
      var icon = simGetIconUrl(item.skill.icon);
      return '<div class="sim-skill-slot filled" data-idx="' + idx + '">\
        <span class="sim-slot-key">' + key + '</span>\
        <img class="sim-slot-icon" src="' + icon + '" onerror="this.style.opacity=0.3">\
        <button class="sim-slot-remove" data-idx="' + idx + '">×</button>\
      </div>';
    } else {
      return '<div class="sim-skill-slot" data-idx="' + idx + '">\
        <span class="sim-slot-key">' + key + '</span>\
        <span class="sim-slot-empty">+</span>\
      </div>';
    }
  }).join('');
  
  bar.innerHTML = html;
  
  // 绑定移除按钮
  bar.querySelectorAll('.sim-slot-remove').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var idx = parseInt(btn.dataset.idx, 10);
      SimState.skillBar[idx] = null;
      simRenderSkillBar();
      simUpdatePoints();
    });
  });
}

// ========== 渲染被动栏 ==========
function simRenderPassiveBar() {
  var grid = document.getElementById('simPassiveGrid');
  if (!grid) return;
  
  var html = '';
  for (var i = 0; i < 4; i++) {
    var item = SimState.passiveBar[i];
    if (item) {
      var icon = simGetIconUrl(item.skill.icon);
      html += '<div class="sim-passive-slot filled" data-idx="' + i + '">\
        <img class="sim-slot-icon" src="' + icon + '" onerror="this.style.opacity=0.3">\
        <button class="sim-slot-remove" data-idx="' + i + '">×</button>\
      </div>';
    } else {
      html += '<div class="sim-passive-slot" data-idx="' + i + '">\
        <span class="sim-slot-empty">+</span>\
      </div>';
    }
  }
  
  grid.innerHTML = html;
  
  // 绑定移除按钮
  grid.querySelectorAll('.sim-slot-remove').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var idx = parseInt(btn.dataset.idx, 10);
      SimState.passiveBar[idx] = null;
      simRenderPassiveBar();
      simUpdatePoints();
    });
  });
}

// ========== 更新点数 ==========
function simUpdatePoints() {
  var activeCount = SimState.skillBar.filter(function(x) { return !!x; }).length;
  var passiveCount = SimState.passiveBar.filter(function(x) { return !!x; }).length;
  SimState.assignedPoints = activeCount + passiveCount;
  
  var assignedEl = document.getElementById('simAssignedPoints');
  var remainingEl = document.getElementById('simRemainingPoints');
  if (assignedEl) assignedEl.textContent = SimState.assignedPoints;
  if (remainingEl) remainingEl.textContent = SimState.totalPoints - SimState.assignedPoints;
}

// ========== 显示技能详情 ==========
function simShowSkillDetail(skill, currentModId) {
  var modal = document.getElementById('simModal');
  if (!modal) return;
  
  // 图标
  document.getElementById('simModalIcon').innerHTML = 
    '<img src="' + simGetIconUrl(skill.icon) + '" style="width:64px;height:64px;border-radius:8px;">';
  
  // 名称
  document.getElementById('simModalName').textContent = skill.name || '';
  
  // 标签
  var tags = (skill.tags || []).map(function(t) {
    return '<span class="sim-tag">' + simEsc(t) + '</span>';
  }).join(' ');
  document.getElementById('simModalTags').innerHTML = tags;
  
  // 描述
  var descHtml = '';
  if (Array.isArray(skill.desc)) {
    descHtml = skill.desc.map(function(line) {
      return '<div class="sim-desc-line">' + simFormatDesc(line) + '</div>';
    }).join('');
  }
  
  // Mod 分支
  var modsHtml = '';
  if (skill.active && skill.mods && skill.mods.length > 0) {
    modsHtml = '<div class="sim-mods-title">分支选择</div>\
      <div class="sim-mods-list">';
    skill.mods.forEach(function(mod) {
      var selected = (mod.modId === currentModId) ? ' selected' : '';
      modsHtml += '<div class="sim-mod-item' + selected + '" data-mod-id="' + mod.modId + '">\
        <div class="sim-mod-name">' + simEsc(mod.name) + '</div>\
        <div class="sim-mod-desc">' + (Array.isArray(mod.desc) 
          ? mod.desc.map(function(l) { return simFormatDesc(l); }).join('<br>') 
          : '') + '</div>\
      </div>';
    });
    modsHtml += '</div>';
  }
  
  document.getElementById('simModalBody').innerHTML = descHtml + modsHtml;
  
  // 底部操作按钮
  var footerHtml = '';
  if (skill.active) {
    footerHtml = '<button class="sim-btn sim-btn-primary" id="simAddToBar">添加到技能栏</button>';
  } else {
    footerHtml = '<button class="sim-btn sim-btn-primary" id="simAddToPassive">添加到被动栏</button>';
  }
  document.getElementById('simModalFooter').innerHTML = footerHtml;
  
  // 绑定添加按钮
  var addBtn = document.getElementById('simAddToBar') || document.getElementById('simAddToPassive');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      simAddSkillToBar(skill);
    });
  }
  
  // 绑定 mod 选择
  modal.querySelectorAll('.sim-mod-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var modId = parseInt(item.dataset.modId, 10);
      // 更新技能栏中该技能的 modId
      for (var i = 0; i < SimState.skillBar.length; i++) {
        if (SimState.skillBar[i] && SimState.skillBar[i].skill.id === skill.id) {
          SimState.skillBar[i].modId = modId;
          break;
        }
      }
      // 更新 UI
      modal.querySelectorAll('.sim-mod-item').forEach(function(el) {
        el.classList.toggle('selected', el.dataset.modId == modId);
      });
    });
  });
  
  modal.classList.add('active');
}

// ========== 添加技能到栏 ==========
function simAddSkillToBar(skill) {
  var idx = -1;
  if (skill.active) {
    // 找空技能栏
    for (var i = 0; i < SimState.skillBar.length; i++) {
      if (!SimState.skillBar[i]) { idx = i; break; }
    }
    if (idx < 0) { alert('技能栏已满'); return; }
    // 默认选第一个 mod
    var modId = (skill.mods && skill.mods.length > 0) ? skill.mods[0].modId : 0;
    SimState.skillBar[idx] = { skill: skill, modId: modId };
    simRenderSkillBar();
  } else {
    // 找空被动栏
    for (var i = 0; i < SimState.passiveBar.length; i++) {
      if (!SimState.passiveBar[i]) { idx = i; break; }
    }
    if (idx < 0) { alert('被动栏已满'); return; }
    SimState.passiveBar[idx] = { skill: skill, rank: 1 };
    simRenderPassiveBar();
  }
  simUpdatePoints();
  simCloseModal();
}

// ========== 打开选择器 ==========
function simOpenPicker(idx, type) {
  SimState.pickerTarget = { index: idx, type: type };
  
  var title = type === 'passive' ? '选择被动技能' : '选择主动技能';
  var list = type === 'passive' ? SimState.passiveSkills : SimState.activeSkills;
  
  document.getElementById('simPickerSearch').value = '';
  simRenderPickerGrid(list);
  document.getElementById('simPickerModal').classList.add('active');
}

// ========== 渲染选择器列表 ==========
function simRenderPickerGrid(list) {
  var grid = document.getElementById('simPickerGrid');
  if (!grid) return;
  
  var html = list.map(function(s, i) {
    var icon = simGetIconUrl(s.icon);
    return '<div class="sim-picker-item" data-idx="' + i + '">\
      <img class="sim-picker-icon" src="' + icon + '" onerror="this.style.opacity=0.3">\
      <div class="sim-picker-name">' + simEsc(s.name || '') + '</div>\
    </div>';
  }).join('');
  
  grid.innerHTML = html || '<div class="sim-empty">无匹配</div>';
}

// ========== 选择技能 ==========
function simPickSkill(skill) {
  var t = SimState.pickerTarget;
  if (!t) return;
  
  var idx = t.index;
  if (idx < 0) idx = simFindEmptySlot(t.type);
  if (idx < 0) { alert('没有空槽位'); return; }
  
  if (t.type === 'active') {
    var modId = (skill.mods && skill.mods.length > 0) ? skill.mods[0].modId : 0;
    SimState.skillBar[idx] = { skill: skill, modId: modId };
    simRenderSkillBar();
  } else {
    SimState.passiveBar[idx] = { skill: skill, rank: 1 };
    simRenderPassiveBar();
  }
  simUpdatePoints();
  simClosePicker();
}

// ========== 找空槽位 ==========
function simFindEmptySlot(type) {
  var arr = type === 'active' ? SimState.skillBar : SimState.passiveBar;
  for (var i = 0; i < arr.length; i++) {
    if (!arr[i]) return i;
  }
  return -1;
}

// ========== 关闭弹窗 ==========
function simCloseModal() {
  var modal = document.getElementById('simModal');
  if (modal) modal.classList.remove('active');
}

function simClosePicker() {
  var modal = document.getElementById('simPickerModal');
  if (modal) modal.classList.remove('active');
  SimState.pickerTarget = null;
}

// ========== 工具函数 ==========
function simGetIconUrl(iconId) {
  if (!iconId) return '';
  return 'https://cloudstorage.d2core.com/data_img/d4/skill/' + iconId + '.png?imageView2/2/ignore-error/1/w/100/q/80';
}

function simEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function simFormatDesc(line) {
  if (!line) return '';
  // 移除 {c_xxx} 标签，保留内容
  return line
    .replace(/\{c_label\}([^{]*)\{\/c\}/g, '<span class="sim-c-label">$1</span>')
    .replace(/\{c_important\}([^{]*)\{\/c\}/g, '<span class="sim-c-important">$1</span>')
    .replace(/\{c_number\}([^{]*)\{\/c\}/g, '<span class="sim-c-number">$1</span>')
    .replace(/\{c_resource\}([^{]*)\{\/c\}/g, '<span class="sim-c-resource">$1</span>')
    .replace(/\{[^}]+\}/g, '');
}
