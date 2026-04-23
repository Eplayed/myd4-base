"""
单条测试：验证 Firecrawl 返回的 mojibake 可被 latin-1→GBK 修复
"""
import urllib.request, json

API_KEY = 'fc-fb921ef922284346be06b8c4d21ff3cd'
BUILD_ID = '1P0u'  # Should have Chinese in markdown

body = json.dumps({
    'url': 'https://www.d2core.com/d4/planner?bd=' + BUILD_ID,
    'formats': ['markdown'],
    'waitFor': 8000
}).encode('utf-8')

req = urllib.request.Request(
    'https://api.firecrawl.dev/v1/scrape',
    data=body,
    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY}
)

print('Fetching...')
resp = urllib.request.urlopen(req, timeout=30)
raw = resp.read()
print(f'Response: {len(raw)} bytes')

# Parse as UTF-8 (as Firecrawl returns)
obj = json.loads(raw.decode('utf-8', errors='replace'))
md = obj.get('data', {}).get('markdown', '')
print(f'As UTF-8: {repr(md[100:400])}')

# Fix: latin-1 → GBK
latin1_bytes = md.encode('latin-1')
try:
    md_fixed = latin1_bytes.decode('gbk')
    print(f'After fix: {repr(md_fixed[100:400])}')
    has_chinese = any('\u4e00' <= c <= '\u9fff' for c in md_fixed)
    has_garble = '\ufffd' in md_fixed
    print(f'Has Chinese: {has_chinese}, Has garble: {has_garble}')
    print('\nFix works!' if has_chinese else '\nFix failed')
except Exception as e:
    print(f'GBK decode failed: {e}')

# Also test: can we extract equipment names from the fixed markdown?
if has_chinese:
    import re
    # Find equipment lines
    equip_patterns = [
        r'([\u4e00-\u9fff][\u4e00-\u9fff·]+之(?:威能|传承|精造)(?:头盔|胸甲|手套|裤子|靴子|护符|戒指|武器|副手))',
        r'-\s*\*\*((?:[\u4e00-\u9fff][\u4e00-\u9fff·]+之)?(?:(?:威能|传承|精造)(?:头盔|胸甲|手套|裤子|靴子|护符|戒指|武器|副手)))',
    ]
    for pat in equip_patterns:
        matches = re.findall(pat, md_fixed)
        if matches:
            print(f'Equipment matches ({pat[:30]}...): {matches[:5]}')
