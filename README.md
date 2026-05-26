# heros-base

《英雄无敌：上古纪元》攻略助手数据项目。

数据链路：

```text
olden-era.com / 官方 Wiki / Steam 新闻 / Gamerhome
  -> crawlers 抓取与清洗
  -> translated-data/{dev|release}
  -> 小程序读取 JSON
```

## 当前状态

- 已接入 `olden-era.com` 的结构化列表数据。
- 已增强详情页数据：兵种、英雄、法术、神器、技能、职业会抓取详情页补充完整字段。
- 已生成 `abilities.json`，能力数据来自兵种详情页能力卡片，包含图标和说明。
- 已接入 `olden-era.com/zh` 中文页，自动生成中文名和中文能力说明。
- 已生成 `search_index.json`，供小程序全局搜索直接读取。
- 首批输出：阵营、兵种、英雄、法术、神器、技能、职业、资源。
- 输出数据保留英文名、来源链接、抓取日期和置信度，中文名先通过覆盖表维护。
- 页面 HTML 缓存在 `cache/olden-era-pages`，默认 24 小时有效，可通过 `PAGE_CACHE_TTL_MS` 调整。

## 常用命令

```bash
# 生成开发数据
npm run crawl:dev

# 生成生产数据
npm run crawl:release

# 校验开发数据
npm run validate:dev

# 启动本地数据控制台
npm run dashboard
```

控制台默认地址：

```text
http://localhost:5178
```

如果端口被占用，可使用：

```bash
DASHBOARD_PORT=5179 npm run dashboard
```

## 目录结构

```text
base-data/
  overrides.zh-CN.json      # 中文名、别名、摘要等人工覆盖
crawlers/
  olden-era/                # olden-era.com 结构化数据管线
  run.js                    # 统一入口
scripts/
  validate-output.js        # 输出文件校验
translated-data/
  dev/
  release/
docs/
  DATA_PLAN.md
```

## 数据原则

- 小程序不直接请求第三方站点。
- 抓取层只存结构化字段和短摘要，不搬运长篇攻略正文。
- 每条数据都保留来源、版本、抓取日期，方便 EA 期间追踪变动。
- 中文内容优先通过 `base-data/overrides.zh-CN.json` 人工维护。
- 自动中文覆盖会输出到 `translated-data/{env}/zh_overrides.generated.json`，人工覆盖仍放在 `base-data/overrides.zh-CN.json`。

## 小程序概念稿

首页视觉概念稿：

```text
docs/mockups/miniprogram-home.html
```

可以直接用浏览器打开查看。
