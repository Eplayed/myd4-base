"""
从 raw JSON 字节流中直接提取 equipment 数据。
raw JSON 里的 markdown 字段是 GBK 字节被当作 UTF-8 存储的，
导致 JSON.parse() 失败。但文件字节本身是完整的。
思路：在原始字节中找 "equipment" 或装备关键词的 GBK 编码字节序列，
直接正则提取。
"""
import re, os, json

# Slot regex patterns (GBK bytes for Chinese)
# 头盔 b'cd'b8   胸甲 d0 db  裤子 cd cf  手套 ca d6  靴子 d1 aa
# 护符 bb a3 b8 f6  戒指 bd bb  武器 ce ed  副手 b8 b7 ba cf
# 威能 cd a6 c4 da  传承 b3 ad ca a0  精造 be ab za a7

EQUIP_GBK_PATTERNS = {
    'helm':     (b'\xcd\xb8',  b'head|helm|helm'),
    'chest':    (b'\xd0\xdb',  b'chest|body'),
    'legs':     (b'\xcd\xcf',  b'legs|pants'),
    'gloves':   (b'\xca\xd6',  b'hand|glove'),
    'boots':    (b'\xd1\xaa',  b'feet|boot'),
    'amulet':   (b'\xbb\xa3\xb8\xf6', b'amulet'),
    'ring':     (b'\xbd\xbb',  b'ring'),
    'weapon':   (b'\xce\xed',  b'weapon'),
    'offhand':  (b'\xb8\xb7',  b'offhand|shield|focus'),
}

# GBK patterns for common affix keywords in equipment names
AFFIX_GBK = {
    'helm':     b'\xe7\x9b\x97\xe9\xa6\x96',  # 威能
    'chest':    b'\xe5\xa4\x9a\xe9\xa6\x96',
    'gloves':   b'\xe5\x9c\xb0\xe9\xa6\x96',
    'boots':    b'\xe5\xa4\x9a\xe5\x9c\xb0',
    'legs':     b'\xe5\x9c\xb0\xe9\xa6\x96',
    'amulet':   b'\xe5\x8d\x97\xe5\xaf\x8c',
    'ring':     b'\xe9\x92\xbb\xe6\x88\x92',
    'weapon':   b'\xe6\x9d\x80\xe4\xbc\xa4',
    'offhand':  b'\xe7\x9b\x97\xe9\xa6\x96',
}

# Better: find actual equipment names from successfully parsed files
# by looking at what the parser found before
# Then search for those byte sequences in the raw files

# Strategy: Look for skill icon URLs which are ASCII and won't be corrupted
# Format: https://cloudstorage.d2core.com/data_img/d4/skill/\d+.png
SKILL_URL_RE = rb'https://cloudstorage\.d2core\.com/data_img/d4/skill/(\d+)\.png'

# Equipment slot lines in markdown typically look like:
# | helm | 黑尔的药膏之威能头盔 |
# or: ### 装备\n- **头盔**: 黑尔的药膏之威能头盔
# or in a table format

# Find table rows with slot names
# Table format: | helm | 装备名 | or | 装备名 | helm |
SLOT_LINE_GBK = {
    'helm':    b'\xe5\xa4\xb4\xe7\x9b\x96',  # 头盔
    'chest':   b'\xe8\x83\xb8\xe7\x94\xb2',  # 胸甲
    'legs':    b'\xe8\x85\xb0\xe5\xad\x90',  # 裤子
    'gloves':  b'\xe6\x89\x8b\xe5\xa5\x97',  # 手套
    'boots':   b'\xe9\x9d\xb0\xe5\xad\x90',  # 靴子
    'amulet':  b'\xe6\x8a\xa4\xe7\xac\xa6',  # 护符
    'ring':    b'\xe6\x88\x92\xe6\x8c\x81',  # 戒指
    'weapon':  b'\xe6\xad\xa6\xe5\x99\xa8',  # 武器
    'offhand': b'\xe5\x89\xaf\xe6\x89\x8b',  # 副手
}

