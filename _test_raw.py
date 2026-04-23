"""
诊断 raw 文件编码 + 提取装备数据
"""
import re, os, json

raw_dir = 'D:/project/myd4-base-data/data/builds_detail_raw'

# Find a small raw file
files = sorted([f for f in os.listdir(raw_dir) if f.endswith('.json')])
print(f"Total raw files: {len(files)}")

# Find already parsed ones
pf = 'D:/project/myd4-base-data/data/builds_detail_parsed_fixed.json'
parsed_ids = set()
if os.path.exists(pf):
    with open(pf, encoding='utf-8') as f:
        parsed = json.load(f)
    parsed_ids = set(str(v.get('build_id','')) for v in parsed.values())

# Pick first unparsed
test_bid = None
for f in files:
    bid = f.replace('.json','')
    if bid not in parsed_ids:
        test_bid = bid
        break

if not test_bid:
    test_bid = files[0].replace('.json','')
print(f"\nTest file: {test_bid}")

fpath = os.path.join(raw_dir, test_bid + '.json')
with open(fpath, 'rb') as f:
    raw = f.read()
print(f"File size: {len(raw)} bytes")

# Try decoding as different encodings
for enc in ['utf-8', 'gbk', 'gb18030', 'latin-1']:
    try:
        text = raw.decode(enc)
        try:
            obj = json.loads(text)
            print(f"\n{enc}: JSON parse OK! markdown length={len(obj.get('markdown',''))}")
            # Print first 200 chars of markdown
            md = obj.get('markdown', '')[:200]
            print(f"Markdown (first 200 chars): {repr(md)}")
            break
        except json.JSONDecodeError as e:
            print(f"{enc}: decode OK but JSON fail at {e.pos}: {repr(text[max(0,e.pos-20):e.pos+50])}")
    except Exception as e:
        print(f"{enc}: decode FAIL: {e}")
