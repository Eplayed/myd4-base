"""
recover_encoding.py
从已损坏的 JSON 文件中恢复装备中文名。
策略：遍历字符串，识别乱码段（不在中文字符范围且非ASCII的字符块），
      用 latin-1 → GBK 解码恢复，然后将正确UTF-8字符与恢复的中文拼接。
"""
import json, re

def is_chinese(c):
    return '\u4e00' <= c <= '\u9fff'

def is_valid_display_char(c):
    """可显示的正常字符：中文、ASCII可打印、常见符号"""
    if c == '\ufffd':  # UTF-8 replacement char
        return False
    if is_chinese(c):
        return True
    if c in ' \t\n\r.,;:!?()[]{}|-_+*/=#@$%^&~`<>"\'\\':
        return True
    if ' ' <= c <= '~':  # ASCII printable
        return True
    return False

def recover_mojibake(text):
    """
    识别 text 中的乱码段，用 GBK 恢复。
    乱码特征：字符不在中文字符范围，且不是ASCII可打印字符
    """
    result = []
    i = 0
    n = len(text)
    
    while i < n:
        c = text[i]
        
        if is_chinese(c) or c == '\ufffd' or is_valid_display_char(c):
            result.append(c)
            i += 1
        else:
            # Start of a garbled segment
            garbled = []
            start = i
            while i < n:
                c2 = text[i]
                # Continue while char is NOT a valid display char
                if not is_valid_display_char(c2):
                    garbled.append(c2)
                    i += 1
                else:
                    break
            
            if garbled:
                # Convert garbled unicode chars back to bytes (latin-1)
                try:
                    raw_bytes = ''.join(garbled).encode('latin-1')
                    # Decode as GBK
                    gbk_str = raw_bytes.decode('gbk')
                    # Check if it looks like Chinese text
                    if any(is_chinese(c) for c in gbk_str):
                        result.append(gbk_str)
                    else:
                        # Not recoverable as GBK, keep original
                        result.extend(garbled)
                except Exception:
                    # Fallback: keep original
                    result.extend(garbled)
    
    return ''.join(result)

def recover_line(line):
    """尝试恢复一行文字中的乱码部分"""
    # Quick check: if line is already mostly Chinese, it might be fine
    chinese_count = sum(1 for c in line if is_chinese(c))
    if chinese_count > len(line) * 0.5:
        # Mostly Chinese - apply recovery
        return recover_mojibake(line)
    
    # For mixed content, do full recovery
    return recover_mojibake(line)

# Load the parsed fixed JSON
with open('D:/project/myd4-base-data/data/builds_detail_parsed_fixed.json', encoding='utf-8') as f:
    data = json.load(f)

print(f'Loaded {len(data)} builds')

# Test on a few builds
test_keys = list(data.keys())[:5]
for k in test_keys:
    build = data[k]
    equip = build.get('equipment', {})
    if not equip:
        continue
    
    print(f'\n=== Build: {k} ===')
    for slot, value in equip.items():
        recovered = recover_line(value)
        changed = recovered != value
        print(f'  {slot}: {"[FIXED]" if changed else "[OK]"} {recovered}' + 
              (f'  (was: {repr(value[:30])}...)' if changed else ''))

# Apply fix to all builds
fixed_count = 0
for k in data:
    equip = data[k].get('equipment', {})
    for slot in equip:
        original = equip[slot]
        recovered = recover_line(original)
        if recovered != original:
            equip[slot] = recovered
            fixed_count += 1

print(f'\n\nTotal fixed slots: {fixed_count}')

# Save
output = 'D:/project/myd4-base-data/data/builds_detail_encoded_fixed.json'
with open(output, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Saved to: {output}')
