
import json
from collections import defaultdict

with open('data/affix_zhCN.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

groups = defaultdict(list)
for item in data:
    key = item.get('key', '')
    base_key = key
    while True:
        parts = base_key.rsplit('_', 1)
        if len(parts) == 2 and parts[1].isdigit():
            base_key = parts[0]
        else:
            break
    groups[base_key].append(item)

with open('data/affix_grouped.json', 'w', encoding='utf-8') as f:
    json.dump(list(groups.items()), f, ensure_ascii=False, indent=2)

print('Total groups:', len(groups))

sample = list(groups.items())[:2]
for g, items in sample:
    print('Group:', g)
    for i in items[:3]:
        print('  key:', i.get('key'))
        print('  desc:', (i.get('desc') or '')[:60])

