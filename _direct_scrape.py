"""
direct_scrape.py - 直接请求 d2core.com 页面，绕过 Firecrawl 编码问题
使用 Python requests 库，自动检测并正确解码 GBK 页面
"""
import urllib.request, urllib.error, json, time, re, os

OUT_FILE = 'D:/project/myd4-base-data/data/builds_detail_direct.json'

SLOTS_MAP = {
    'helm': 'helm', 'helmets': 'helm', '头盔': 'helm',
    'chest': 'chest', '胸甲': 'chest',
    'legs': 'legs', '护腿': 'legs', 'pants': 'legs',
    'gloves': 'gloves', '手套': 'gloves',
    'boots': 'boots', '靴子': 'boots',
    'amulet': 'amulet', '护符': 'amulet',
    'ring': 'ring', '戒指': 'ring',
    'weapon': 'weapon', '武器': 'weapon',
    'offhand': 'offhand', '副手': 'offhand', 'shield': 'offhand'
}

def try_detect_encoding(content):
    """尝试多种编码，找到能产生有意义中文的那个"""
    encodings = ['gbk', 'gb18030', 'utf-8', 'big5', 'gb2312']
    
    for enc in encodings:
        try:
            text = content.decode(enc)
            # Check if it has Chinese
            chinese_count = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
            if chinese_count > 5:
                return text, enc
        except:
            pass
    
    # Fallback to latin-1 (always succeeds)
    return content.decode('latin-1', errors='replace'), 'latin-1'

def extract_equipment_from_html(html, build_id):
    """从页面 HTML 中提取装备数据"""
    equip = {}
    
    # Strategy 1: Look for item names in the page with equipment keywords
    # Pattern: find links/text containing 威能/传承/精造 near slot indicators
    
    # Strategy 2: Look for the planner data in JavaScript variables
    # d2core.com pages usually embed JSON data in script tags
    
    # Look for JSON data containing equipment info
    # Pattern: {"helm": "...", "gloves": "...", ...} or similar
    json_patterns = [
        r'"helm"\s*:\s*"([^"]+)"',
        r'"gloves"\s*:\s*"([^"]+)"',
        r'"legs"\s*:\s*"([^"]+)"',
        r'"boots"\s*:\s*"([^"]+)"',
        r'"amulet"\s*:\s*"([^"]+)"',
        r'"ring"\s*:\s*"([^"]+)"',
        r'"weapon"\s*:\s*"([^"]+)"',
        r'"offhand"\s*:\s*"([^"]+)"',
        r'"chest"\s*:\s*"([^"]+)"',
    ]
    
    for pattern in json_patterns:
        matches = re.findall(pattern, html, re.IGNORECASE)
        for m in matches:
            if any('\u4e00' <= c <= '\u9fff' for c in m):
                slot_key = pattern.split('"')[1]
                equip[slot_key] = m
    
    # Strategy 3: Look for equipment names in markdown/description text
    # Pattern: [Item Name](URL) with slot keyword in URL or surrounding text
    lines = html.split('\n') if '\n' in html else [html]
    
    for line in lines:
        line_lower = line.lower()
        # Check for slot indicators
        for slot_kw, slot_name in SLOTS_MAP.items():
            if slot_kw in line_lower and slot_name not in equip:
                # Look for item name before the URL or in brackets
                # Pattern: [ItemName](...item/xxx/slot...)
                m = re.search(r'\[([^\]]{2,30})\]\([^\)]*' + re.escape(slot_kw), line, re.IGNORECASE)
                if m:
                    equip[slot_name] = m.group(1).strip()
                    continue
                
                # Pattern: title="ItemName" near slot keyword
                m = re.search(r'title="([^"]{2,30})"', line)
                if m:
                    equip[slot_name] = m.group(1).strip()
                    continue
    
    return equip

def extract_from_api(build_id):
    """尝试 d2core 的 REST API（如果可用）"""
    # Try the d2core API endpoint
    # Note: may require authentication
    endpoints = [
        f'https://www.d2core.com/api/d4/build/{build_id}',
        f'https://api.d2core.com/d4/build/{build_id}',
    ]
    
    for url in endpoints:
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            })
            resp = urllib.request.urlopen(req, timeout=10)
            raw = resp.read()
            
            # Try encoding detection
            text, enc = try_detect_encoding(raw)
            if enc != 'utf-8' and any('\u4e00' <= c <= '\u9fff' for c in text[:500]):
                print(f'  API response encoding: {enc}')
            
            # Try JSON parse
            try:
                obj = json.loads(text)
                # If we got JSON, try to extract equipment
                if isinstance(obj, dict):
                    return obj, 'api'
            except:
                pass
        except Exception as e:
            print(f'  API {url}: {e}')
    
    return None, None

def scrape_build(build_id, retries=2):
    """抓取单个构筑的装备数据"""
    for attempt in range(retries):
        try:
            # Try direct page request
            url = f'https://www.d2core.com/d4/planner?bd={build_id}'
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            })
            
            resp = urllib.request.urlopen(req, timeout=30)
            raw = resp.read()
            
            # Detect encoding
            html, enc = try_detect_encoding(raw)
            
            # Check if encoding is non-UTF-8
            if enc != 'utf-8':
                print(f'  Detected encoding: {enc}')
                # Try to extract equipment
                equip = extract_equipment_from_html(html, build_id)
                return {
                    'success': True,
                    'encoding': enc,
                    'build_id': build_id,
                    'url': url,
                    'equipment': equip,
                    'html_len': len(html)
                }
            else:
                # UTF-8 page - check if it has the data we need
                equip = extract_equipment_from_html(html, build_id)
                return {
                    'success': True,
                    'encoding': 'utf-8',
                    'build_id': build_id,
                    'url': url,
                    'equipment': equip,
                    'html_len': len(html)
                }
                
        except urllib.error.HTTPError as e:
            if attempt < retries - 1:
                time.sleep(3)
                continue
            return {'success': False, 'error': f'HTTP {e.code}', 'build_id': build_id}
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(3)
                continue
            return {'success': False, 'error': str(e), 'build_id': build_id}

def main():
    # Load build list
    with open('D:/project/myd4-base-data/data/build_ids.txt', encoding='utf-8') as f:
        ids = [line.strip() for line in f if line.strip()]
    
    print(f'Total builds: {len(ids)}')
    
    # Load existing
    existing = {}
    if os.path.exists(OUT_FILE):
        with open(OUT_FILE, encoding='utf-8') as f:
            existing = json.load(f)
        print(f'Loaded {len(existing)} existing')
    
    results = dict(existing)
    
    # Test with first build
    print('\n=== Testing first build ===')
    result = scrape_build(ids[0])
    print(f'Result: {json.dumps(result, ensure_ascii=False, indent=2)}')

if __name__ == '__main__':
    main()
