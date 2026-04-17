"""
step1_builds_test.py
====================
正式抓取脚本（测试版）：抓取 d2core.com 首页热门 Build 卡片，只取前3个。
输出到 builds_test.json。

⚠️  注意：选择器基于 2026-04 页面结构，如果页面改版需要重新探查。
    如果运行报错，先跑 step0_explore.py 确认选择器。

用法：
    python step1_builds_test.py

输出格式（每个 Build）：
{
    "title":    "完整标题",
    "author":   "作者名",
    "date":     "22 天前 / 2024-01-01",
    "category": "升级 / 后期 / 速刷",
    "likes":    123,
    "views":    4567,
    "build_id": "1QCR",
    "link":     "https://www.d2core.com/d4/planner?bd=1QCR"
}
"""

import asyncio
import json
import random
import re
import time
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

# ── 配置 ──────────────────────────────────────────────────────────────────────
TARGET_URL   = "https://www.d2core.com/"
OUTPUT_FILE  = Path(__file__).parent / "builds_test.json"
MAX_BUILDS   = 3          # 测试阶段只抓3个
SLOW_MO      = 500        # ms，减慢操作速度，模拟人类
DELAY_MIN    = 1.0        # 随机延时下限（秒）
DELAY_MAX    = 3.0        # 随机延时上限（秒）
MAX_RETRIES  = 3          # 页面加载失败重试次数

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# ── 工具函数 ──────────────────────────────────────────────────────────────────

def random_sleep():
    """随机延时，模拟人类操作节奏"""
    delay = random.uniform(DELAY_MIN, DELAY_MAX)
    print(f"[延时] 等待 {delay:.1f} 秒...")
    time.sleep(delay)


def extract_build_id(href: str) -> str:
    """从 planner 链接中提取 build_id，例如 ?bd=1QCR → '1QCR'"""
    if not href:
        return ""
    match = re.search(r"[?&]bd=([^&]+)", href)
    return match.group(1) if match else ""


def safe_int(text: str) -> int:
    """把 '1.2k' / '123' / '' 转成整数，失败返回 0"""
    if not text:
        return 0
    text = text.strip().lower().replace(",", "")
    try:
        if text.endswith("k"):
            return int(float(text[:-1]) * 1000)
        if text.endswith("m"):
            return int(float(text[:-1]) * 1_000_000)
        return int(float(text))
    except ValueError:
        return 0


# ── 核心抓取逻辑 ──────────────────────────────────────────────────────────────

async def extract_build_card(card) -> dict:
    """
    从单个 Build 卡片元素中提取所有字段。
    选择器基于 d2core.com 2026-04 页面结构，如有变化需更新。
    """
    result = {
        "title":    "",
        "author":   "",
        "date":     "",
        "category": "",
        "likes":    0,
        "views":    0,
        "build_id": "",
        "link":     "",
    }

    try:
        # ── title ──────────────────────────────────────────────────────────
        # 优先取 <a> 标签的完整文本，fallback 到 h2/h3/[class*=title]
        for sel in ["[class*='title']", "h2", "h3", "a"]:
            el = card.locator(sel).first
            if await el.count() > 0:
                text = (await el.inner_text()).strip()
                if text:
                    result["title"] = text
                    break

        # ── link & build_id ────────────────────────────────────────────────
        # 找卡片内的 planner 链接
        link_el = card.locator("a[href*='planner'], a[href*='bd=']").first
        if await link_el.count() > 0:
            href = await link_el.get_attribute("href") or ""
            if href.startswith("/"):
                href = "https://www.d2core.com" + href
            result["link"]     = href
            result["build_id"] = extract_build_id(href)
        else:
            # 卡片本身可能就是 <a>
            href = await card.get_attribute("href") or ""
            if href:
                if href.startswith("/"):
                    href = "https://www.d2core.com" + href
                result["link"]     = href
                result["build_id"] = extract_build_id(href)

        # ── author ─────────────────────────────────────────────────────────
        for sel in ["[class*='author']", "[class*='user']", "[class*='name']"]:
            el = card.locator(sel).first
            if await el.count() > 0:
                text = (await el.inner_text()).strip()
                if text:
                    result["author"] = text
                    break

        # ── date ───────────────────────────────────────────────────────────
        for sel in ["[class*='date']", "[class*='time']", "time", "[class*='ago']"]:
            el = card.locator(sel).first
            if await el.count() > 0:
                text = (await el.inner_text()).strip()
                if text:
                    result["date"] = text
                    break

        # ── category ───────────────────────────────────────────────────────
        for sel in ["[class*='tag']", "[class*='category']", "[class*='type']", "[class*='label']"]:
            el = card.locator(sel).first
            if await el.count() > 0:
                text = (await el.inner_text()).strip()
                if text:
                    result["category"] = text
                    break

        # ── likes ──────────────────────────────────────────────────────────
        for sel in ["[class*='like']", "[class*='thumb']", "[class*='heart']", "[class*='vote']"]:
            el = card.locator(sel).first
            if await el.count() > 0:
                text = (await el.inner_text()).strip()
                if text:
                    result["likes"] = safe_int(text)
                    break

        # ── views ──────────────────────────────────────────────────────────
        for sel in ["[class*='view']", "[class*='read']", "[class*='eye']"]:
            el = card.locator(sel).first
            if await el.count() > 0:
                text = (await el.inner_text()).strip()
                if text:
                    result["views"] = safe_int(text)
                    break

    except Exception as e:
        print(f"  [警告] 提取字段时出错: {e}")

    return result


