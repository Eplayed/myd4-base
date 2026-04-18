"""
D4 详情页批量抓取 - 补充 comments/collections
从 d4_builds_final.json 获取 100 个 build_id，逐一访问详情页
"""
import sys
import io
import json
import re
import asyncio
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright, Page, Browser
from bs4 import BeautifulSoup

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

PROJECT = Path("D:/project/myd4-base-data")
DETAIL_URL = "https://www.d2core.com/d4/planner?bd="


async def scrape_detail_page(browser: Browser, build_id: str) -> dict:
    """抓取单个详情页，返回 comments/collections/publish_time"""
    url = DETAIL_URL + build_id
    page = await browser.new_page()
    try:
        await page.goto(url, timeout=20000)
        await page.wait_for_timeout(2500)  # 等待 JS 渲染

        html = await page.content()
        soup = BeautifulSoup(html, 'html.parser')

        # 侧边栏统计
        sidebar = soup.select('.planner-interaction-sidebar')
        likes_detail = None
        collections = None
        comments = None

        if sidebar:
            # 通常有 4 个项: 点赞、收藏、评论、分享
            items = sidebar[0].select('.planner-interaction-sidebar__item')
            for i, item in enumerate(items):
                like_elem = item.select_one('.like-count')
                text_elem = item.select_one('.planner-interaction-sidebar__text')
                if like_elem:
                    val = int(like_elem.get_text(strip=True) or 0)
                    if i == 0:
                        likes_detail = val  # 点赞
                    elif i == 1:
                        collections = val  # 收藏
                if text_elem:
                    txt = text_elem.get_text(strip=True)
                    if i == 2:
                        comments = int(txt) if txt.isdigit() else None

        # 精确发布时间
        time_elem = soup.select_one('.planner-author__time')
        publish_time = time_elem.get_text(strip=True) if time_elem else None

        # 作者等级
        level_elem = soup.select_one('.user-level-badge__text span')
        author_level = level_elem.get_text(strip=True) if level_elem else None

        return {
            'build_id': build_id,
            'likes_detail': likes_detail,
            'collections': collections,
            'comments_detail': comments,
            'publish_time': publish_time,
            'author_level': author_level,
            'status': 'ok',
        }

    except Exception as e:
        return {
            'build_id': build_id,
            'status': 'error',
            'error': str(e)[:100],
        }
    finally:
        await page.close()


async def batch_scrape(browser: Browser, build_ids: list, batch_size: int = 5) -> list:
    """批量抓取，每次处理 batch_size 个页面"""
    results = []
    total = len(build_ids)

    print(f"=== 开始批量抓取 {total} 个详情页 ===")
    print(f"批次大小: {batch_size}, 预计耗时: ~{total * 3} 秒")

    for i in range(0, total, batch_size):
        batch = build_ids[i:i + batch_size]
        batch_num = i // batch_size + 1
        print(f"\n[Batch {batch_num}] {i+1}-{min(i+batch_size, total)} / {total}")

        # 并发抓取
        tasks = [scrape_detail_page(browser, bid) for bid in batch]
        batch_results = await asyncio.gather(*tasks)

        # 处理结果
        for r in batch_results:
            results.append(r)
            status = r.get('status', 'unknown')
            bid = r.get('build_id', '?')
            likes = r.get('likes_detail')
            coll = r.get('collections')
            comm = r.get('comments_detail')
            if status == 'ok':
                print(f"  {bid}: ♥{likes} 💬{comm} 📁{coll}")
            else:
                print(f"  {bid}: ERR {r.get('error', '?')}")

        # 等待一小段时间避免请求过快
        await asyncio.sleep(0.5)

    return results


async def main():
    # 加载 build IDs
    with open(PROJECT / "d4_builds_final.json", encoding='utf-8') as f:
        data = json.load(f)
    builds = data['builds']
    build_ids = [b['build_id'] for b in builds]
    print(f"加载 {len(build_ids)} 个 Build ID")

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=True)

        # 批量抓取 - 每批 5 个并发
        results = await batch_scrape(browser, build_ids, batch_size=5)

        await browser.close()

    # 合并数据
    print("\n=== 合并数据 ===")
    detail_map = {r['build_id']: r for r in results if r.get('status') == 'ok'}
    errors = [r for r in results if r.get('status') == 'error']

    success = len(detail_map)
    print(f"成功: {success}, 失败: {len(errors)}")

    # 更新 builds
    for b in builds:
        bid = b['build_id']
        d = detail_map.get(bid, {})
        if d:
            # 使用详情页数据覆盖
            b['likes_detail'] = d.get('likes_detail')
            b['comments'] = d.get('comments_detail') or b.get('comments', 0)
            b['collections'] = d.get('collections') or b.get('collections', 0)
            b['publish_time'] = d.get('publish_time')
            b['author_level'] = d.get('author_level')

    # 保存更新后的数据
    data['meta']['fetch_time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    data['meta']['detail_pages_scraped'] = success
    data['meta']['detail_errors'] = len(errors)

    out_path = PROJECT / "d4_builds_final_v2.json"
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n[SAVED] {out_path}")

    # 保存详情页原始数据
    detail_path = PROJECT / "builds_detail_100.json"
    with open(detail_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"[SAVED] {detail_path}")

    # 汇总统计
    print("\n=== 汇总 ===")
    total_likes = sum(b.get('likes', 0) or 0 for b in builds)
    total_comments = sum(b.get('comments', 0) or 0 for b in builds)
    total_collections = sum(b.get('collections', 0) or 0 for b in builds)
    print(f"总点赞: {total_likes}")
    print(f"总评论: {total_comments}")
    print(f"总收藏: {total_collections}")

    # Top 5 with comments
    print("\nTop 5 (按评论数):")
    by_comments = sorted(builds, key=lambda x: x.get('comments', 0) or 0, reverse=True)[:5]
    for b in by_comments:
        print(f"  💬{b['comments']} ♥{b['likes']} | {b['class_zh']} | {b['title'][:40]}")

    if errors:
        print("\n失败列表:")
        for e in errors[:10]:
            print(f"  {e.get('build_id', '?')}: {e.get('error', '?')}")


if __name__ == '__main__':
    asyncio.run(main())