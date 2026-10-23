"""Read-only structural survey. Prints counts and field names, never mockup text."""
import collections
import base64
import json
import pathlib
import sqlite3
import subprocess
import sys

root = pathlib.Path(sys.argv[1]).resolve()
paths = subprocess.check_output(['rg', '--files', '--hidden', '-g', '*.bmpr', '-g', '*.BMPR', str(root)], text=True).splitlines()
counts = collections.Counter()
types = collections.Counter()
schemas = collections.Counter()
tables = {}
shapes = {}
assets = collections.Counter()
group_shapes = []
for raw in paths:
    path = pathlib.Path(raw)
    try:
        with sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True) as db:
            schema = db.execute("SELECT VALUE FROM INFO WHERE NAME='SchemaVersion'").fetchone()
            schemas[str(schema[0]) if schema else '?'] += 1
            for name, sql in db.execute("SELECT name, sql FROM sqlite_master WHERE type='table'"):
                tables[name] = sql
            for attrs, data in db.execute('SELECT ATTRIBUTES, DATA FROM RESOURCES'):
                a = json.loads(attrs)
                counts['resource:' + str(a.get('kind', '?'))] += 1
                if a.get('kind') == 'asset':
                    assets['attribute-fields:' + ','.join(sorted(a))] += 1
                    try:
                        asset = json.loads(data)
                        assets['json-fields:' + ','.join(sorted(asset))] += 1
                        for k, v in asset.items():
                            assets['value-type:' + k + ':' + type(v).__name__] += 1
                    except Exception:
                        assets['non-json:' + type(data).__name__] += 1
                        try:
                            prefix = base64.b64decode(data)[:8].hex()
                            assets['signature:' + prefix] += 1
                        except Exception:
                            assets['not-base64'] += 1
                if a.get('kind') != 'mockup':
                    continue
                d = json.loads(data)
                controls = d.get('mockup', {}).get('controls', {}).get('control', [])
                if isinstance(controls, dict):
                    controls = [controls]
                for c in controls:
                    typ = c.get('typeID', '?')
                    if typ == 'Image':
                        src = c.get('properties', {}).get('src')
                        assets['image-src-type:' + type(src).__name__] += 1
                        if isinstance(src, dict):
                            assets['image-src-fields:' + ','.join(sorted(src))] += 1
                        elif isinstance(src, str):
                            assets['image-src-prefix:' + next((p for p in ['assets/', 'asset://', 'http:', 'https:', 'data:', './assets/'] if src.startswith(p)), 'other')] += 1
                    types[typ] += 1
                    if typ not in shapes:
                        shapes[typ] = {'fields': list(c), 'properties': list(c.get('properties', {}))}
                    if typ in ('__group__', 'Group'):
                        shapes[typ]['nested'] = {k: list(v) for k, v in c.items() if isinstance(v, dict)}
                        group_shapes.append({'group': {k: c.get(k) for k in ['x', 'y', 'w', 'h', 'measuredW', 'measuredH']}, 'child-positions': [{k: x.get(k) for k in ['x', 'y', 'w', 'h', 'typeID']} for x in c.get('children', {}).get('controls', {}).get('control', [])][:3]})
            counts['readable'] += 1
    except Exception as e:
        counts['error:' + type(e).__name__] += 1
print(json.dumps({'files': len(paths), 'counts': counts, 'schemas': schemas, 'tables': tables, 'types': types, 'shapes': shapes, 'assets': assets, 'groups': group_shapes}, indent=2))
