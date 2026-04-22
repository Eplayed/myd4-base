// ================= d2core风格技能系统 =================
var gState = {
    currentChar: 'Barbarian',
    allSkills: [],
    filteredSkills: [],
    activeSkills: [],
    passiveSkills: [],
    selectedSkill: null,
    skillBar: [null, null, null, null, null, null],
    passiveBar: [null, null, null, null],
    assignedPoints: 0,
    totalPoints: 71,
    currentFilter: 'all',
    pickerTarget: null
};

async function init() {
    await loadSkills();
    bindEvents();
    filterSkills();
    renderSkillGrid();
}

async function loadSkills() {
    try {
        var resp = await fetch('data/skills_zhCN.json');
        if (resp.ok) gState.allSkills = await resp.json();
    } catch(e) {
        try {
            var resp2 = await fetch('../data/skills_zhCN.json');
            if (resp2.ok) gState.allSkills = await resp2.json();
        } catch(e2) {}
    }
}

function bindEvents() {
    // Tab 切换
    document.querySelectorAll('.tab-bar .tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            var t = tab.dataset.tab;
            var center = document.getElementById('skillCenter');
            center.style.display = (t === 'skills' || t === 'overview') ? 'block' : 'none';
        });
    });

    // 职业选择
    document.querySelectorAll('.char-radio input').forEach(function(r) {
        r.addEventListener('change', function() {
            gState.currentChar = r.value;
            resetBuild();
            filterSkills();
            renderSkillGrid();
        });
    });

    // 筛选按钮
    document.querySelectorAll('.skill-filters .filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            gState.currentFilter = btn.dataset.type;
            filterSkills();
            renderSkillGrid();
        });
    });

    // 搜索
    document.getElementById('skillSearch').addEventListener('input', function() { filterSkills(); renderSkillGrid(); });

    // 技能栏点击
    document.querySelectorAll('.skill-bar-bottom .skill-slot').forEach(function(slot, idx) {
        slot.addEventListener('click', function() {
            if (gState.skillBar[idx]) { showSkillDetail(gState.skillBar[idx]); }
            else { openPicker(idx, 'active'); }
        });
    });

    // 被动栏点击
    document.querySelectorAll('.passive-grid .passive-slot').forEach(function(slot, idx) {
        slot.addEventListener('click', function() {
            if (gState.passiveBar[idx]) { showSkillDetail(gState.passiveBar[idx]); }
            else { openPicker(idx, 'passive'); }
        });
    });

    // 弹窗关闭
    document.getElementById('modalClose').addEventListener('click', closePicker);
    document.getElementById('skillModal').addEventListener('click', function(e) { if (e.target.id === 'skillModal') closePicker(); });
    document.getElementById('modalSearch').addEventListener('input', function() {
        var q = this.value.toLowerCase();
        var list = (gState.pickerTarget && gState.pickerTarget.type === 'passive') ? gState.passiveSkills : gState.activeSkills;
        var filtered = list.filter(function(s) {
            if (!q) return true;
            var n = (s.name||'').toLowerCase();
            var en = (s.engName||'').toLowerCase();
            return n.indexOf(q)>=0 || en.indexOf(q)>=0;
        });
        renderPickerGrid(filtered);
    });
}

function resetBuild() {
    gState.skillBar = [null, null, null, null, null, null];
    gState.passiveBar = [null, null, null, null];
    gState.assignedPoints = 0;
    renderSkillBar(); renderPassiveBar(); updatePoints();
}

function filterSkills() {
    var q = document.getElementById('skillSearch').value.toLowerCase();
    var f = gState.currentFilter;
    var c = gState.currentChar;
    var active = []; var passive = []; var all = [];

    gState.allSkills.forEach(function(s) {
        if (s.char !== c) return;
        var tags = s.tags || [];
        var ok = (f==='all');
        if (!ok) {
            switch(f) {
                case 'basic': ok = tags.indexOf('基础')>=0; break;
                case 'core': ok = tags.indexOf('核心')>=0; break;
                case 'defensive': ok = tags.indexOf('防御')>=0; break;
                case 'ultimate': ok = tags.indexOf('终极')>=0 || tags.indexOf('终极技能')>=0; break;
                case 'passive': ok = !s.active; break;
            }
        }
        if (!ok) return;

        if (q) {
            var n = (s.name||'').toLowerCase();
            var en = (s.engName||'').toLowerCase();
            if (n.indexOf(q)<0 && en.indexOf(q)<0) return;
        }

        if (s.active) active.push(s); else passive.push(s);
        all.push(s);
    });

    gState.activeSkills = active;
    gState.passiveSkills = passive;
    gState.filteredSkills = all;
}

function renderSkillGrid() {
    var el = document.getElementById('skillListGrid');
    var html = '';
    gState.filteredSkills.forEach(function(s, i) {
        var icon = getIconUrl(s.icon);
        var tags = (s.tags||[]).slice(0,2).map(function(t) { return '<span>'+esc(t)+'</span>'; }).join(' ');
        html += '<div class="skill-card" data-idx="'+i+'" data-id="'+s.id+'">'+
            '<img class="skill-icon" src="'+icon+'" alt="" onerror="this.style.opacity=0.2">'+
            '<div class="skill-name">'+esc(s.name||'')+'</div>'+
            '<div class="skill-tags">'+tags+'</div>'+
        '</div>';
    });
    el.innerHTML = html;

    el.querySelectorAll('.skill-card').forEach(function(card, i) {
        card.addEventListener('click', function() {
            var skill = gState.filteredSkills[i];
            selectSkill(skill);
        });
    });
}

