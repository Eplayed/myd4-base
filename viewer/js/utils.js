// ============================================================
// utils.js - 工具函数：图标URL、文本处理、颜色
// ============================================================

// 召唤物/暗金/威能/技能/宝石/符文/药剂 图标URL
const ICON_SUBDIR = {
  summon: "summon", uniqueItem: "unique", aspect: "aspect",
  skill: "skill", gem: "gem", rune: "rune", elixir: "elixir",
  affix: "unique", builds: "unique"
};

function getItemImageUrl(iconId, tab) {
  if (!iconId) return "";
  var subDir = ICON_SUBDIR[tab] || "unique";
  return ICON_BASE + subDir + "/" + iconId + ".png?imageView2/2/ignore-error/1/w/100/q/80";
}

// 将 desc[] 数组拼接并去掉 {tag} 和 <xml> 标签
function parseDescText(descArray) {
  if (!descArray) return "";
  return descArray
    .map(function(line) {
      return line.replace(/\{[^}]+\}/g, "").replace(/<[^>]+>/g, "").trim();
    })
    .filter(function(t) { return t; })
    .join(" ");
}

// 带颜色的 desc 展示
function parseColoredDesc(descStr) {
  if (!descStr) return "";
  return descStr
    .replace(/\{c_random\}/g, '<span class="c_random">')
    .replace(/\{\/c\}/g, '</span>')
    .replace(/\{c_unique\}/g, '<span class="c_unique">')
    .replace(/\{c_important\}/g, '<span class="c_important">')
    .replace(/\{c_pickups\}/g, '<span class="c_pickups">')
    .replace(/\{c_number\}/g, '<span class="c_number">')
    .replace(/\[(\d+(\.\d+)?\s*-\s*\d+(\.\d+)?)\]/g, '<span class="c_random">[$1]</span>')
    .replace(/(\[\d+\s*-\s*\d+])/g, '<span class="c_random">$1</span>');
}

// 获取职业标签颜色
function getClassColor(className) {
  return CHAR_COLOR[className] || "#8b8b96";
}

function getTypeColor(typeName) {
  return TYPE_COLOR[typeName] || "#8b8b96";
}

// 格式化日期（相对时间）
function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  var d = new Date(dateStr);
  var now = new Date();
  var diff = now - d;
  var days = Math.floor(diff / 86400000);
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return days + " 天前";
  var months = Math.floor(days / 30);
  if (months < 12) return months + " 个月前";
  return Math.floor(months / 12) + " 年前";
}
