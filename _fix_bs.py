# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

f = open(r'D:\project\myd4-base-data\viewer\js\builds-app.js', 'rb').read()
content = f.decode('utf-8', errors='replace')

old = 'buildBuildSkillPreview(build.equip_skills);'
new = 'buildBuildSkillPreview(build._skillIcons||[]);'
if old in content:
    print('FOUND - fixing')
    content = content.replace(old, new, 1)
    with open(r'D:\project\myd4-base-data\viewer\js\builds-app.js', 'w', encoding='utf-8') as fw:
        fw.write(content)
    print('DONE')
else:
    print('NOT FOUND')
    idx = content.find('buildBuildSkillPreview')
    print('context:', repr(content[idx-50:idx+80]))