function selectSkill(s) {
    gState.selectedSkill = s;
    document.querySelectorAll('.skill-card').forEach(function(c) {
        c.classList.toggle('selected', c.dataset.id == s.id);
    });
    showSkillDetail(s);
}

function showSkillDetail(s) {
    // 简单弹窗或右侧面板，这里直接打开选择器让用户添加
    openPicker(-1, s.active ? 'active' : 'passive', s);
}

function openPicker(idx, type, preselect) {
    gState.pickerTarget = {index: idx, type: type};
    document.getElementById('modalTitle').textContent = type === 'passive' ? '选择被动' : '选择技能';
    var list = type === 'passive' ? gState.passiveSkills : gState.activeSkills;
    document.getElementById('modalSearch').value = '';
    renderPickerGrid(list);
    document.getElementById('skillModal').classList.add('active');
}

function renderPickerGrid(list) {
    var el = document.getElementById('modalGrid');
    var html = '';
    list.forEach(function(s, i) {
        var icon = getIconUrl(s.icon);
        html += '<div class="picker-item" data-idx="'+i+'">'+
            '<img class="picker-icon" src="'+icon+'" alt="" onerror="this.style.opacity=0.2">'+
            '<div class="picker-name">'+esc(s.name||'')+'</div>'+
        '</div>';
    });
    el.innerHTML = html;

    el.querySelectorAll('.picker-item').forEach(function(item, i) {
        item.addEventListener('click', function() {
            var skill = list[i];
            pickSkill(skill);
        });
    });
}

function pickSkill(skill) {
    var t = gState.pickerTarget;
    if (!t) return;
    var idx = t.index;

    if (idx < 0) idx = findEmptySlot(t.type);
    if (idx < 0) { alert('没有空槽位'); return; }

    if (t.type === 'active') {
        gState.skillBar[idx] = skill;
        renderSkillBar();
    } else {
        gState.passiveBar[idx] = skill;
        renderPassiveBar();
    }
    gState.assignedPoints = gState.skillBar.filter(function(x){return !!x}).length + gState.passiveBar.filter(function(x){return !!x}).length;
    updatePoints();
    closePicker();
}

function closePicker() {
    document.getElementById('skillModal').classList.remove('active');
    gState.pickerTarget = null;
}

function findEmptySlot(type) {
    var arr = type === 'active' ? gState.skillBar : gState.passiveBar;
    for (var i = 0; i < arr.length; i++) if (!arr[i]) return i;
    return -1;
}

function renderSkillBar() {
    document.querySelectorAll('.skill-bar-bottom .skill-slot').forEach(function(slot, idx) {
        var s = gState.skillBar[idx];
        if (s) {
            slot.classList.add('filled');
            var icon = getIconUrl(s.icon);
            slot.innerHTML = '<span class="slot-key">'+(idx<4?(idx+1):(idx===4?'L':'R'))+'</span>'+
                '<img class="slot-icon" src="'+icon+'" alt="" onerror="this.style.opacity=0.2">'+
                '<button class="slot-remove" onclick="removeSlot('+idx+',\'active\')">×</button>';
        } else {
            slot.classList.remove('filled');
            slot.innerHTML = '<span class="slot-key">'+(idx<4?(idx+1):(idx===4?'L':'R'))+'</span>'+
                '<span class="slot-empty">+</span>';
        }
    });
}

function renderPassiveBar() {
    document.querySelectorAll('.passive-grid .passive-slot').forEach(function(slot, idx) {
        var s = gState.passiveBar[idx];
        if (s) {
            slot.classList.add('filled');
            var icon = getIconUrl(s.icon);
            slot.innerHTML = '<img class="slot-icon" src="'+icon+'" alt="" onerror="this.style.opacity=0.2">'+
                '<button class="slot-remove" onclick="removeSlot('+idx+',\'passive\')">×</button>';
        } else {
            slot.classList.remove('filled');
            slot.innerHTML = '<span class="slot-empty">+</span>';
        }
    });
}

function removeSlot(idx, type) {
    if (type === 'active') {
        gState.skillBar[idx] = null; renderSkillBar();
    } else {
        gState.passiveBar[idx] = null; renderPassiveBar();
    }
    gState.assignedPoints = gState.skillBar.filter(function(x){return !!x}).length + gState.passiveBar.filter(function(x){return !!x}).length;
    updatePoints();
    event.stopPropagation();
}

function updatePoints() {
    document.getElementById('assignedPoints').textContent = gState.assignedPoints;
    document.getElementById('remainingPoints').textContent = gState.totalPoints - gState.assignedPoints;
}

function getIconUrl(id) {
    if (!id) return '';
    return 'https://cloudstorage.d2core.com/data_img/d4/skill/' + id + '.png?imageView2/2/ignore-error/1/w/100/q/80';
}

function esc(s) { if (s == null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

document.addEventListener('DOMContentLoaded', init);
