"""Generate editable vector logo proposals and a local gallery. No remote resources."""
from pathlib import Path
import json
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'logos'
OUT.mkdir(parents=True, exist_ok=True)
font = TTFont(os.environ.get('BMPR_BRAND_FONT', 'C:/Windows/Fonts/arialbd.ttf'))
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()

def wordmark():
    x = 0
    result = []
    for letter in 'bmpr-editor':
        name = cmap[ord(letter)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        result.append(f'<path transform="translate({x} 0)" d="{pen.getCommands()}"/>')
        x += glyphs[name].width
    return '<g transform="translate(142 81) scale(0.037 -0.037)">' + ''.join(result) + '</g>'

concepts = [
    ('01-monogramma', 'Monogramma', 'Una b costruita come un componente; il punto aperto suggerisce modifica e movimento.', '#2557E8', '#13B8A6',
     '<path d="M32 20v76h30c22 0 35-12 35-29S84 39 64 39H51v17h12c11 0 17 4 17 12s-6 12-17 12H49V20Z" fill="{primary}"/><path d="M81 19h27v27H93V34H81Z" fill="{accent}"/>'),
    ('02-wireframe', 'Wireframe', 'La superficie di lavoro, con un modulo evidenziato e una maniglia di selezione.', '#173D4D', '#F47847',
     '<rect x="21" y="23" width="86" height="82" rx="12" fill="none" stroke="{primary}" stroke-width="9"/><path d="M23 47h82M51 50v53" fill="none" stroke="{primary}" stroke-width="7"/><rect x="63" y="61" width="31" height="30" rx="5" fill="{accent}"/><rect x="99" y="15" width="16" height="16" rx="4" fill="{accent}"/>'),
    ('03-pagine', 'Pagine', 'Due tavole sovrapposte e una piega: un segno editoriale essenziale, leggibile anche piccolo.', '#6D40C8', '#BD8BFF',
     '<path d="M22 37h65v70H22Z" fill="none" stroke="{accent}" stroke-width="9" stroke-linejoin="round"/><path d="M42 18h47l18 18v54H42Z" fill="{primary}"/><path d="M85 18v22h22" fill="none" stroke="{paper}" stroke-width="5"/><path d="M56 55h35M56 69h25" stroke="{paper}" stroke-width="6" stroke-linecap="round"/>'),
    ('04-nodi', 'Nodi', 'Blocchi e connessioni: dal wireframe al flusso, con una composizione dinamica.', '#086E69', '#D5A62C',
     '<path d="M43 39h40v48H43" fill="none" stroke="{primary}" stroke-width="10" stroke-linejoin="round"/><rect x="17" y="20" width="37" height="37" rx="10" fill="{primary}"/><rect x="17" y="71" width="37" height="37" rx="10" fill="{primary}"/><rect x="74" y="46" width="37" height="37" rx="10" fill="{accent}"/>'),
]
variants = {
    'color-transparent': (None, None),
    'color-white': ('#FFFFFF', None),
    'color-dark': ('#111827', None),
    'mono-black': (None, '#111111'),
    'mono-white': (None, '#FFFFFF'),
}
manifest = []
for slug, name, description, primary, accent, geometry in concepts:
    folder = OUT / slug / 'svg'
    folder.mkdir(parents=True, exist_ok=True)
    for variant, (background, mono) in variants.items():
        dark = variant in ('color-dark', 'mono-white')
        p = mono or (accent if dark else primary)
        a = mono or (primary if dark else accent)
        # Compound paths keep cut-outs transparent in both SVG and vector PDF.
        shape = geometry.format(primary=p, accent=a, paper=background or '#FFFFFF')
        if slug == '03-pagine':
            shape = f'<path d="M22 37h65v70H22Z" fill="none" stroke="{a}" stroke-width="9" stroke-linejoin="round"/><path d="M42 18h40v25h25v47H42ZM88 20l17 17H88ZM56 52v6h35v-6ZM56 66v6h25v-6Z" fill="{p}" fill-rule="evenodd"/>'
        for layout, width in [('mark', 128), ('lockup', 570)]:
            title = f'bmpr-editor — {name} — {layout} — {variant}'
            body = (f'<rect width="{width}" height="128" fill="{background}"/>' if background else '') + shape
            if layout == 'lockup':
                body += f'<g fill="{mono or ("#FFFFFF" if dark else "#152234")}">{wordmark()}</g>'
            svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="128" viewBox="0 0 {width} 128" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>'
            file = folder / f'{layout}-{variant}.svg'
            file.write_text(svg, encoding='utf-8')
            manifest.append({'file': file.relative_to(OUT).as_posix(), 'concept': slug, 'layout': layout, 'variant': variant, 'width': width, 'height': 128})
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
cards = ''
for slug, name, desc, primary, accent, _ in concepts:
    cards += f'''<article><div class="number">{slug[:2]} / {name}</div><div class="preview"><img class="logo" src="{slug}/svg/lockup-color-transparent.svg" alt="Proposta {name}"></div><p>{desc}</p><div class="sizes"><img width="16" src="{slug}/svg/mark-color-transparent.svg"><img width="32" src="{slug}/svg/mark-color-transparent.svg"><img width="64" src="{slug}/svg/mark-color-transparent.svg"><span>16 / 32 / 64 px</span></div><div class="swatches"><i style="background:{primary}"></i>{primary}<i style="background:{accent}"></i>{accent}</div><nav><a href="{slug}/svg/lockup-color-transparent.svg">SVG logo</a><a href="{slug}/svg/mark-color-transparent.svg">SVG simbolo</a><a href="{slug}/print/lockup-color-white-150mm.pdf">PDF stampa</a><a href="{slug}/png/lockup-color-transparent-2560.png">PNG grande</a></nav></article>'''
html = '''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>bmpr-editor · proposte di identità</title><style>*{box-sizing:border-box}body{margin:0;background:#f2f1ed;color:#182635;font:16px Arial,sans-serif}main{max-width:1300px;margin:auto;padding:56px 36px}small{letter-spacing:3px;text-transform:uppercase}h1{font-size:52px;letter-spacing:-2px;margin:18px 0}header p{max-width:720px;line-height:1.7;color:#566270}button{padding:10px 16px;border:1px solid #bbc4cb;background:white;border-radius:24px;cursor:pointer;margin:5px 5px 24px 0}button[aria-pressed=true]{background:#182635;color:white}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{background:white;border:1px solid #dddfe1;border-radius:16px;overflow:hidden}.number{padding:20px 24px;font-size:14px;letter-spacing:1px}.preview{padding:32px 24px;min-height:170px;display:flex;align-items:center;background-color:#fff;background-image:linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0}.logo{width:100%;height:auto}article p{line-height:1.6;margin:20px 24px;min-height:52px}.sizes,.swatches,nav{display:flex;align-items:center;gap:16px;padding:8px 24px 20px}.sizes span{color:#66727c;font-size:12px}.swatches{font:12px monospace}.swatches i{width:18px;height:18px;border-radius:50%}nav{flex-wrap:wrap}a{color:#2459a6;font-size:13px}footer{margin-top:32px;color:#5e6973;line-height:1.6}@media(max-width:760px){.grid{grid-template-columns:1fr}h1{font-size:36px}main{padding:30px 18px}}@media print{button{display:none}article{break-inside:avoid}.grid{gap:12px}main{padding:0}}</style><main><header><small>bmpr-editor / studio di identità / 01</small><h1>Quattro modi di dare forma alle idee.</h1><p>Proposte vettoriali per un editor di wireframe. Simbolo autonomo e firma orizzontale, versioni chiare, scure e monocromatiche. Nome attuale del progetto; scelta del marchio ancora aperta.</p></header><div id="switches"><button data-v="color-transparent" aria-pressed="true">Trasparente</button><button data-v="color-white" aria-pressed="false">Fondo bianco</button><button data-v="color-dark" aria-pressed="false">Fondo scuro</button><button data-v="mono-black" aria-pressed="false">Nero</button><button data-v="mono-white" aria-pressed="false">Bianco</button></div><section class="grid">''' + cards + '''</section><footer>SVG e PDF vettoriali · PNG e WebP · JPG · favicon ICO · TIFF 300 dpi.<br>I PDF sono RGB: per una tiratura tipografica, concordare profilo CMYK e supporto con lo stampatore. <a href="README.md">Guida ai file</a></footer></main><script>document.querySelectorAll('button').forEach(b=>b.onclick=()=>{document.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('.logo').forEach(img=>{img.src=img.src.replace(/lockup-[^.]+[.]svg/,'lockup-'+b.dataset.v+'.svg');img.parentElement.style.backgroundImage=b.dataset.v==='color-transparent'?'':'none';img.parentElement.style.backgroundColor=['mono-white','color-dark'].includes(b.dataset.v)?'#111827':'#fff'})});</script></html>'''
(OUT / 'index.html').write_text(html, encoding='utf-8')
print(f'Generated {len(manifest)} vector masters and gallery in {OUT}')
