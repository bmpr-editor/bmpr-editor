import { renderToStaticMarkup } from 'react-dom/server';
import { AssetContext, ControlGraphic, arrowPoints } from '../render/Controls';
import {
  boundsOf,
  boxOf,
  childControls,
  controlsOf,
  number,
  pageName,
  textOf,
  typeOf,
  visiblePages,
  type Control,
  type Page,
} from '../model/document';

export function svgFor(page: Page, sketch = false, assets: Record<string, string> = {}): string {
  const controls = controlsOf(page),
    b = boundsOf(controls, 32);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    renderToStaticMarkup(
      <AssetContext.Provider value={assets}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={Math.ceil(b.w)}
          height={Math.ceil(b.h)}
          viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
        >
          <title>{pageName(page)}</title>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#ffffff" />
          {[...controls]
            .sort((a, b) => number(a.zOrder) - number(b.zOrder))
            .map((c, i) => (
              <g key={i} transform={`translate(${boxOf(c).x} ${boxOf(c).y})`}>
                <ControlGraphic control={c} sketch={sketch} />
              </g>
            ))}
        </svg>
      </AssetContext.Provider>,
    )
  );
}
export function safeName(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .slice(0, 100)
      .trim() || 'progetto'
  );
}
export function download(data: BlobPart, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName(name);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
export async function pngFor(
  page: Page,
  sketch = false,
  assets: Record<string, string> = {},
): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([svgFor(page, sketch, assets)], { type: 'image/svg+xml' }),
  );
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(
      2,
      8192 / Math.max(img.naturalWidth, img.naturalHeight),
      Math.sqrt(32_000_000 / (img.naturalWidth * img.naturalHeight)),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.ceil(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas non disponibile.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Esportazione PNG fallita.'))),
        'image/png',
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
const mdEscape = (s: string) => s.replace(/[\\`*_{}\[\]()#+.!<>|~-]/g, '\\$&');
function allControls(cs: Control[], depth = 0): Control[] {
  return cs.flatMap((c) => [c, ...(depth < 8 ? allControls(childControls(c), depth + 1) : [])]);
}
export function markdownFor(pages: Page[], name: string): string {
  return (
    `# ${mdEscape(name)}\n\n` +
    visiblePages(pages)
      .map(
        (p) =>
          `## ${mdEscape(pageName(p))}\n\n${allControls(controlsOf(p))
            .filter((c) => textOf(c))
            .map(
              (c) =>
                `- **${mdEscape(typeOf(c))}**: ${mdEscape(textOf(c)).replace(/\r?\n/g, '\n  ')}`,
            )
            .join('\n')}\n`,
      )
      .join('\n')
  );
}
const xml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
export function diagramFor(page: Page) {
  const cs = controlsOf(page);
  const nodes = cs.filter((c) =>
    ['Canvas', 'Button', 'Label', 'Paragraph', 'StickyNote', 'RoundButton', 'CallOut'].includes(
      typeOf(c),
    ),
  );
  const nearest = (x: number, y: number): number => {
    const distances = nodes.map((c) => {
      const b = boxOf(c);
      return Math.hypot(Math.max(b.x - x, 0, x - b.x - b.w), Math.max(b.y - y, 0, y - b.y - b.h));
    });
    const best = Math.min(...distances);
    return best <= 200 ? distances.indexOf(best) : -1;
  };
  const edges = cs
    .filter((c) => typeOf(c) === 'Arrow')
    .map((c) => {
      const b = boxOf(c),
        { a, b: end } = arrowPoints(c);
      return {
        source: nearest(b.x + a.x, b.y + a.y),
        target: nearest(b.x + end.x, b.y + end.y),
        left: c.properties?.leftArrow !== 'false' && c.properties?.leftArrow !== false,
        right: c.properties?.rightArrow !== 'false' && c.properties?.rightArrow !== false,
      };
    });
  return { nodes, edges };
}
export function mermaidFor(page: Page): string {
  const { nodes, edges } = diagramFor(page);
  // Numeric entities prevent user text from becoming Mermaid syntax.
  const label = (s: string) =>
    Array.from(s)
      .map((c) => (/[\p{L}\p{N} ]/u.test(c) ? c : `#${c.codePointAt(0)};`))
      .join('');
  return (
    [
      '%% Conversione approssimata: verificare nodi e collegamenti.',
      'flowchart LR',
      ...nodes.map((c, i) => `  n${i}["${label(textOf(c) || typeOf(c))}"]`),
      ...edges.map((e) =>
        e.source < 0 || e.target < 0 || e.source === e.target
          ? '  %% Freccia non associata: verificare il diagramma originale.'
          : `  n${e.source} ${e.left ? '<' : ''}--${e.right ? '>' : '-'} n${e.target}`,
      ),
    ].join('\n') + '\n'
  );
}
export function drawioFor(page: Page): string {
  const { nodes, edges } = diagramFor(page);
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="${xml(pageName(page))}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${nodes
    .map((c, i) => {
      const b = boxOf(c);
      return `<mxCell id="n${i}" value="${xml(textOf(c) || typeOf(c))}" vertex="1" parent="1" style="rounded=0;whiteSpace=wrap;html=0;"><mxGeometry x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" as="geometry"/></mxCell>`;
    })
    .join('')}${edges
    .filter((e) => e.source >= 0 && e.target >= 0 && e.source !== e.target)
    .map(
      (e, i) =>
        `<mxCell id="e${i}" edge="1" parent="1" source="n${e.source}" target="n${e.target}" style="endArrow=${e.right ? 'classic' : 'none'};startArrow=${e.left ? 'classic' : 'none'};"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    )
    .join('')}</root></mxGraphModel></diagram></mxfile>`;
}
