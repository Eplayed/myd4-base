"""
fix_encoding.py - 将 GBK→UTF8 错误编码的数据修复为正确 UTF-8
策略：将当前 JSON 中的 UTF-8 字符串 → encode('utf-8') → decode('gbk') → 正确中文
"""
import json, os

INPUT  = 'D:/project/myd4-base-data/data/builds_detail_parsed_fixed.json'
OUTPUT = 'D:/project/myd4-base-data/data/builds_detail_fixed.json'

def fix_utf8_as_gbk(text):
    """将 UTF-8 字节当 GBK 解码，得到正确中文"""
    try:
        utf8_bytes = text.encode('utf-8')
        return utf8_bytes.decode('gbk')
    except (UnicodeEncodeError, UnicodeDecodeError, Exception):
        return text

def test_build(k, equip):
    print(f'Build: {k}')
    for slot, val in equip.items():
        if not val:
            print(f'  {slot}: [empty]')
            continue
        fixed = fix_utf8_as_gbk(val)
        changed = fixed != val
        print(f'  {slot}: {"[FIXED]" if changed else "[OK]"} {fixed}' + 
              (f'\n       (was: {val})' if changed else ''))

# Load
with open(INPUT, encoding='utf-8') as f:
    data = json.load(f)

print(f'Loaded {len(data)} builds\n')

# Test first 3
for k in list(data.keys())[:3]:
    equip = data[k].get('equipment', {})
    if equip:
        test_build(k, equip)
        print()

# Apply to ALL
fixed_slots = 0
for k in data:
    equip = data[k].get('equipment', {})
    for slot in equip:
        original = equip[slot]
        fixed = fix_utf8_as_gbk(original)
        if fixed != original:
            equip[slot] = fixed
            fixed_slots += 1

print(f'Total fixed slots: {fixed_slots}')

# Save
with open(OUTPUT, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Saved: {OUTPUT}')
print(f'File size: {os.path.getsize(OUTPUT):,} bytes')
