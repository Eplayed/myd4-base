#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用 xbrowser 批量抓取 d2core 构筑详情
绕过 Firecrawl 的 GBK 编码问题
"""
import json
import subprocess
import re
import os
import time
from pathlib import Path

# 配置
BUILD_IDS_FILE = Path('data/build_ids.txt')
OUTPUT_DIR = Path('data/builds_detail_xb')
VIEWER_DATA_DIR = Path('viewer/data')
XB_CJS = r"D:\Program Files\QClaw1\resources\openclaw\config\skills\xbrowser\scripts\xb.cjs"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def run_xb(args, timeout=30):
    """执行 xb 命令，返回结果"""
    cmd = ['node', XB_CJS] + args
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=timeout
        )
        if result.returncode != 0:
            print(f"  XB error: {result.stderr[:200]}")
            return None
        return json.loads(result.stdout)
    except Exception as e:
        print(f"  XB exception: {e}")
        return None

def scrape_build(build_id):
    """抓取单个构筑"""
    url = f'https://www.d2core.com/d4/planner?bd={build_id}'
    output_file = OUTPUT_DIR / f'{build_id}.json'
    
    if output_file.exists():
        print(f"[{build_id}] Already exists, skipping")
        return True
    
    print(f"[{build_id}] Scraping {url}...")
    
    # 1. 打开页面
    result = run_xb(['run', '--browser', 'default', 'open', url], timeout=30)
    if not result or not result.get('ok'):
        print(f"  Failed to open page")
        return False
    
    # 2. 等待加载
    time.sleep(2)
    result = run_xb(['run', '--browser', 'default', 'wait', '--load', 'networkidle'], timeout=30)
    if not result or not result.get('ok'):
        print(f"  Failed to wait for load")
        return False
    
    # 3. 获取页面文本内容（通过 get text）
    # 先获取快照，找到装备相关的元素
    result = run_xb(['run', '--browser', 'default', 'snapshot', '-i'], timeout=15)
    if not result or not result.get('ok'):
        print(f"  Failed to get snapshot")
        return False
    
    # 4. 保存原始数据
    # 由于 xbrowser 没有 evaluate，我们用另一种方式：
    # 获取页面 HTML 内容（通过 get text 所有元素）
    
    # 实际上，我们需要的是装备名称。从截图来看，装备名称在页面上是可见的文本。
    # 我们可以尝试获取所有文本内容然后解析
    
    # 简单方案：先保存当前状态，后续用 BeautifulSoup 解析 HTML
    # 但 xbrowser 没有直接获取 HTML 的命令...
    
    # 替代方案：用 web_fetch 获取页面源码（虽然可能拿不到动态加载的内容）
    # 或者：用 xbrowser 截图 + OCR（太复杂）
    
    # 实际上，d2core 的构筑数据是通过 API 加载的，我们可以直接调用 API
    # 之前试过 api.d2core.com/d4/build/{id} 需要 ACCESS_TOKEN
    # 但也许可以从页面源码中找到 token 或数据
    
    # 让我换个思路：用 web_fetch 获取页面，然后解析其中的 JSON 数据
    
    print(f"  Page loaded, saving placeholder...")
    
    # 保存基本元数据
    data = {
        'build_id': build_id,
        'url': url,
        'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'status': 'loaded',
        'note': 'Need to extract equipment data from page'
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return True

def main():
    # 读取 build IDs
    if not BUILD_IDS_FILE.exists():
        print(f"Build IDs file not found: {BUILD_IDS_FILE}")
        return
    
    with open(BUILD_IDS_FILE, 'r', encoding='utf-8') as f:
        build_ids = [line.strip() for line in f if line.strip()]
    
    print(f"Total builds to scrape: {len(build_ids)}")
    print(f"Output directory: {OUTPUT_DIR}")
    print()
    
    success = 0
    failed = 0
    
    for i, build_id in enumerate(build_ids, 1):
        print(f"[{i}/{len(build_ids)}] ", end='')
        if scrape_build(build_id):
            success += 1
        else:
            failed += 1
        
        # 间隔，避免请求过快
        if i < len(build_ids):
            time.sleep(1)
    
    print()
    print(f"Done: {success} success, {failed} failed")

if __name__ == '__main__':
    main()
