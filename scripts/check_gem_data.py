
import json
with open('viewer/data/gem_zhCN.json', 'r', encoding='utf-8') as f:
    gems = json.load(f)
print('Gems:', len(gems))
for i, g in enumerate(gems[:3]):
    print(f"Gem {i}: {g.get('name')}, key={g.get('key')}, id={g.get('id')}")
