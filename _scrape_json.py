"""
scrape_json.py - 用 Firecrawl 请求 d2core 页面的 JSON 格式（而非 markdown）
d2core.com 页面通过 JS 加载 JSON API 数据，
Firecrawl 的 'markdown' 格式对这些 API 请求做了文字提取（产生乱码）。
改用 'raw' 格式，让 Firecrawl 返回原始 HTML（JS 会被执行，但提取的是原始 HTML）。
或者更好：直接请求 d2core 的 API endpoint，跳过页面抓取。

策略：
1. 尝试 d2core 的多个 API endpoint
2. 尝试 Firecrawl 的 'json' format
3. 直接请求页面，提取 JSON 数据
"""
import urllib.request, urllib.error, json, time, re, os

API_KEY = 'fc-fb921ef922284346be06b8c4d21ff3cd'
OUT_FILE = 'D:/project/myd4-base-data/data/builds_json_recovered.json'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/html, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://www.d2core.com/',
}

def firecrawl_scrape(url, formats=['markdown']):
    """使用 Firecrawl API 抓取，支持指定格式"""
    body = json.dumps({
        'url': url,
        'formats': formats,
        'waitFor': 12000
    }).encode('utf-8')
    
    req = urllib.request.Request(
        'https://api.firecrawl.dev/v1/scrape',
        data=body,
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + API_KEY,
        }
    )
    
    resp = urllib.request.urlopen(req, timeout=45)
    raw = resp.read()
    obj = json.loads(raw)
    return obj

def try_d2core_api(build_id):
    """尝试 d2core 的直接 API"""
    endpoints = [
        f'https://www.d2core.com/api/d4/build/{build_id}',
        f'https://api.d2core.com/d4/build/{build_id}',
        f'https://www.d2core.com/d4/api/build/{build_id}',
    ]
    
    for url in endpoints:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            resp = urllib.request.urlopen(req, timeout=10)
            raw = resp.read()
            
            # Try parse as JSON
            for enc in ['utf-8', 'gbk', 'gb18030']:
                try:
                    text = raw.decode(enc)
                    obj = json.loads(text)
                    if isinstance(obj, dict) and len(obj) > 5:
                        print(f'  Direct API {url}: OK as {enc}')
                        return obj, url
                except:
                    pass
        except urllib.error.HTTPError:
            pass
        except Exception as e:
            print(f'  Direct API {url}: {e}')
    
    return None, None

def try_firecrawl_json(build_id):
    """尝试 Firecrawl JSON 格式"""
    url = f'https://www.d2core.com/d4/planner?bd={build_id}'
    try:
        print(f'  Firecrawl JSON format for {build_id}...')
        obj = firecrawl_scrape(url, formats=['json', 'markdown'])
        
        # Check all available fields
        data = obj.get('data', {})
        for key in data:
            val = data[key]
            if isinstance(val, str) and len(val) > 0:
                # Check if it has Chinese
                cn = sum(1 for c in val if '\u4e00' <= c <= '\u9fff')
                if cn > 0:
                    print(f'    Field [{key}]: {cn} Chinese chars, sample: {repr(val[:50])}')
            elif isinstance(val, dict):
                print(f'    Field [{key}]: dict with {len(val)} keys')
            elif isinstance(val, list):
                print(f'    Field [{key}]: list with {len(val)} items')
        
        return obj
    except Exception as e:
        print(f'  Firecrawl JSON: {e}')
        return None

def analyze_markdown_encoding(md):
    """
    分析 markdown 的编码情况，找出乱码模式
    返回: {fixed_md, analysis}
    """
    result = []
    garbled_count = 0
    
    for i, line in enumerate(md.split('\n')):
        # Try to identify garbled vs clean chars
        fixed_line, gc = analyze_line(line)
        garbled_count += gc
        result.append(fixed_line)
    
    return '\n'.join(result), {'garbled_lines': garbled_count}

def analyze_line(line):
    """分析单行，找出乱码字符并尝试修复"""
    # A "clean" line has mostly Chinese chars or ASCII
    # A "garbled" line has many Latin Extended chars (U+0080-U+00FF range, excluding common punctuation)
    
    garbled_chars = []
    clean_chars = []
    
    for c in line:
        code = ord(c)
        if 0x80 <= code <= 0xFF:
            # High byte - could be garbled
            # Also check if it's a known valid char
            if code in (0x2018, 0x2019, 0x201C, 0x201D, 0x2122):  # Smart quotes, TM
                clean_chars.append(c)
            else:
                garbled_chars.append(c)
        else:
            clean_chars.append(c)
    
    if not garbled_chars:
        return line, 0
    
    # Try to fix garbled chars
    garbled_str = ''.join(garbled_chars)
    try:
        latin1_bytes = garbled_str.encode('latin-1')
        gbk_decoded = latin1_bytes.decode('gbk')
        # Check if it looks like Chinese
        chinese = sum(1 for c in gbk_decoded if '\u4e00' <= ord(c) <= '\u9fff')
        if chinese > 0:
            # Build fixed line
            fixed = []
            gi = 0
            for c in line:
                code = ord(c)
                if 0x80 <= code <= 0xFF and code not in (0x2018, 0x2019, 0x201C, 0x201D, 0x2122):
                    fixed.append(gbk_decoded[gi] if gi < len(gbk_decoded) else c)
                    gi += 1
                else:
                    fixed.append(c)
            return ''.join(fixed), len(garbled_chars)
    except:
        pass
    
    return line, len(garbled_chars)

def main():
    # Load existing
    existing = {}
    if os.path.exists(OUT_FILE):
        with open(OUT_FILE, encoding='utf-8') as f:
            existing = json.load(f)
    
    # Load build IDs
    with open('D:/project/myd4-base-data/data/build_ids.txt', encoding='utf-8') as f:
        ids = [l.strip() for l in f if l.strip()]
    
    print(f'Total: {len(ids)}, Existing: {len(existing)}')
    
    # Step 1: Analyze first build with different Firecrawl formats
    print('\n=== Analyzing build 1P0u with Firecrawl ===')
    obj = try_firecrawl_json('1P0u')
    
    if obj:
        data = obj.get('data', {})
        
        # Save full response
        with open('D:/project/myd4-base-data/_firecrawl_json_test.json', 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        print('Saved to _firecrawl_json_test.json')
    
    # Step 2: Also try direct API
    print('\n=== Trying direct d2core API ===')
    api_data, api_url = try_d2core_api('1P0u')
    if api_data:
        print(f'Got data from {api_url}: {list(api_data.keys())[:10]}')
        with open('D:/project/myd4-base-data/_direct_api_test.json', 'w', encoding='utf-8') as f:
            json.dump(api_data, f, ensure_ascii=False, indent=2)
        print('Saved to _direct_api_test.json')

if __name__ == '__main__':
    main()
