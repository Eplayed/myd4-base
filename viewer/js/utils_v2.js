// ============================================================
// utils.js - 工具函数：图标URL、文本处理、颜色
// ============================================================

// 图标子目录 + 扩展名映射（从 d2core.com 实际抓取确认）
const ICON_CONFIG = {
  summon:     { subdir: "summon",     ext: "png", useId: true },
  uniqueItem: { subdir: "uniqueItem", ext: "webp", useId: true },
  aspect:     { subdir: "aspect",     ext: "webp", useId: true },
  skill:      { subdir: "skill",      ext: "png", useId: true },
  gem:        { subdir: "gem",        ext: "png", useId: false }, // gem 使用 key
  rune:       { subdir: "rune",       ext: "webp", useId: true },
  elixir:     { subdir: "elixir",     ext: "png", useId: true },
  affix:      null,   // 词缀无图标
  builds:     null    // 构筑用职业图标
};

function getItemImageUrl(iconId, tab, itemKey) {
  var cfg = ICON_CONFIG[tab];
  if (!cfg) return "";
  var name = cfg.useId ? iconId : itemKey;
  if (!name) return "";
  return ICON_BASE + cfg.subdir + "/" + name + "." + cfg.ext + "?imageView2/2/ignore-error/1/w/100/q/80";
}

// 将 desc 拼接并去掉 {tag} 和 <xml> 标签
// desc 可能是 string（词缀）或 string[]（暗金/召唤/技能）
function parseDescText(desc) {
  if (!desc) return "";
  if (typeof desc === "string") {
    return desc.replace(/\{[^}]+\}/g, "").replace(/<[^>]+>/g, "").trim();
  }
  if (Array.isArray(desc)) {
    return desc
      .map(function(line) {
        return String(line).replace(/\{[^}]+\}/g, "").replace(/<[^>]+>/g, "").trim();
      })
      .filter(function(t) { return t; })
      .join(" ");
  }
  return "";
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