async def scrape_builds(page) -> list[dict]:
    """
    在已加载的页面上定位 Build 卡片，提取前 MAX_BUILDS 个。
    返回 list[dict]。
    """
    builds = []

    # ── 策略1：找所有 planner 链接，取其父级卡片容器 ──────────────────────
    print("[抓取] 策略1：通过 planner 链接定位卡片...")
    planner_links = page.locator("a[href*='planner'], a[href*='bd=']")
    count = await planner_links.count()
    print(f"[抓取] 找到 {count} 个 planner 链接")

    if count > 0:
        seen_ids = set()
        for i in range(count):
            if len(builds) >= MAX_BUILDS:
                break
            link = planner_links.nth(i)
            href = await link.get_attribute("href") or ""
            build_id = extract_build_id(href)

            # 去重
            if build_id and build_id in seen_ids:
                continue
            if build_id:
                seen_ids.add(build_id)

            # 向上找卡片容器（最多3层）
            card = link
            for _ in range(3):
                parent = card.locator("xpath=..")
                parent_tag = await parent.evaluate("el => el.tagName.toLowerCase()")
                if parent_tag in ("article", "li", "div", "section"):
                    card = parent
                    break

            build = await extract_build_card(card)

            # 如果 title 为空，直接用链接文本
            if not build["title"]:
                build["title"] = (await link.inner_text()).strip()

            # 确保 link 和 build_id 有值
            if not build["link"] and href:
                if href.startswith("/"):
                    href = "https://www.d2core.com" + href
                build["link"]     = href
                build["build_id"] = build_id

            print(f"  [Build {len(builds)+1}] title={build['title']!r}  id={build['build_id']!r}")
            builds.append(build)
            random_sleep()

        return builds

    # ── 策略2：fallback，找 [class*='build'] 或 [class*='card'] ──────────
    print("[抓取] 策略1无结果，尝试策略2：class 匹配...")
    for sel in ["[class*='build-item']", "[class*='BuildCard']", "[class*='build_card']",
                "[class*='card-item']", "[class*='CardItem']"]:
        cards = page.locator(sel)
        c = await cards.count()
        if c > 0:
            print(f"[抓取] 策略2 选择器 {sel!r} 找到 {c} 个卡片")
            for i in range(min(c, MAX_BUILDS)):
                build = await extract_build_card(cards.nth(i))
                print(f"  [Build {len(builds)+1}] title={build['title']!r}  id={build['build_id']!r}")
                builds.append(build)
                random_sleep()
            return builds

    print("[警告] 两种策略均未找到 Build 卡片，请运行 step0_explore.py 探查页面结构")
    return builds


# ── 主函数 ────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("d2core.com Build 抓取脚本（测试版，只抓3个）")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, slow_mo=SLOW_MO)
        context = await browser.new_context(user_agent=USER_AGENT)
        page    = await context.new_page()

        # ── 带重试的页面加载 ───────────────────────────────────────────────
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                print(f"[加载] 第 {attempt} 次尝试打开 {TARGET_URL} ...")
                await page.goto(TARGET_URL, timeout=30000)
                await page.wait_for_load_state("networkidle")
                print(f"[加载] 页面加载成功，标题: {await page.title()}")
                break
            except PlaywrightTimeout as e:
                print(f"[错误] 加载超时（第 {attempt} 次）: {e}")
                if attempt == MAX_RETRIES:
                    print("[错误] 已达最大重试次数，退出")
                    await browser.close()
                    return
                random_sleep()

        # ── 抓取 ───────────────────────────────────────────────────────────
        builds = await scrape_builds(page)
        await browser.close()

    # ── 输出结果 ───────────────────────────────────────────────────────────
    print(f"\n[结果] 共抓取 {len(builds)} 个 Build")
    for i, b in enumerate(builds, 1):
        print(f"  [{i}] {b['title']!r}  author={b['author']!r}  id={b['build_id']!r}")

    OUTPUT_FILE.write_text(
        json.dumps(builds, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"[输出] 已保存到 {OUTPUT_FILE}")

    # ── 验证：至少要有1个有效 build_id ────────────────────────────────────
    valid = [b for b in builds if b["build_id"]]
    if valid:
        print(f"[验证] ✅ {len(valid)} 个 Build 有有效 build_id")
    else:
        print("[验证] ⚠️  没有找到有效 build_id，请检查选择器或运行 step0_explore.py")


if __name__ == "__main__":
    asyncio.run(main())
