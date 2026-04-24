# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

f = open(r'D:\project\myd4-base-data\viewer\js\builds-app.js', 'rb').read()
content = f.decode('utf-8', errors='replace')

# Fix: showBuildDetail - equipment fallback
old1 = "var eq=(detail&&detail.equipment)?detail.equipment:(build.equipment||{});"
new1 = "var eq=(detail&&detail.equipment)||build._equipment||{};"
if old1 in content:
    content = content.replace(old1, new1, 1)
    print('Fix 1 (eq fallback): OK')
else:
    print('Fix 1 NOT FOUND:', repr(old1[:80]))

# Fix: showBuildDetail - skillIcons fallback
old2 = "var skills=build.equip_skills||[];"
new2 = "var skills=(detail&&detail.skillIcons)||build._skillIcons||[];"
if old2 in content:
    content = content.replace(old2, new2, 1)
    print('Fix 2 (skills fallback): OK')
else:
    print('Fix 2 NOT FOUND:', repr(old2[:60]))

with open(r'D:\project\myd4-base-data\viewer\js\builds-app.js', 'w', encoding='utf-8') as fw:
    fw.write(content)
print('DONE')
