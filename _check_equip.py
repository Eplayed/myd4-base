import json

with open('D:/project/myd4-base-data/d4_builds_final_v2.json', encoding='utf-8') as f:
    data = json.load(f)

builds = data['builds']
print(f'Total builds: {len(builds)}')

# Count non-empty equipment
non_empty_equip = [b for b in builds if b.get('equipment') and len(b['equipment']) > 0]
print(f'Non-empty equipment: {len(non_empty_equip)}')

# Check equip_skills
non_empty_es = [b for b in builds if b.get('equip_skills')]
print(f'Non-empty equip_skills: {len(non_empty_es)}')

if non_empty_equip:
    b = non_empty_equip[0]
    print()
    print('Sample with equipment:')
    print('  build_id:', b['build_id'])
    print('  equipment keys:', list(b['equipment'].keys()))
    print('  equipment sample:', b['equipment'])

if non_empty_es:
    b = non_empty_es[0]
    print()
    print('Sample with equip_skills:')
    print('  build_id:', b['build_id'])
    es = b['equip_skills']
    print('  equip_skills type:', type(es))
    print('  equip_skills len:', len(es) if es else 0)
    print('  equip_skills sample:', es[:2] if es else [])
