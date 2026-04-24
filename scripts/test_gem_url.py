
import requests
from pathlib import Path

ICON_BASE = "https://cloudstorage.d2core.com/data_img/d4/"

# 测试宝石图标格式
def test_gem_urls():
    gem_ids = [315738]  # 第一个宝石 id
    formats = [
        "gem/{id}.webp",
        "gem/{id}.png", 
        "gem/Item_Gem_Ruby_06.webp",
        "gem/Item_Gem_Ruby_06.png",
        "item/{id}.webp",
        "item/{id}.png"
    ]

    for fmt in formats:
        for gem_id in gem_ids:
            url = ICON_BASE + fmt.format(id=gem_id)
            try:
                r = requests.head(url, timeout=10, allow_redirects=True)
                print(f"{r.status_code} - {url}")
                if r.status_code == 200:
                    print("SUCCESS!")
                    return url
            except Exception as e:
                print(f"ERR - {url}: {e}")

if __name__ == "__main__":
    test_gem_urls()
