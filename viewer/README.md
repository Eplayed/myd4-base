# D4 暗金装备图鉴 - 查看器

## 功能改进

本次更新解决了以下问题：

### 1. 修复数据加载问题
- ✅ 优化了数据加载逻辑
- ✅ 添加了加载状态提示
- ✅ 改进了错误处理

### 2. 新增筛选查询功能
- 🔽 **职业筛选** - 按职业（野蛮人、德鲁伊、死灵法师、巫师、游侠、圣骑士、灵巫）筛选
- 🔽 **装备类型筛选** - 按装备类型（护符、头盔、胸甲、靴子、手套、裤子、戒指、武器等）筛选
- 🔽 **掉落BOSS筛选** - 按掉落BOSS（Duriel、Andariel、Varshan、Lord Zir等）筛选
- 🔍 **全文搜索** - 支持按装备名称、词缀描述等关键词搜索

### 3. 添加装备图片显示
- ✅ 每件装备卡片显示对应的物品图标
- ✅ 图片加载失败时显示占位图标
- ✅ 支持神话装备（金色边框）特殊样式

### 4. 其他改进
- ✅ 暗金/神话装备金色边框高亮
- ✅ 详细的装备详情弹窗
- ✅ 掉落BOSS标签显示
- ✅ 响应式布局适配

## 运行方式

### 方式一：本地服务器（推荐）
```bash
cd ~/Documents/work/myd4-base/viewer
python3 -m http.server 8080
# 然后打开浏览器访问 http://localhost:8080
```

### 方式二：直接打开
```bash
open ~/Documents/work/myd4-base/viewer/index.html
```

### 方式三：VS Code Live Server
在 viewer 文件夹上右键选择 "Open with Live Server"

## 目录结构

```
myd4-base/
├── data/
│   └── uniqueItem_zhCN.json    # 暗金装备数据（211件）
├── viewer/
│   ├── index.html              # 主页面
│   └── README.md               # 本说明文件
├── d4_builds_final_v2.json     # 热门构筑数据
├── builds_detail_100.json       # 构筑详情数据
├── d4_core_data.json           # 游戏基础索引
└── README.md                   # 项目总说明
```

## 截图预览

主要界面包含：
- 顶部标题栏 + 赛季标识
- 筛选工具栏（职业/装备类型/BOSS下拉选择 + 搜索框 + 重置按钮）
- 装备卡片网格（图片 + 名称 + 类型标签 + BOSS标签）
- 点击卡片展开详情弹窗

## 数据来源

- 数据来源: d2core.com
- 更新日期: S12赛季
- 装备数量: 211件暗金装备
- 包含职业: 野蛮人、德鲁伊、死灵法师、巫师、游侠、圣骑士、灵巫
