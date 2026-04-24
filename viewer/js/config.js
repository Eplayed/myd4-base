// ============================================================
// config.js - 全局配置：tabs、数据路径、常量映射
// ============================================================

const TAB_CONFIGS = {
  summon: {
    label: "召唤", icon: "skull",
    dataFile: "../data/summon_zhCN.json", cardType: "summon"
  },
  uniqueItem: {
    label: "暗金", icon: "star",
    dataFile: "../data/uniqueItem_zhCN.json", cardType: "uniqueItem"
  },
  aspect: {
    label: "威能", icon: "sword",
    dataFile: "../data/aspect_zhCN.json", cardType: "aspect"
  },
  affix: {
    label: "词缀", icon: "sparkles",
    dataFile: "../data/affix_zhCN.json", cardType: "affix"
  },
  skill: {
    label: "技能", icon: "zap",
    dataFile: "../data/skills_zhCN.json", cardType: "skill"
  },
  gem: {
    label: "宝石", icon: "gem",
    dataFile: "../data/gem_zhCN.json", cardType: "gem"
  },
  rune: {
    label: "符文", icon: "rune",
    dataFile: "../data/rune_zhCN.json", cardType: "rune"
  },
  elixir: {
    label: "药剂", icon: "elixir",
    dataFile: "../data/elixir_zhCN.json", cardType: "elixir"
  },
  builds: {
    label: "构筑", icon: "builds",
    dataFile: "data/d4_builds_final_v2.json", cardType: "build"
  },
  simulator: {
    label: "模拟器", icon: "simulator",
    dataFile: "data/skills_zhCN.json", cardType: "simulator"
  }
};

// 职业映射
const CHAR_MAP = {
  Barbarian: "野蛮人", Druid: "德鲁伊",
  Necromancer: "死灵法师", Sorcerer: "巫师",
  Rogue: "游侠", Paladin: "圣骑士", Spiritborn: "魂灵"
};

// 图标基地址
const ICON_BASE = "https://cloudstorage.d2core.com/data_img/d4/";

// 职业颜色
const CHAR_COLOR = {
  野蛮人: "#c0392b", 德鲁伊: "#27ae60",
  死灵法师: "#8e44ad", 巫师: "#2980b9",
  游侠: "#f39c12", 圣骑士: "#f1c40f", 魂灵: "#e67e22"
};

// 装备类型颜色
const TYPE_COLOR = {
  胸甲: "#3498db", 头盔: "#e67e22",
  护符: "#f1c40f", 戒指: "#9b59b6",
  靴子: "#1abc9c", 手套: "#e74c3c",
  裤子: "#95a5a6", 盾牌: "#2c3e50",
  单手剑: "#3498db", 双手剑: "#2c3e50",
  单手斧: "#c0392b", 双手斧: "#c0392b",
  长柄: "#8e44ad", 法杖: "#2980b9"
};

// 词缀类型映射
const ITEM_TYPE_MAP = {
  Helm: "头盔", ChestArmor: "胸甲", Legs: "裤子", Gloves: "手套",
  Boots: "靴子", Amulet: "护符", Ring: "戒指", Shield: "盾牌",
  ShieldHTH: "盾", Ring2: "戒指2", Amulet2: "护符2",
  Axe: "单手斧", Axe2H: "双手斧", Bow: "弓", Crossbow: "弩",
  Crossbow2H: "双手弩", Dagger: "匕首", DaggerOffHand: "匕首副手",
  Mace: "钉锤", Mace2H: "双手钉锤", Mace2HDruid: "德鲁伊钉锤",
  Polearm: "长柄", Quarterstaff: "长杖", Scythe: "镰刀",
  Scythe2H: "双手镰刀", Staff: "法杖", StaffDruid: "德鲁伊杖",
  StaffSorcerer: "巫师杖", Sword: "单手剑", Sword2H: "双手剑",
  Wand: "魔杖", Glaive: "剑刃戟", Flail: "连枷",
  DruidOffhand: "德鲁伊副手", Focus: "聚能器",
  FocusBookOffHand: "副手书"
};
