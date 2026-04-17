"""
step0_explore.py  (v3 - Firefox + Stealth 版)
==============================================
探查脚本：打印 d2core.com 首页的 DOM 结构。

v3 改动：切换 Firefox 引擎 + playwright-stealth 反检测。
"""

import asyncio
from playwright.async_api import async_playwright
from playwright_stealth.stealth import Stealth
from playwright._impl._errors import Error as PlaywrightError


async def explore():
    async with async_playwright() as p:
        # ── 用 Firefox，不容易被 Chromium 的 headless 特征识别 ─────────────
        browser = await p.firefox.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) "
                "Gecko/20100101 Firefox/126.0"
            ),
            viewport={"width": 1440, "height": 900},
            locale="zh-CN",
            extra_http_headers={
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
        )

        page = await context.new_page()

        # ── stealth 模式：模拟真实浏览器指纹 ────────────────────────────
        stealth = Stealth()
        await stealth.apply_stealth_async(page)

        # 控制台日志
        console_msgs = []
        page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

        urls_to_try = [
            "https://www.d2core.com/",
            "https://www.d2core.com/d4",
        ]

        success = False
        for url in urls_to_try:
            print(f"[探查] 尝试: {url}")
            try:
                response = await page.goto(url, timeout=30000, wait_until="domcontentloaded")
                status = response.status if response else "None"
                print(f"[探查] HTTP 状态码: {status}")
                await page.wait_for_timeout(4000)  # 等 JS 渲染
                title = await page.title()
                print(f"[探查] 页面标题: {title!r}")

                if status == 404 or "not found" in title.lower():
                    print("[探查] 页面不存在，尝试下一个...")
                    continue

                success = True
                break
            except PlaywrightError as e:
                print(f"[探查] 加载失败: {e}")
                continue

        if not success:
            print("[探查] ⚠️ 所有 URL 均无法访问，可能是 IP 被封或域名有误")
            await browser.close()
            return

        # ── 候选选择器扫描 ───────────────────────────────────────────────
        candidates = [
            "a[href*='planner']", "a[href*='bd=']",
            "[class*='build']", "[class*='Build']",
            "[class*='card']", "[class*='Card']",
            "article", ".hot", "[class*='hot']",
            "[class*='popular']", "[class*='item']",
        ]
        print("\n[探查] 选择器扫描结果：")
        for sel in candidates:
            count = await page.locator(sel).count()
            print(f"  {sel!r:40s} → {count} 个")

        # ── 所有 planner 链接 ───────────────────────────────────────────
        links = await page.locator("a[href*='planner']").all()
        print(f"\n[探查] 共找到 {len(links)} 个 planner 链接（显示前15）：")
        for i, link in enumerate(links[:15]):
            href = await link.get_attribute("href")
            text = (await link.inner_text()).strip().replace("\n", " ")[:80]
            print(f"  [{i+1}] href={href}")
            print(f"      text={text!r}")

        # ── 控制台错误 ──────────────────────────────────────────────────
        errors = [m for m in console_msgs if m.startswith("[error]")]
        if errors:
            print(f"\n[探查] 控制台错误（前5条）：")
            for e in errors[:5]:
                print(f"  {e}")

        # ── body HTML ──────────────────────────────────────────────────
        body = await page.inner_html("body")
        print(f"\n[探查] body HTML（前 3000 字符）：\n{body[:3000]}")

        await browser.close()
        print("\n[探查] ✅ 探查完成，把以上输出发给 AI 获取选择器。")


if __name__ == "__main__":
    asyncio.run(explore())
