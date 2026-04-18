import sys, io, re, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    
    all_apis = []
    def on_response(response):
        url = response.url
        if 'd2core' in url or 'cloudstorage' in url:
            try:
                body = response.text()
                all_apis.append({'url': url, 'status': response.status, 'len': len(body), 'body': body[:2000]})
            except:
                all_apis.append({'url': url, 'status': response.status, 'len': 0, 'body': ''})
    
    page.on('response', on_response)
    page.goto('https://www.d2core.com/d4/data', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(2000)
    
    # 截图保存
    page.screenshot(path='D:/project/myd4-base-data/d2core_data_screenshot.png', full_page=False)
    
    # 打印所有API
    print('=== ALL APIs ===')
    for c in all_apis:
        if c['len'] > 0:
            print(f"\n{c['status']} {c['len']}B  {c['url']}")
            if 'json' in c['url'] or 'config' in c['url']:
                print(f"  body preview: {c['body'][:500]}")
    
    # 获取页面HTML中script标签的数据
    html = page.content()
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    for i, s in enumerate(scripts):
        if len(s) > 50:
            print(f"\n=== script[{i}] ({len(s)} chars) ===")
            print(s[:1000])
    
    # 点击各个tab：暗金、威能、词缀、技能等
    tabs = ['暗金', '威能', '词缀', '技能', '召唤', '符文', '宝石', '药剂']
    prev_count = len(all_apis)
    for tab_name in tabs:
        try:
            loc = page.get_by_text(tab_name, exact=True).first
            if loc.is_visible(timeout=1000):
                loc.click()
                page.wait_for_timeout(2000)
                new_apis = all_apis[prev_count:]
                if new_apis:
                    print(f"\n=== After clicking '{tab_name}' ===")
                    for a in new_apis:
                        if a['len'] > 0:
                            print(f"  {a['status']} {a['len']}B  {a['url']}")
                            if 'json' in a['url'] or 'config' in a['url']:
                                print(f"    body: {a['body'][:300]}")
                prev_count = len(all_apis)
        except Exception as e:
            print(f"\n  skip '{tab_name}': {e}")
    
    # 最后截取页面完整文本
    text = page.inner_text('body')
    with open('D:/project/myd4-base-data/d2core_data_text.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print('\nPage text saved to d2core_data_text.txt')
    
    browser.close()
