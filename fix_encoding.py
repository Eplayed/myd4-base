
import json
import chardet

def fix_and_save(file_path, output_path):
    with open(file_path, 'rb') as f:
        raw = f.read()
    # 检测编码
    result = chardet.detect(raw)
    print(file_path, 'detected encoding:', result)
    # 尝试用 GBK/GB18030 解码
    encodings = ['gb18030', 'gbk', 'utf-8-sig', 'utf-8']
    data = None
    for enc in encodings:
        try:
            data = raw.decode(enc)
            print(f'{file_path} decoded with {enc}')
            break
        except Exception as e:
            continue
    if not data:
        print(f'Failed to decode {file_path}')
        return
    # 解析 JSON
    try:
        json_data = json.loads(data)
    except Exception as e:
        print(f'Failed to parse JSON {file_path}: {e}')
        return
    # 保存为 UTF-8
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    print(f'Saved to {output_path}')

# 修复词缀和宝石
viewer_data = 'D:/project/myd4-base-data/viewer/data'
root_data = 'D:/project/myd4-base-data/data'

for fn in ['affix_zhCN.json', 'gem_zhCN.json']:
    # 先试 root data
    for base in [root_data, viewer_data]:
        import os
        src = os.path.join(base, fn)
        if os.path.exists(src):
            fix_and_save(src, os.path.join(viewer_data, fn))
            break
