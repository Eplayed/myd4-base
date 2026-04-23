import json, os

# Search raw JSON hex for expected equipment names
# Key insight: if Firecrawl stored the bytes correctly, 
# the CORRECT UTF-8 bytes for '暗影之裂隙手套' = e69a97e5bdb1e4b98be8a382e99a99e6898be5a597
# should appear somewhere in the raw file (even if in wrong context)

filepath = 'D:/project/myd4-base-data/data/builds_detail_raw/1P0u.json'
with open(filepath, 'rb') as f:
    raw = f.read()

print(f'File size: {len(raw)} bytes')

# Search for expected UTF-8 bytes
test_names = [
    ('暗影之裂隙手套', 'e69a97e5bdb1e4b98be8a382e99a99e6898be5a597'),
    ('黑德的药膏之威能头盔', 'e9bb91e5b094e79a84e88dafe8868fe4b98be5a881e883bde5a4b4e79b94'),
    ('暗影之裂隙手套', 'e5a49de5bd93'),
    ('之威能头盔', 'e4b98be5a881e883bde5a4b4e79b94'),
]

for name, hex_seq in test_names:
    needle = bytes.fromhex(hex_seq)
    pos = raw.find(needle)
    if pos >= 0:
        print(f'FOUND {name!r} at pos {pos}')
        print(f'  Context: {raw[pos-20:pos+60].hex()}')
    else:
        # Try partial match
        partial = needle[:4]
        pos2 = raw.find(partial)
        if pos2 >= 0:
            print(f'PARTIAL {name!r} ({partial.hex()}) at pos {pos2}')

# Now: look at the ACTUAL bytes around the garbled section
# Line 22: '�ڶ���ҩ��֮威能头盔'
# The garbled part is '�ڶ���ҩ��'
# Correct: '黑德的药膏'
# The garbled chars: U+FFFD(�), U+9ED1(黑), U+5C14(尔), U+7684(的), U+836F(药), U+818F(膏)
# Wait - U+9ED1 is 黑! And U+5C14 is 尔! Those are correct Chinese chars!
# Let me re-examine: is the garbled portion actually correct?

with open(filepath, 'rb') as f:
    raw_str = f.read().decode('utf-8', errors='replace')

obj = json.loads(raw_str)
md = obj.get('markdown', '')
lines = md.split('\n')

line22 = lines[22]
print(f'\nLine 22: {repr(line22)}')
print(f'Line 22 chars:')
for i, c in enumerate(line22[:15]):
    print(f'  {i}: U+{ord(c):04X} {repr(c)}')

# Is '�' = U+FFFD?
# Is '黑' = U+9ED1?
# If so: the string IS mostly correct! The only issue is the U+FFFD replacement char.
print(f'\nU+FFFD in line22: {chr(0xFFFD) in line22}')
print(f'Replacement char count: {line22.count(chr(0xFFFD))}')
