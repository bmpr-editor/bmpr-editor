"""Convert generated PNGs to common delivery formats; validate and package."""
from pathlib import Path
from PIL import Image
import json
import zipfile

root = Path(__file__).resolve().parent.parent / 'assets' / 'logos'
manifest = json.loads((root / 'manifest.json').read_text())
for item in manifest:
    folder = root / item['concept']
    for fmt in ['webp', 'jpg', 'icons']:
        (folder / fmt).mkdir(exist_ok=True)
    stem = f"{item['layout']}-{item['variant']}"
    size = 1024 if item['layout'] == 'mark' else 2560
    with Image.open(folder / 'png' / f'{stem}-{size}.png') as im:
        assert im.width == size
        alpha = im.convert('RGBA').getchannel('A')
        if item['variant'].endswith(('white', 'dark')) and item['variant'].startswith('color'):
            assert alpha.getextrema() == (255, 255)
        else:
            assert alpha.getextrema()[0] == 0
        im.save(folder / 'webp' / f'{stem}.webp', lossless=True)
        if item['variant'] in ['color-white', 'color-dark']:
            im.convert('RGB').save(folder / 'jpg' / f'{stem}.jpg', quality=95, subsampling=0)
        if item['variant'] == 'color-transparent':
            target = 591 if item['layout'] == 'mark' else 1772
            h = round(target * item['height'] / item['width'])
            im.resize((target, h), Image.Resampling.LANCZOS).save(folder / 'print' / f'{stem}-300dpi.tiff', dpi=(300,300), compression='tiff_lzw')
            if item['layout'] == 'mark':
                im.save(folder / 'icons' / 'favicon.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
                for n, name in [(180,'apple-touch-icon.png'),(192,'android-chrome-192.png'),(512,'android-chrome-512.png')]:
                    with Image.open(folder / 'png' / f'mark-color-white-{n}.png') as icon:
                        icon.convert('RGB').save(folder / 'icons' / name)
                (folder / 'icons' / 'site.webmanifest').write_text(json.dumps({'name':'bmpr-editor','short_name':'bmpr','icons':[{'src':f'android-chrome-{n}.png','sizes':f'{n}x{n}','type':'image/png','purpose':'any'} for n in [192,512]],'display':'standalone','background_color':'#ffffff','theme_color':'#111827'},indent=2))
    pdf = folder / 'print' / f"{stem}-{'50' if item['layout']=='mark' else '150'}mm.pdf"
    assert pdf.read_bytes().startswith(b'%PDF')
archive = root.parent / 'bmpr-editor-logo-kit.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(root.rglob('*')):
        if p.is_file():
            z.write(p, p.relative_to(root.parent))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(f'Validated {len(manifest)} masters; {sum(p.is_file() for p in root.rglob("*"))} files; ZIP {archive.stat().st_size} bytes')
