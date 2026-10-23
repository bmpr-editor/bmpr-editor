// Raw objects are deliberately retained: normalizing the file in place would lose
// unknown fields and change types which other editors may rely on.
export type Raw = Record<string, any>;
export type Control = Raw;
export interface Page {
  key: string;
  id: string;
  branchId: string | null;
  attributes: Raw;
  data: Raw;
  originalData?: string;
  originalAttributes?: string;
  dataIsBlob?: boolean;
  attributesIsBlob?: boolean;
  isNew?: boolean;
}
export interface Project {
  name: string;
  bytes: Uint8Array;
  pages: Page[];
  warnings: string[];
  schema: string;
  assets?: Record<string, string>;
  synthetic?: boolean;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function createId(): string {
  // getRandomValues also works over a private LAN HTTP connection, where
  // browsers may not expose randomUUID (a secure-context-only API).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase();
}
export const number = (value: unknown, fallback = 0): number => {
  if (value === null || value === '' || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(-1e7, Math.min(1e7, n)) : fallback;
};
export const typeOf = (c: Control): string =>
  String(c.typeID ?? 'Sconosciuto')
    .split('::')
    .pop()!;
export const controlsOf = (p: Page): Control[] => {
  const controls = p.data.mockup?.controls?.control;
  return Array.isArray(controls)
    ? controls
    : controls && typeof controls === 'object'
      ? [controls]
      : [];
};
export function setControls(p: Page, controls: Control[]): void {
  p.data.mockup ??= {};
  p.data.mockup.controls ??= {};
  p.data.mockup.controls.control = controls;
}
export const visiblePages = (pages: Page[]) => pages.filter((p) => !isTrashed(p));
export const isTrashed = (p: Page) =>
  p.attributes.trashed === true || p.attributes.trashed === 'true' || p.attributes.trashed === 1;
export const pageName = (p: Page) => String(p.attributes.name || 'Pagina senza nome');
export const textOf = (c: Control) => String(c.properties?.text ?? '');
export function boxOf(c: Control): Box {
  const t = typeOf(c);
  const defaultW = t === 'Icon' ? 32 : t === 'Label' ? Math.max(80, textOf(c).length * 8) : 160;
  const defaultH = ['Label', 'Button', 'TextInput', 'ComboBox', 'CheckBox', 'RadioButton'].includes(
    t,
  )
    ? 36
    : t === 'Icon'
      ? 32
      : 100;
  const width = number(c.w, -1),
    height = number(c.h, -1);
  return {
    x: number(c.x),
    y: number(c.y),
    w: Math.max(1, width >= 0 ? width : number(c.measuredW, defaultW)),
    h: Math.max(1, height >= 0 ? height : number(c.measuredH, defaultH)),
  };
}
export function colorOf(value: unknown, fallback = '#e5edf2'): string {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value;
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffff
    ? `#${n.toString(16).padStart(6, '0')}`
    : fallback;
}
export const colorValue = (hex: string) => String(parseInt(hex.replace('#', ''), 16));
export function arrowGeometry(c: Control) {
  const { w, h } = boxOf(c),
    p = c.properties ?? {};
  const a = { x: number(p.p0?.x), y: number(p.p0?.y, h / 2) };
  const b = { x: number(p.p2?.x, w), y: number(p.p2?.y, h / 2) };
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = number(p.p1?.x, 0.5),
    offset = number(p.p1?.y);
  const midpoint = { x: a.x + dx * t + dy * offset, y: a.y + dy * t - dx * offset };
  const q = { x: 2 * midpoint.x - (a.x + b.x) / 2, y: 2 * midpoint.y - (a.y + b.y) / 2 };
  return { a, b, q, curve: number(p.curvature) !== 0 || offset !== 0 };
}
export function visualBoxOf(c: Control): Box {
  const box = boxOf(c);
  if (typeOf(c) !== 'Arrow') return box;
  const { a, b, q, curve } = arrowGeometry(c);
  const points = [a, b];
  if (curve)
    for (const axis of ['x', 'y'] as const) {
      const t = (a[axis] - q[axis]) / (a[axis] - 2 * q[axis] + b[axis]);
      if (t > 0 && t < 1)
        points.push({
          x: (1 - t) ** 2 * a.x + 2 * t * (1 - t) * q.x + t ** 2 * b.x,
          y: (1 - t) ** 2 * a.y + 2 * t * (1 - t) * q.y + t ** 2 * b.y,
        });
    }
  const left = Math.min(...points.map((p) => p.x)) - 12,
    top = Math.min(...points.map((p) => p.y)) - 12;
  return {
    x: box.x + left,
    y: box.y + top,
    w: Math.max(...points.map((p) => p.x)) + 12 - left,
    h: Math.max(...points.map((p) => p.y)) + 12 - top,
  };
}
export function boundsOf(controls: Control[], padding = 48): Box {
  if (!controls.length) return { x: 0, y: 0, w: 1000, h: 700 };
  const boxes = controls.map(visualBoxOf);
  const x = Math.min(...boxes.map((b) => b.x)) - padding;
  const y = Math.min(...boxes.map((b) => b.y)) - padding;
  return {
    x,
    y,
    w: Math.max(200, Math.max(...boxes.map((b) => b.x + b.w)) - x + padding),
    h: Math.max(160, Math.max(...boxes.map((b) => b.y + b.h)) - y + padding),
  };
}
export function putNumber(target: Raw, key: string, value: number): void {
  target[key] = typeof target[key] === 'number' ? value : String(value);
}
export function transformControl(c: Control, box: Box): void {
  const before = boxOf(c);
  for (const key of ['x', 'y', 'w', 'h'] as const)
    putNumber(c, key, Math.round(box[key] * 100) / 100);
  // Endpoints are local pixels. p1 is retained because its interpretation is
  // still approximate; it is not a pixel coordinate in the observed format.
  if (typeOf(c) === 'Arrow' && (box.w !== before.w || box.h !== before.h)) {
    for (const key of ['p0', 'p2']) {
      const p = c.properties?.[key];
      if (p && typeof p === 'object') {
        putNumber(p, 'x', (number(p.x) * box.w) / before.w);
        putNumber(p, 'y', (number(p.y) * box.h) / before.h);
      }
    }
  }
  if (box.w !== before.w || box.h !== before.h) {
    for (const child of childControls(c)) {
      const b = boxOf(child),
        sx = box.w / before.w,
        sy = box.h / before.h;
      transformControl(child, { x: b.x * sx, y: b.y * sy, w: b.w * sx, h: b.h * sy });
    }
  }
}
export const supportedTypes = [
  'Canvas',
  'Label',
  'Paragraph',
  'TextInput',
  'TextArea',
  'Button',
  'ComboBox',
  'CheckBox',
  'RadioButton',
  'DataGrid',
  'Window',
  'BrowserWindow',
  'Arrow',
  'Icon',
  'HRule',
  'VRule',
  'FieldSet',
  'StickyNote',
  'Group',
  '__group__',
  'RoundButton',
  'CallOut',
  'SubTitle',
  'Link',
  'RedX',
  'ModalScreen',
  'Tooltip',
  'TabBar',
  'ButtonBar',
  'MenuBar',
  'CheckBoxGroup',
  'RadioButtonGroup',
  'DateChooser',
  'NumericStepper',
  'SearchBox',
  'HCurly',
  'VCurly',
  'Image',
  'LineOfText',
];
export const palette = [
  ['Canvas', 'Riquadro'],
  ['Label', 'Etichetta'],
  ['Paragraph', 'Paragrafo'],
  ['Button', 'Pulsante'],
  ['TextInput', 'Campo testo'],
  ['TextArea', 'Area testo'],
  ['ComboBox', 'Menu a tendina'],
  ['CheckBox', 'Checkbox'],
  ['RadioButton', 'Radio'],
  ['DataGrid', 'Tabella'],
  ['Arrow', 'Freccia'],
  ['Icon', 'Icona'],
  ['Window', 'Finestra'],
  ['BrowserWindow', 'Browser'],
  ['StickyNote', 'Nota'],
];
export function newControl(type: string, controls: Control[], x = 100, y = 100): Control {
  const ids = new Set(controls.map((c) => String(c.ID)));
  let id = 0;
  while (ids.has(String(id))) id++;
  const c: Control = {
    ID: String(id),
    typeID: type,
    x: String(x),
    y: String(y),
    w: '180',
    h: '40',
    zOrder: String(Math.max(-1, ...controls.map((c) => number(c.zOrder))) + 1),
    properties: {},
  };
  const texts: Record<string, string> = {
    Label: 'Etichetta',
    Paragraph: 'Scrivi qui il tuo testo.\nUn’idea prende forma.',
    Button: 'Continua',
    TextInput: 'Testo',
    TextArea: 'Testo su più righe',
    ComboBox: 'Scegli un’opzione',
    CheckBox: 'Opzione',
    RadioButton: 'Opzione',
    DataGrid: 'Nome, Stato, Note\nElemento A, Pronto, —\nElemento B, Bozza, —',
    Window: 'Finestra',
    BrowserWindow: 'https://esempio.test',
    StickyNote: 'Una nuova idea',
  };
  if (type in texts) c.properties.text = texts[type];
  if (['Canvas', 'Paragraph', 'TextArea', 'StickyNote'].includes(type)) {
    c.w = '240';
    c.h = '140';
  }
  if (['Window', 'BrowserWindow', 'DataGrid'].includes(type)) {
    c.w = '420';
    c.h = '240';
  }
  if (type === 'Canvas') c.properties.color = colorValue('#e9eff5');
  if (type === 'StickyNote') c.properties.color = colorValue('#fff0b3');
  if (type === 'Icon') {
    c.w = '40';
    c.h = '40';
    c.properties.icon = { ID: 'circle-solid', size: 'medium' };
  }
  if (type === 'Arrow') {
    c.w = '180';
    c.h = '4';
    c.properties = {
      p0: { x: 0, y: 2 },
      p1: { x: 0.5, y: 0 },
      p2: { x: 180, y: 2 },
      rightArrow: 'true',
      leftArrow: 'false',
      curvature: '0',
    };
  }
  return c;
}
export function newPage(template?: Page): Page {
  const id = createId();
  return {
    key: `${id}:new`,
    id,
    branchId: template?.branchId ?? null,
    attributes: {
      kind: 'mockup',
      name: 'Nuova pagina',
      trashed: false,
      order: Date.now(),
      creationDate: Date.now(),
    },
    data: { mockup: { version: '1.0', controls: { control: [] } } },
    isNew: true,
  };
}
export function childControls(c: Control): Control[] {
  const children =
    c.children?.controls?.control ??
    c.groupChildrenDescriptors?.control ??
    c.group?.children?.controls?.control ??
    c.group?.controls?.control;
  return Array.isArray(children) ? children : [];
}
export function duplicateControls(source: Control[], existing: Control[]): Control[] {
  const copies = structuredClone(source);
  const occupied = new Set(existing.map((c) => String(c.ID)));
  let next = 0;
  for (const c of copies) {
    while (occupied.has(String(next))) next++;
    c.ID = String(next);
    occupied.add(String(next));
    putNumber(c, 'x', number(c.x) + 24);
    putNumber(c, 'y', number(c.y) + 24);
    c.zOrder = String(
      Math.max(-1, ...existing.map((x) => number(x.zOrder))) + 1 + copies.indexOf(c),
    );
  }
  return copies;
}
