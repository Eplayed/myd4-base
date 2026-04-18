# myd4-base-data

暗黑破坏神4 (Diablo 4) 基础数据项目。从 d2core.com 抓取热门构筑 + 游戏数据库，提供本地查看和二次开发。

## 数据来源

- **热门构筑**: `cloudstorage.d2core.com/config/hot-builds.json` (100条 D4 S12 热门 Build)
- **构筑详情**: Playwright 批量抓取详情页 (87/100 成功)
- **游戏数据库**: `cloudstorage.d2core.com/data/d4/70982/*_zhCN.json`

## 目录结构

```
myd4-base-data/
├── data/                        # 游戏数据库 (来自 d2core CDN)
│   ├── uniqueItem_zhCN.json     # 暗金 (211 件)
│   ├── aspect_zhCN.json         # 威能 (430 条)
│   ├── affix_zhCN.json          # 词缀 (1735 条)
│   ├── skills_zhCN.json         # 技能 (450 个)
│   ├── summon_zhCN.json         # 召唤物 (18 个)
│   ├── rune_zhCN.json           # 符文 (51 个)
│   ├── gem_zhCN.json            # 宝石 (42 个)
│   └── elixir_zhCN.json         # 药剂 (34 个)
├── d4_builds_final_v2.json      # 100条热门构筑完整数据 (含评论/收藏)
├── d4_core_data.json            # SNO/GBID 基础索引
├── builds_detail_100.json       # 详情页原始抓取数据
├── scrape_batch_detail.py       # 批量抓取脚本
└── viewer/                      # Web 查看器
    ├── index.html               # 主页面 (暗黑风格)
    └── builds_data.json         # 前端精简数据
```

## Web 查看器

```bash
cd viewer
python -m http.server 8080
# 打开 http://localhost:8080
```

## 职业分布 (S12 热门构筑 Top 100)

| 职业 | 数量 |
|------|------|
| 圣骑士 | 39 |
| 巫师 | 15 |
| 游侠 | 15 |
| 死灵法师 | 10 |
| 灵巫 | 8 |
| 野蛮人 | 7 |
| 德鲁伊 | 6 |

## 数据更新

```bash
# 重新抓取热门构筑
python scrape_batch_detail.py

# 更新游戏数据库 (自动下载最新版本)
python update_game_data.py
```

## License

MIT
