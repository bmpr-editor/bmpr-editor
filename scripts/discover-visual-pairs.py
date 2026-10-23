"""Find local BMPR/PNG references. Private manifest goes ONLY to supplied temp folder."""
import collections
import json
import pathlib
import re
import sqlite3
import subprocess
import sys
from PIL import Image

root, output = map(pathlib.Path, sys.argv[1:3])
repository = pathlib.Path(__file__).resolve().parent.parent
if output.resolve().is_relative_to(repository):
    raise SystemExit('Private comparisons must be stored outside the repository.')
output.mkdir(parents=True, exist_ok=True)
files = [pathlib.Path(p) for p in subprocess.check_output(['rg', '--files', str(root), '-g', '*.bmpr', '-g', '*.png'], encoding='utf-8').splitlines()]
images = collections.defaultdict(list)
for p in files:
    if p.suffix.lower() == '.png':
        images[p.parent].append(p)
normalize = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
pairs = []
for file in files:
    if file.suffix.lower() != '.bmpr':
        continue
    candidates = images[file.parent] + images[file.parent / 'png'] + images[file.parent / 'PNG']
    if not candidates:
        continue
    with sqlite3.connect(file.resolve().as_uri() + '?mode=ro', uri=True) as db:
        for rid, branch, attrs, raw in db.execute('SELECT ID, BRANCHID, ATTRIBUTES, DATA FROM RESOURCES'):
            attrs = json.loads(attrs)
            if attrs.get('kind') != 'mockup' or attrs.get('trashed') in [True, 'true', 1]:
                continue
            name = attrs.get('name', '')
            matches = [p for p in candidates if normalize(p.stem) == normalize(name)]
            for image in matches:
                controls = json.loads(raw).get('mockup', {}).get('controls', {}).get('control', [])
                if not isinstance(controls, list):
                    continue
                try:
                    with Image.open(image) as im:
                        size = im.size
                except OSError:
                    continue
                pairs.append({'file': str(file), 'image': str(image), 'key': json.dumps([rid, branch], separators=(',', ':')), 'name': name, 'size': size, 'controls': len(controls), 'types': dict(collections.Counter(c.get('typeID') for c in controls))})
unique = {}
for p in pairs:
    key = (p['image'], p['name'])
    previous = unique.get(key)
    if previous is None or pathlib.Path(p['file']).stat().st_mtime > pathlib.Path(previous['file']).stat().st_mtime:
        unique[key] = p
pairs = list(unique.values())
for i, p in enumerate(pairs):
    p['sample'] = i
(output / 'manifest.json').write_text(json.dumps(pairs, ensure_ascii=False), encoding='utf-8')
print(json.dumps({'matchedPages': len(pairs), 'archives': len(set(p['file'] for p in pairs)), 'manifest': str(output / 'manifest.json')}))
for p in pairs[:35]:
    print(json.dumps({k: p[k] for k in ['sample', 'size', 'controls', 'types']}))
