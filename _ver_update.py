# -*- coding: utf-8 -*-
import sys, re
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

f = open(r'D:\project\myd4-base-data\viewer\index.html', 'r', encoding='utf-8', errors='replace')
content = f.read()

new_content = re.sub(r'builds-app\.js\?v=\d+', 'builds-app.js?v=2026042324', content)

if new_content == content:
    print('NO CHANGE - not found')
else:
    with open(r'D:\project\myd4-base-data\viewer\index.html', 'w', encoding='utf-8') as fw:
        fw.write(new_content)
    print('OK - updated to v=2026042324')
