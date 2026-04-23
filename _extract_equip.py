"""
extract_equip.py - 从原始 JSON 二进制字节中提取装备数据
核心策略：原始 JSON 字节里，markdown 字段是 UTF-8 编码的字符串。
对每个装备行，尝试用 GBK 解读 UTF-8 字节来找到真正的中文。
"""
import json, os, re

def try_gbk_recover(text):
    """
    尝试将文本（已 UTF-8 解码）的字节序列反转恢复为 GBK 原文
    text: Python str (Unicode codepoints)
    思路：如果原始是 GBK，UTF-8 解码后每个 GBK 字变成 2-3 个 UTF-8 字节
    反过来：把 Unicode 字符编码为 UTF-8 → 得到原始字节 → 再尝试 GBK 解码
    """
    try:
        # 编码为 UTF-8 字节
        utf8_bytes = text.encode('utf-8')
        # 尝试作为 GBK 解码
        gbk = utf8_bytes.decode('gbk')
        # 检查是否产生中文
        chinese = sum(1 for c in gbk if '\u4e00' <= c <= '\u9fff')
        if chinese > len(text) * 0.3:
            return gbk, True
        return text, False
    except:
        return text, False

def extract_from_raw_json(filepath):
    """从原始 JSON 文件中提取装备数据"""
    with open(filepath, 'rb') as f:
        raw_bytes = f.read()
    
    # Parse JSON - markdown field is UTF-8 encoded in the JSON
    text = raw_bytes.decode('utf-8', errors='replace')
    try:
        obj = json.loads(text)
    except:
        return {}, {'error': 'JSON parse failed'}
    
    md = obj.get('markdown', '')
    build_id = obj.get('build_id', '')
    
    equip = {}
    lines = md.split('\n')
    
    # Strategy: Look for markdown TABLE rows with equipment data
    # Pattern: | slot | name | affix | ... |
    # The table format in d2core markdown is:
    # | 装备位置 | 名称 | 属性1 | 属性2 | 属性3 | 备注 |
    
    for i, line in enumerate(lines):
        if not line.startswith('|'):
            continue
        
        # Parse table row
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) < 2:
            continue
        
        # Check if this looks like an equipment row
        # Common slot names: 头盔, 胸甲, 护腿, 手套, 靴子, 护符, 戒指, 武器, 副手
        slot_names_cn = ['头盔', '胸甲', '护腿', '手套', '靴子', '护符', '戒指', '武器', '副手', 
                         'ͷ', 'ھ', 'ȷ', 'Ͳ', 'ٷ', 'ϼ', 'ָ', 'Լ', '¹죳', 'س']
        
        # Try to recover garbled text
        recovered_cells = []
        for cell in cells:
            fixed, was_fixed = try_gbk_recover(cell)
            recovered_cells.append(fixed)
        
        # Check first cell for slot name
        first_cell = recovered_cells[0] if recovered_cells else ''
        
        # Map recovered slot name to canonical name
        slot_map = {
            '头盔': 'helm', 'ͷ��': 'helm', '头盔': 'helm', 'ͷ��': 'helm',
            '胸甲': 'chest', 'ھ': 'chest', 'ھͷ': 'chest',
            '护腿': 'legs', 'Ͳ': 'legs', 'ȷ': 'legs',
            '手套': 'gloves', 'Ͳ': 'gloves',
            '靴子': 'boots', 'ѥ': 'boots',
            '护符': 'amulet', 'ϼ': 'amulet',
            '戒指': 'ring', 'ָ': 'ring',
            '武器': 'weapon', '¹죳': 'weapon',
            '副手': 'offhand', 'س': 'offhand'
        }
        
        detected_slot = None
        for cn, slot in slot_map.items():
            if cn in first_cell:
                detected_slot = slot
                break
        
        if detected_slot and len(recovered_cells) >= 2:
            name = recovered_cells[1]
            if name and len(name) >= 2 and not name.startswith('http'):
                equip[detected_slot] = name
    
    return equip, {'build_id': build_id, 'lines_found': len([l for l in lines if l.startswith('|')])}

def analyze_build(filepath):
    """分析一个文件"""
    with open(filepath, 'rb') as f:
        raw = f.read()
    
    text = raw.decode('utf-8', errors='replace')
    obj = json.loads(text)
    md = obj.get('markdown', '')
    
    lines = md.split('\n')
    
    print(f'File: {filepath}')
    print(f'Markdown length: {len(md)}')
    print(f'Table rows: {sum(1 for l in lines if l.startswith("|"))}')
    
    # Show first 10 table rows
    table_rows = [l for l in lines if l.startswith('|')][:10]
    for row in table_rows:
        cells = [c.strip() for c in row.split('|')[1:-1]]
        print(f'  Row: {cells[:3]}')
    
    print()

def main():
    raw_dir = 'D:/project/myd4-base-data/data/builds_detail_raw'
    files = sorted([f for f in os.listdir(raw_dir) if f.endswith('.json')])[:3]
    
    for fname in files:
        filepath = os.path.join(raw_dir, fname)
        
        # First: analyze the raw markdown
        with open(filepath, 'rb') as f:
            raw = f.read()
        text = raw.decode('utf-8', errors='replace')
        obj = json.loads(text)
        md = obj.get('markdown', '')
        
        build_id = obj.get('build_id', fname)
        lines = md.split('\n')
        
        print(f'=== {build_id} ===')
        
        # Find table rows
        table_rows = [l for l in lines if '|' in l and l.strip().startswith('|')]
        print(f'Table rows: {len(table_rows)}')
        
        # Try GBK recovery on table rows
        for row in table_rows[:5]:
            cells = [c.strip() for c in row.split('|')[1:-1]]
            if not cells: continue
            
            # Show original vs recovered
            orig0 = cells[0] if cells else ''
            recovered0, was_fixed0 = try_gbk_recover(orig0)
            orig1 = cells[1] if len(cells) > 1 else ''
            recovered1, was_fixed1 = try_gbk_recover(orig1)
            
            if was_fixed0 or was_fixed1:
                print(f'  [{was_fixed0}/{was_fixed1}] {orig0[:30]} → {recovered0[:30]}')
                print(f'           {orig1[:30]} → {recovered1[:30]}')
        
        print()

if __name__ == '__main__':
    main()