def extract_from_raw(raw_bytes):
    """Try to extract equipment from raw GBK-corrupted markdown."""
    results = {}
    
    # Strategy 1: Look for markdown table rows
    # Format: | slot | name | or | name | slot |
    # or markdown headers like "### 头盔" followed by item name
    
    # Find all skill icon IDs (ASCII-safe)
    skill_ids = re.findall(SKILL_URL_RE, raw_bytes)
    
    # Strategy 2: Look for slot names followed by item names
    # Markdown patterns: "- **头盔**: 装备名" or "| 头盔 | 装备名 |"
    
    # Find lines containing slot names (as UTF-8 or GBK)
    # We look for slot name bytes in the raw
    for slot, slot_bytes in SLOT_LINE_GBK.items():
        if slot_bytes in raw_bytes:
            # Found this slot - try to extract the equipment name from context
            # Look for pattern: slot_bytes + content until newline or |
            idx = raw_bytes.find(slot_bytes)
            # Try to get surrounding context (200 bytes)
            ctx = raw_bytes[max(0,idx-5):idx+200]
            # Try to decode as UTF-8 for display
            try:
                ctx_utf8 = ctx.decode('utf-8', errors='replace')
            except:
                ctx_utf8 = repr(ctx)
            
            # Try to decode the whole file as GBK
            try:
                full_utf8 = raw_bytes.decode('utf-8', errors='replace')
                full_gbk = raw_bytes.decode('gbk', errors='replace')
            except:
                full_utf8 = ''
                full_gbk = ''
            
            # Now search in GBK-decoded version
            if slot in full_gbk:
                # Find line containing slot name
                lines = full_gbk.split('\n')
                for i, line in enumerate(lines):
                    if slot in line and len(line) < 150:
                        # Check if there's an equipment name on this line
                        # Clean the line
                        clean = re.sub(r'[*#|\[\]`>-]', '', line).strip()
                        if clean and len(clean) > 2:
                            # Check if next line has the name
                            if i+1 < len(lines):
                                next_line = lines[i+1].strip()
                                if next_line and len(next_line) > 2 and len(next_line) < 80:
                                    # This might be the equipment name
                                    if not any(s in next_line for s in ['---', '装备', '等级', 'icon']):
                                        item_name = re.sub(r'[*#|\[\]`>-]', '', next_line).strip()
                                        if item_name:
                                            results[slot] = item_name
    
    return skill_ids, results


def process_all_raw():
    raw_dir = 'D:/project/myd4-base-data/data/builds_detail_raw'
    out = {}  # build_id -> {build_id, equipment, skillIcons, chars}
    
    parsed_ids = set()
    pf = 'D:/project/myd4-base-data/data/builds_detail_parsed_fixed.json'
    if os.path.exists(pf):
        with open(pf, encoding='utf-8') as f:
            parsed = json.load(f)
        parsed_ids = set(str(v.get('build_id','')) for v in parsed.values())
    
    # Also merge already parsed data first
    if os.path.exists(pf):
        with open(pf, encoding='utf-8') as f:
            parsed = json.load(f)
        for k, v in parsed.items():
            out[k] = v
    
    files = [f for f in os.listdir(raw_dir) if f.endswith('.json')]
    print(f'Processing {len(files)} raw files...')
    
    newly_parsed = 0
    for fname in sorted(files):
        bid = fname.replace('.json','')
        if bid in parsed_ids:
            continue  # Already have this one
        
        fpath = os.path.join(raw_dir, fname)
        with open(fpath, 'rb') as f:
            raw = f.read()
        
        skill_ids, equip = extract_from_raw(raw)
        
        if equip or skill_ids:
            out[bid] = {
                'build_id': bid,
                'equipment': equip,
                'skillIcons': [int(x) for x in skill_ids],
                'chars': 0
            }
            newly_parsed += 1
    
    print(f'Newly parsed: {newly_parsed}')
    
    # Save merged result
    with open(pf, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'Total records: {len(out)}')
    
    # Show samples
    for k, v in list(out.items())[:3]:
        print(f'\n{k}:')
        print('  equipment:', v.get('equipment', {}))
        print('  skillIcons:', v.get('skillIcons', [])[:3])

if __name__ == '__main__':
    process_all_raw()
