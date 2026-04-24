# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

f = open(r'D:\project\myd4-base-data\viewer\js\builds-app.js', 'rb').read()
content = f.decode('utf-8', errors='replace')

# Fix 1: openBuildDetail - use build._equipment/_skillIcons as the detail
old1 = "  var detail=(window.BUILD_DETAILS&&window.BUILD_DETAILS[buildId])||null;"
new1 = "  var detail=(window.BUILD_DETAILS&&window.BUILD_DETAILS[buildId])||{equipment:build._equipment,skillIcons:build._skillIcons};"
changed1 = content.count(old1)
content = content.replace(old1, new1, 1)
print(f'Fix 1 (detail fallback): {changed1} replaced')

# Fix 2: showBuildDetail - fall back to build._equipment/_skillIcons
old2 = "  var equip=(detail&&detail.equipment)||{};"
new2 = "  var equip=(detail&&detail.equipment)||build._equipment||{};"
changed2 = content.count(old2)
content = content.replace(old2, new2, 1)
print(f'Fix 2 (equip fallback): {changed2} replaced')

old3 = "  var skillIcons=(detail&&detail.skillIcons)||[];"
new3 = "  var skillIcons=(detail&&detail.skillIcons)||build._skillIcons||[];"
changed3 = content.count(old3)
content = content.replace(old3, new3, 1)
print(f'Fix 3 (skillIcons fallback): {changed3} replaced')

with open(r'D:\project\myd4-base-data\viewer\js\builds-app.js', 'w', encoding='utf-8') as fw:
    fw.write(content)
print('DONE')
