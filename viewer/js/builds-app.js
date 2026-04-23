// builds-app.js - 构筑列表卡片渲染
(function(){

const BUILDS_CHAR_COLOR = {
  "Paladin":"#f1c40f","野蛮人":"#c0392b","德鲁伊":"#27ae60",
  "死灵法师":"#8e44ad","游侠":"#2980b9","圣骑士":"#f1c40f",
  "巫师":"#9b59b6","魂灵":"#e67e22"
};

const BUILDS_CHAR_ICON = {
  "Paladin":"P","野蛮人":"W","德鲁伊":"D",
  "死灵法师":"N","游侠":"R","圣骑士":"P",
  "巫师":"S","魂灵":"G"
};

const SLOT_NAMES = {
  helm:"头盔",gloves:"手套",legs:"腿部",boots:"靴子",
  amulet:"护符",ring:"戒指",weapon:"武器",offhand:"副手",chest:"胸甲"
};

function buildBuildCard(build,idx){
  var id=build.build_id||("b"+idx);
  var cls=build.class_zh||build.class_en||"";
  var color=BUILDS_CHAR_COLOR[cls]||"#888";
  var icon=BUILDS_CHAR_ICON[cls]||"?";
  var title=build.title||"无标题";
  var season=build.season||"?";
  var likes=build.likes||0;
  var comments=build.comments||0;
  var scenes=(build.scenes_zh||[]).join("");
  var video=build.video||"";
  var link=build.link||"";
  var equipHtml=buildBuildEquipPreview(build.equipment);
  var skillHtml=buildBuildSkillPreview(build.equip_skills);
  var tag="";
  if(scenes) tag+='<span class="bc-tag">'+escHtml(scenes)+"</span>";
  tag+='<span class="bc-tag">S'+escHtml(String(season))+"</span>";
  var stats="";
  if(likes>0||comments>0) stats='<div class="bc-stats"><span>'+likes+'</span><span>'+comments+"</span></div>";
  var links="";
  if(video) links+='<a href="'+escHtml(video)+'" target="_blank" class="bc-link">vid</a>';
  if(link) links+='<a href="'+escHtml(link)+'" target="_blank" class="bc-link">link</a>';
  return '<div class="build-card" data-id="'+id+'" style="border-top:4px solid '+color+'">'+
    '<div class="bc-hdr" style="color:'+color+'">'+icon+" "+escHtml(cls)+"</div>"+
    '<div class="bc-title">'+escHtml(title)+"</div>"+
    '<div class="bc-tags">'+tag+"</div>"+
    '<div class="bc-skill-row">'+skillHtml+"</div>"+
    '<div class="bc-equip-row">'+equipHtml+"</div>"+
    stats+'<div class="bc-links">'+links+"</div></div>";
}

function buildBuildEquipPreview(equip){
  if(!equip||typeof equip!=="object") return"";
  var slots=["helm","gloves","legs","boots","amulet","ring","weapon","offhand","chest"];
  var out=[];
  for(var i=0;i<slots.length;i++){
    var v=equip[slots[i]];
    if(v&&typeof v==="string"&&v.length>0) out.push('<span class="bec-slot">'+escHtml(v)+"</span>");
  }
  return out.join("");
}

function buildBuildSkillPreview(skills){
  if(!skills||!skills.length) return"";
  var out=[];
  for(var i=0;i<skills.length;i++){
    var sk=skills[i];
    var url="https://cloudstorage.d2core.com/data_img/d4/skill/"+(sk.icon||0)+".png";
    var name=sk.name||"";
    var rank=sk.rank>1?(" x"+sk.rank):"";
    out.push('<img src="'+url+'" class="bc-si" title="'+escHtml(name+rank)+'">');
  }
  return out.join("");
}

function openBuildDetail(buildId){
  var build=null;
  if(window.ALL_BUILDS){
    for(var i=0;i<window.ALL_BUILDS.length;i++){
      if((window.ALL_BUILDS[i].build_id||("b"+i))===buildId){build=window.ALL_BUILDS[i];break;}
    }
  }
  if(!build) return;
  var detail=(window.BUILD_DETAILS&&window.BUILD_DETAILS[buildId])||null;
  showBuildDetail(build,detail);
}

function showBuildDetail(build,detail){
  var cls=build.class_zh||build.class_en||"";
  var color=BUILDS_CHAR_COLOR[cls]||"#888";
  var icon=BUILDS_CHAR_ICON[cls]||"?";
  var title=build.title||"无标题";
  var season=build.season||"?";
  var likes=build.likes||0;
  var comments=build.comments||0;
  var video=build.video||"";
  var link=build.link||"";
  injectBdmStyles();
  var id="bdm-box-"+Math.random().toString(36).slice(2);
  var html='<div id="'+id+'" class="bdm-ov">'+
    '<div class="bdm-m">'+
    '<button class="bdm-x" id="'+id+'-close">x</button>'+
    '<div class="bdm-hd" style="border-bottom:3px solid '+color+'">'+
    '<div style="color:'+color+';font-size:18px;font-weight:bold">'+icon+" "+escHtml(cls)+"</div>"+
    '<h2 style="margin:4px 0">'+escHtml(title)+"</h2>"+
    '<div style="color:#aaa;font-size:13px">'+likes+"赞 "+comments+"评 赛季"+escHtml(String(season))+"</div></div>";
  var eq=(detail&&detail.equipment)?detail.equipment:(build.equipment||{});
  var slots=["helm","chest","legs","gloves","boots","amulet","ring","weapon","offhand"];
  html+='<div class="bdm-sec"><h4>装备</h4><div class="bdm-eg">';
  for(var i=0;i<slots.length;i++){
    var sk=slots[i],sn=SLOT_NAMES[sk]||sk;
    var v=eq[sk]||"";
    html+='<div class="bdm-ec"><div class="bdm-sl">'+escHtml(sn)+'</div><div class="bdm-en">'+(v?escHtml(v):'<span style="color:#555">-</span>')+"</div></div>";
  }
  html+="</div></div>";
  var skills=build.equip_skills||[];
  html+='<div class="bdm-sec"><h4>技能</h4>';
  for(var j=0;j<skills.length;j++){
    var s=skills[j];
    var url="https://cloudstorage.d2core.com/data_img/d4/skill/"+(s.icon||0)+".png";
    var mods=(s.mods||[]).join(" / ");
    html+='<div class="bdm-sk">'+
      '<img src="'+url+'" class="bdm-si">'+
      '<div class="bdm-sn">'+escHtml(s.name||"")+(s.rank>1?(" x"+s.rank):"")+"</div>"+
      (mods?('<div class="bdm-sm">'+escHtml(mods)+"</div>"):"")+"</div>";
  }
  html+="</div>";
  html+='<div class="bdm-sec">';
  if(video) html+='<a href="'+escHtml(video)+'" target="_blank" class="bdm-btn">vid</a>';
  if(link) html+='<a href="'+escHtml(link)+'" target="_blank" class="bdm-btn">link</a>';
  html+="</div></div></div>";
  var old=document.querySelector(".bdm-ov");
  if(old) old.remove();
  document.body.insertAdjacentHTML("beforeend",html);
  document.getElementById(id+"-close").onclick=function(){
    var el=document.getElementById(id);
    if(el) el.remove();
  };
  document.getElementById(id).onclick=function(e){
    if(e.target===this) this.remove();
  };
}

function injectBdmStyles(){
  if(document.getElementById("bdm-css")) return;
  var s=document.createElement("style");s.id="bdm-css";
  s.textContent=[
    ".bdm-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}",
    ".bdm-m{background:#1a1a2e;color:#e0e0e0;border-radius:12px;max-width:640px;width:100%;max-height:90vh;overflow-y:auto;padding:24px;position:relative}",
    ".bdm-x{position:absolute;top:12px;right:16px;background:none;border:none;color:#888;font-size:24px;cursor:pointer}",
    ".bdm-hd{margin-bottom:16px}",
    ".bdm-sec{margin-bottom:16px}",
    ".bdm-sec h4{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #333;padding-bottom:4px;margin-bottom:8px}",
    ".bdm-eg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}",
    ".bdm-ec{background:#252540;border-radius:6px;padding:6px 8px}",
    ".bdm-sl{font-size:10px;color:#666;text-transform:uppercase}",
    ".bdm-en{font-size:12px;margin-top:2px;word-break:break-all}",
    ".bdm-sk{display:flex;align-items:center;gap:8px;background:#252540;border-radius:6px;padding:6px 10px;margin-bottom:4px}",
    ".bdm-si{width:32px;height:32px;flex-shrink:0;border-radius:4px}",
    ".bdm-sn{flex:1;font-size:13px}",
    ".bdm-sm{font-size:11px;color:#888}",
    ".bdm-btn{display:inline-block;padding:6px 14px;background:#333;color:#e0e0e0;border-radius:6px;text-decoration:none;font-size:13px;margin-right:8px}",
    ".bc-si{width:28px;height:28px;border-radius:4px;margin:1px;vertical-align:middle}",
    ".bec-slot{display:inline-block;background:#333;color:#ccc;font-size:10px;padding:2px 5px;border-radius:3px;margin:1px}",
    ".bc-tag{display:inline-block;background:#333;color:#aaa;font-size:10px;padding:2px 6px;border-radius:3px;margin-right:3px}",
    ".bc-hdr{font-size:14px;font-weight:bold;margin-bottom:4px}",
    ".bc-title{font-size:13px;margin:4px 0;color:#ddd}",
    ".bc-tags{margin:4px 0}",
    ".bc-skill-row,.bc-equip-row{margin:4px 0}",
    ".bc-stats{color:#888;font-size:12px;margin:4px 0}",
    ".bc-links{margin:4px 0}",
    ".bc-link{color:#6af;font-size:11px;margin-right:8px}"
  ].join("");
  document.head.appendChild(s);
}

window.buildBuildCard=buildBuildCard;
window.openBuildDetail=openBuildDetail;
window.showBuildDetail=showBuildDetail;
window.showBuildDetailModal=showBuildDetail;
})();
