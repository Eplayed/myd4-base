"""
recover_equip.py - 从 Firecrawl API 原始响应中提取装备数据
策略：直接用 Python 请求，对返回的 markdown 文本做 GBK/UTF-8 双轨解码，
      对每段内容同时尝试两种编码，选择能产生有意义中文的那个。
"""
import urllib.request, json, time, re, os

API_KEY = 'fc-fb921ef922284346be06b8c4d21ff3cd'
OUT_FILE = 'D:/project/myd4-base-data/data/builds_detail_recovered.json'

SLOTS = ['helm', 'chest', 'legs', 'gloves', 'boots', 'amulet', 'ring', 'weapon', 'offhand']

# Keywords that identify equipment lines
EQUIP_KEYWORDS = ['威能', '传承', '精造', '威能', '傳承', '精造']

def try_decode_dual(text):
    """
    对字符串 text 同时尝试 UTF-8 和 GBK 解码，返回（正确解码结果，是否GBK）的元组
    策略：分析字节序列，对 GBK 中文区域用 GBK 解码，对 ASCII/英文区域保留
    """
    # Get raw bytes
    try:
        raw_bytes = text.encode('utf-8')
    except:
        return text, False
    
    # Try pure GBK decode of full string
    try:
        gbk_result = raw_bytes.decode('gbk')
        # Check if it has Chinese and makes sense
        chinese_count = sum(1 for c in gbk_result if '\u4e00' <= c <= '\u9fff')
        if chinese_count > 2:
            return gbk_result, True
    except:
        pass
    
    return text, False

def extract_equipment_from_markdown(md):
    """从 markdown 中提取装备数据"""
    equip = {}
    lines = md.split('\n')
    
    for line in lines:
        if not line.strip():
            continue
        
        # Try UTF-8 first
        line_ok, is_gbk = try_decode_dual(line)
        
        # Try to match equipment pattern
        # Pattern: [name](URL) where URL contains cloudstorage + slot indicator
        # OR: inline text with 威能/传承/精造
        
        # Match: item name in brackets followed by cloudstorage URL
        # e.g. [暗影之裂隙手套](https://cloudstorage.d2core.com/data_img/d4/item/...helm...)
        m = re.search(r'\[([^\]]+)\]\([^\)]*?(?:helm|helmets|chest|legs|gloves|boots|amulet|ring|weapon|offhand|shield)[^\)]*\)', line_ok, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            url = m.group(0)
            # Determine slot from URL
            url_lower = url.lower()
            if 'helm' in url_lower: slot = 'helm'
            elif 'chest' in url_lower: slot = 'chest'
            elif 'legs' in url_lower: slot = 'legs'
            elif 'gloves' in url_lower: slot = 'gloves'
            elif 'boots' in url_lower: slot = 'boots'
            elif 'amulet' in url_lower: slot = 'amulet'
            elif 'ring' in url_lower: slot = 'ring'
            elif 'weapon' in url_lower: slot = 'weapon'
            elif 'offhand' in url_lower or 'shield' in url_lower: slot = 'offhand'
            else: slot = None
            
            if slot and name and slot not in equip:
                equip[slot] = name
        
        # Also match: **Name** or - Name with 威能/传承/精造
        for kw in ['威能', '传承', '精造', '傳承']:
            if kw in line_ok:
                # Try to extract name before keyword
                parts = line_ok.split(kw)
                for part in parts[:-1]:  # All parts before the keyword
                    name = part.strip()
                    # Clean up markdown
                    name = re.sub(r'^\*\*|^-|^\*', '', name).strip()
                    name = re.sub(r'\*\*$', '', name).strip()
                    # Skip if too short or looks like description
                    if len(name) >= 4 and not name.startswith('http') and '!' not in name:
                        # Try to infer slot from context
                        # Look for slot keyword in surrounding context
                        context = line_ok.lower()
                        for slot_kw, slot_name in [('helm','helm'),('头盔','helm'),('胸甲','chest'),('chest','chest'),
                                                    ('legs','legs'),('护腿','legs'),('gloves','gloves'),('手套','gloves'),
                                                    ('boots','boots'),('靴子','boots'),('护符','amulet'),('amulet','amulet'),
                                                    ('戒指','ring'),('ring','ring'),('武器','weapon'),('weapon','weapon'),
                                                    ('副手','offhand'),('offhand','offhand')]:
                            if slot_kw in context and slot_name not in equip:
                                equip[slot_name] = name
                                break
                break
    
    return equip

def fetch_build_md(build_id, retries=2):
    """抓取单个构筑的 markdown"""
    for attempt in range(retries):
        try:
            body = json.dumps({
                'url': f'https://www.d2core.com/d4/planner?bd={build_id}',
                'formats': ['markdown'],
                'waitFor': 12000
            }).encode('utf-8')
            
            req = urllib.request.Request(
                'https://api.firecrawl.dev/v1/scrape',
                data=body,
                headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {API_KEY}'}
            )
            
            resp = urllib.request.urlopen(req, timeout=45)
            raw = resp.read()
            
            # Parse JSON
            obj = json.loads(raw)
            md = obj.get('data', {}).get('markdown', '')
            
            # Fix encoding: try to interpret as GBK
            fixed_md, was_gbk = try_decode_dual(md)
            
            return {
                'success': True,
                'markdown': fixed_md,
                'was_gbk': was_gbk,
                'build_id': build_id
            }
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(5)
            else:
                return {'success': False, 'error': str(e), 'build_id': build_id}

def main():
    # Load build list
    with open('D:/project/myd4-base-data/data/build_ids.txt', encoding='utf-8') as f:
        ids = [line.strip() for line in f if line.strip()]
    
    print(f'Total builds to process: {len(ids)}')
    
    # Load existing results
    existing = {}
    if os.path.exists(OUT_FILE):
        with open(OUT_FILE, encoding='utf-8') as f:
            existing = json.load(f)
        print(f'Loaded {len(existing)} existing results')
    
    new_results = {}
    
    for i, bid in enumerate(ids):
        if bid in existing and existing[bid].get('success'):
            new_results[bid] = existing[bid]
            print(f'[{i+1}/{len(ids)}] SKIP {bid}')
            continue
        
        print(f'[{i+1}/{len(ids)}] FETCH {bid}...')
        result = fetch_build_md(bid)
        new_results[bid] = result
        
        if result['success']:
            equip = extract_equipment_from_markdown(result['markdown'])
            result['equipment'] = equip
            print(f'  → OK (GBK={result["was_gbk"]}) equip: {list(equip.keys())}')
        else:
            print(f'  → FAIL: {result.get("error")}')
        
        # Save incrementally
        with open(OUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(new_results, f, ensure_ascii=False, indent=2)
        
        time.sleep(7)  # Rate limit
    
    # Summary
    success_count = sum(1 for v in new_results.values() if v.get('success'))
    equip_count = sum(1 for v in new_results.values() if v.get('equipment'))
    print(f'\nDone! Success: {success_count}/{len(ids)}, With equipment: {equip_count}')

if __name__ == '__main__':
    main()
