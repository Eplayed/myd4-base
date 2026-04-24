
import json
with open('viewer/data/gem_zhCN.json', 'r', encoding='utf-8') as f:
    gems = json.load(f)
# 给宝石加上 icon 字段，用 id 作为 icon
for gem in gems:
    gem['icon'] = gem['id']
with open('viewer/data/gem_zhCN.json', 'w', encoding='utf-8') as f:
    json.dump(gems, f, ensure_ascii=False, indent=2)
print('Fixed gem icons')
