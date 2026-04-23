"""
测试从 raw 文件恢复 GBK 中文内容
GBK 中文（如 "头盔"）被当作 UTF-8 字符串存储在 JSON 中，
导致 JSON.loads() 后的字符串变成 "�ڶ�" 等替换符。
恢复方法：用 latin-1 将字符串重新编码回 GBK 字节，再解码为 UTF-8。
"""
import re, os, json

raw_dir = 'D:/project/myd4-base-data/data/builds_detail_raw'
test_bid = '1P0k'  # unparsed

fpath = os.path.join(raw_dir, test_bid + '.json')
with open(fpath, 'rb') as f:
    raw = f.read()

# Step 1: Decode as UTF-8 (this gives us the "broken" JSON)
obj = json.loads(raw.decode('utf-8'))
md = obj.get('markdown', '')
print(f"Markdown length: {len(md)}")

# Step 2: Try latin-1 recovery
# The idea: GBK bytes decoded as UTF-8 → replacement chars
# Re-encode as latin-1 → get back the GBK bytes
md_latin = md.encode('latin-1')  # Each � becomes 0xBF, etc
print(f"Latin-1 recovery: {len(md_latin)} bytes")
# Now decode as GBK
try:
    md_gbk = md_latin.decode('gbk')
    print(f"GBK decode: OK, first 300 chars:\n{md_gbk[:300]}")
    print("\nGBK decode SUCCESS!")
except Exception as e:
    print(f"GBK decode FAIL: {e}")

# Step 3: Also try with a file that WAS parsed successfully
print("\n\n=== Testing already-parsed file: 1P0u ===")
fpath2 = os.path.join(raw_dir, '1P0u.json')
with open(fpath2, 'rb') as f:
    raw2 = f.read()
obj2 = json.loads(raw2.decode('utf-8'))
md2 = obj2.get('markdown', '')
print(f"Markdown length: {len(md2)}")
print(f"First 100 chars: {repr(md2[:100])}")
# Check if it contains replacement chars
has_replacement = '\ufffd' in md2 or '�' in md2
print(f"Has UTF-8 replacement chars: {has_replacement}")
