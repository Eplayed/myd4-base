import json

# Check if equip_skills data is clean (it comes from the listing API, not markdown)
with open('D:/project/myd4-base-data/data/d4_builds_final_v2.json', encoding='utf-8') as f:
    builds = json.load(f)

print(f'Total builds: {len(builds)}')

for b in builds[:3]:
    bid = b.get('build_id', '?')
    skills = b.get('equip_skills', [])
    equip = b.get('equipment', {})
    class_zh = b.get('class_zh', '')
    print(f'\nBuild {bid}: class_zh={class_zh}, skills={len(skills)}, equip_keys={list(equip.keys())}')
    if skills:
        print(f'  First skill: {repr(str(skills[0])[:80])}')
    if equip:
        for slot, name in equip.items():
            if name:
                print(f'  {slot}: {repr(name[:50])}')

# Check raw markdown for equipment data
print('\n\n--- Raw markdown analysis ---')
with open('D:/project/myd4-base-data/data/builds_detail_raw/1P0u.json', encoding='utf-8') as f:
    raw = json.load(f)

md = raw.get('markdown', '')
lines = md.split('\n')

print('Lines with 威能/传承:')
for i, line in enumerate(lines):
    if any(k in line for k in ['威能', '传承', '精造']):
        print(f'  {i}: {repr(line[:100])}')

# The key question: is the markdown ALSO garbled at byte level?
# Or is it just display issue?
print('\nByte analysis of equipment lines:')
# Line 22: '黑德的药膏之威能头盔'
line22 = lines[22]
print(f'Line 22: {repr(line22)}')
print(f'UTF-8 hex: {line22.encode("utf-8").hex()}')

# What SHOULD it be?
expected = '黑德的药膏之威能头盔'
print(f'Expected hex: {expected.encode("utf-8").hex()}')

# If they differ, byte corruption happened
corrupted = line22.encode('utf-8')
correct = expected.encode('utf-8')
print(f'Bytes match: {corrupted == correct}')

# What is '德' in UTF-8 vs the garbled char?
de_byte = '德'.encode('utf-8').hex()
line22_bytes = line22.encode('utf-8')
print(f"Correct '德' bytes: {de_byte}")
# Find position of '之威能' in line22 to see what comes before
if '之威能' in line22:
    idx = line22.index('之威能')
    before = line22[:idx]
    print(f"Before '之威能': {repr(before)} = {before.encode('utf-8').hex()}")
