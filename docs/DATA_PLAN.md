# Olden Era 数据计划

日期：2026-05-26

目标：建立低成本、可重复生成的《英雄无敌：上古纪元》资料数据管线，为小程序提供稳定 JSON。

## 数据源优先级

1. Hooded Horse 官方 Wiki：权威规则与官方描述。
2. Steam 新闻：版本更新、补丁与 EA 内容边界。
3. olden-era.com：结构化资料主源，适合自动生成图鉴。
4. Gamerhome 英雄世界：中文新闻、补丁摘要和社区补充。
5. Spell & Sword Wiki：社区资料交叉验证。

## 中文覆盖

已接入 `olden-era.com/zh` 页面：

- 列表页用于补充 `zhName` 和 `zhDescription`。
- 单位中文详情页用于补充能力 `zhName` 与 `zhDescription`。
- 自动生成的中文覆盖输出到 `zh_overrides.generated.json`。
- 人工修正仍放在 `base-data/overrides.zh-CN.json`，优先级高于自动中文名。

注意：中文页只用于显示文本，不用于覆盖机制字段。机制字段仍来自英文详情页的结构化数据，避免中文属性名或翻译变化影响数值口径。

## MVP 数据范围

- `factions.json`：阵营
- `units.json`：兵种
- `heroes.json`：英雄
- `spells.json`：法术
- `artifacts.json`：神器/物品
- `skills.json`：技能
- `classes.json`：职业
- `resources.json`：资源
- `index.json`：文件索引与统计
- `sources.json`：来源页面索引

## 详情页增强

列表页负责发现条目，详情页负责补齐完整字段。

当前已增强：

- 兵种：攻击、防御、先攻、士气、幸运、经验、能力、伤害均值、金币解析。
- 能力：从兵种详情页能力卡片提取能力名、图标和 tooltip 说明，生成 `abilities.json`。
- 宝物：基础效果、升级效果、装备位、稀有度、套装。
- 魔法：魔法学派、等级、法力消耗、各级效果。
- 英雄：阵营、职业、初始技能、专长。
- 技能/职业：详情页属性补充。

## 升级分支关系

已生成 `upgrade_paths.json`，并在 `units.json` 每个兵种条目上增加 `upgrade` 字段。

机制依据：

- `olden-era.com/en/units` 正文说明：阵营单位每个单位都有两个升级选项；中立单位不能升级。
- `ItemList.position` 按阵营与阶级排列，每组三个单位：基础、升级 1、升级 2。
- 仅当某个可玩阵营的某阶恰好有 3 个单位时才生成 `confidence: "high"` 的升级组。

当前生成：

- 6 个可玩阵营 × 7 阶 = 42 组升级路径。
- 中立单位 `upgrade.available = false`。
- 所有升级组都带来源说明，不从名称规则猜测。

示例：

```json
{
  "id": "temple_tier_1",
  "baseUnitId": "unit_swordsman",
  "upgradeIds": ["unit_guard_captain", "unit_suns_aegis"],
  "confidence": "high"
}
```

## 能力数据

已生成 `abilities.json`，并在 `units.json` 的 `derived.abilitiesDetailed` 中引用。

机制和准确性原则：

- 能力数据来自单位详情页的能力卡片，而不是 `additionalProperty.Abilities` 的逗号字符串。
- 原因：部分能力名称本身包含逗号，例如 `Big Rock, Rrr!`，简单按逗号拆分会误导。
- `derived.abilities` 保留能力名称数组，方便搜索。
- `derived.abilitiesDetailed` 提供 `id/name/icon/description`，方便兵种详情页直接渲染。

## 搜索索引

已生成 `search_index.json`：

- 覆盖单位、英雄、魔法、神器、技能、职业、阵营、能力。
- 每个条目包含 `id/type/title/subtitle/icon/sourceFile/keywords`。
- `title` 优先使用中文名。
- `keywords` 合并英文名、中文名、别名、描述、中文描述和结构化属性。
- 第一版小程序可直接本地加载此文件实现全局搜索。

## 统一条目字段

```json
{
  "id": "temple_swordsman",
  "type": "unit",
  "name": "Swordsman",
  "zhName": "",
  "aliases": [],
  "summary": "",
  "image": "https://www.olden-era.com/img/units/temple/swordsman.webp",
  "properties": {},
  "source": {
    "name": "olden-era.com",
    "url": "https://www.olden-era.com/en/units/swordsman",
    "checkedAt": "2026-05-26",
    "confidence": "medium"
  },
  "schemaVersion": 1
}
```

## 后续任务

- 补充中文覆盖表。
- 接入 Gamerhome 补丁新闻索引。
- 接入 Steam 官方更新日志。
- 对官方 Wiki 可访问页面做交叉校验。
- 增加图片下载/镜像策略评估，避免小程序直接依赖第三方图片域名。
