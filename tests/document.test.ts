import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { createDemo, imageDataUri, readProject, writeProject } from '../src/io/bmpr';
import {
  boxOf,
  colorOf,
  controlsOf,
  duplicateControls,
  newControl,
  newPage,
  setControls,
  transformControl,
  visiblePages,
  type Page,
} from '../src/model/document';
import { historyReducer } from '../src/editor/history';
import { drawioFor, markdownFor, mermaidFor, svgFor } from '../src/export/exports';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});
function fixture(blob = false) {
  const demo = createDemo(SQL),
    db = new SQL.Database(demo.bytes);
  const p = demo.pages[0],
    data = structuredClone(p.data);
  data.unknownPageField = { preserve: [1, '2', null] };
  data.mockup.controls.control.push({
    ID: '999',
    typeID: 'FutureControl',
    x: '10',
    y: '15',
    privateField: { preserve: 'yes' },
    properties: { untouched: true },
  });
  db.run('UPDATE RESOURCES SET DATA=? WHERE ID=?', [
    blob ? new TextEncoder().encode(JSON.stringify(data)) : JSON.stringify(data),
    p.id,
  ]);
  db.run('INSERT INTO RESOURCES VALUES (?, ?, ?, ?)', [
    'image-resource',
    p.branchId,
    '{"kind":"asset","unknown":42}',
    new Uint8Array([0, 12, 255, 3]),
  ]);
  db.run('INSERT INTO THUMBNAILS VALUES (?, ?)', [p.id, new Uint8Array([1, 2, 3, 4])]);
  db.run("CREATE TABLE CUSTOM (value BLOB); INSERT INTO CUSTOM VALUES (X'00ABFF');");
  const bytes = db.export();
  db.close();
  return readProject(SQL, bytes, 'synthetic.bmpr');
}
describe('preservation of SQLite archives', () => {
  it('preserves the literal DATA column when only a page name changes', () => {
    const demo = createDemo(SQL),
      db = new SQL.Database(demo.bytes);
    const literal = JSON.stringify(demo.pages[0].data, null, 4) + '\n';
    db.run('UPDATE RESOURCES SET DATA=? WHERE ID=?', [literal, demo.pages[0].id]);
    const p = readProject(SQL, db.export(), 'formatted.bmpr');
    db.close();
    p.pages[0].attributes.name = 'Renamed';
    const after = readProject(SQL, writeProject(SQL, p, p.pages), 'saved.bmpr');
    expect(after.pages[0].originalData).toBe(literal);
  });
  it('updates only the chosen branch when IDs are shared between branches', () => {
    const demo = createDemo(SQL),
      db = new SQL.Database(demo.bytes);
    db.run(
      'ALTER TABLE RESOURCES RENAME TO OLD_RESOURCES; CREATE TABLE RESOURCES (ID TEXT, BRANCHID TEXT, ATTRIBUTES TEXT, DATA TEXT, PRIMARY KEY(ID, BRANCHID)); INSERT INTO RESOURCES SELECT * FROM OLD_RESOURCES; DROP TABLE OLD_RESOURCES;',
    );
    db.run('INSERT INTO RESOURCES SELECT ID, ?, ATTRIBUTES, DATA FROM RESOURCES WHERE ID=?', [
      'alternate',
      demo.pages[0].id,
    ]);
    const p = readProject(SQL, db.export(), 'branches.bmpr');
    db.close();
    const target = p.pages.find((x) => x.branchId === 'alternate')!;
    controlsOf(target)[0].x = '999';
    const after = readProject(SQL, writeProject(SQL, p, p.pages), 'saved.bmpr');
    expect(controlsOf(after.pages.find((x) => x.branchId === 'alternate')!)[0].x).toBe('999');
    expect(
      controlsOf(after.pages.find((x) => x.id === target.id && x.branchId !== 'alternate')!)[0].x,
    ).toBe('80');
  });
  it('returns byte-identical files on no-op, preserving every table', () => {
    const p = fixture();
    expect(writeProject(SQL, p, p.pages)).toEqual(p.bytes);
  });
  it.each([false, true])(
    'edits one page and preserves unknown fields, other pages, assets and tables (blob %s)',
    (blob) => {
      const p = fixture(blob),
        pages = structuredClone(p.pages);
      controlsOf(pages[0])[1].properties.text = 'A safe edit';
      const result = writeProject(SQL, p, pages),
        after = readProject(SQL, result, 'copy.bmpr');
      expect(controlsOf(after.pages[0])[1].properties.text).toBe('A safe edit');
      expect(after.pages[0].data.unknownPageField).toEqual(p.pages[0].data.unknownPageField);
      expect(controlsOf(after.pages[0]).at(-1)).toEqual(controlsOf(p.pages[0]).at(-1));
      expect(after.pages[1].originalData).toBe(p.pages[1].originalData);
      const beforeDb = new SQL.Database(p.bytes),
        afterDb = new SQL.Database(result);
      for (const table of ['THUMBNAILS', 'BRANCHES', 'USERS', 'COMMENTS', 'CUSTOM'])
        expect(afterDb.exec(`SELECT * FROM ${table}`)).toEqual(
          beforeDb.exec(`SELECT * FROM ${table}`),
        );
      expect(afterDb.exec("SELECT * FROM RESOURCES WHERE ID='image-resource'")).toEqual(
        beforeDb.exec("SELECT * FROM RESOURCES WHERE ID='image-resource'"),
      );
      expect(
        afterDb.exec("SELECT VALUE FROM INFO WHERE NAME='ArchiveRevision'")[0].values[0][0],
      ).toBe('2');
      expect(
        afterDb.exec('SELECT typeof(DATA) FROM RESOURCES WHERE ID=' + `'${p.pages[0].id}'`)[0]
          .values[0][0],
      ).toBe(blob ? 'blob' : 'text');
      expect(afterDb.exec('PRAGMA integrity_check')[0].values[0][0]).toBe('ok');
      beforeDb.close();
      afterDb.close();
    },
  );
  it('adds pages, trashes and restores without deleting original rows', () => {
    const p = fixture(),
      pages = structuredClone(p.pages),
      added = newPage(pages[0]);
    added.attributes.name = 'New';
    pages.push(added);
    pages[0].attributes.trashed = true;
    const after = readProject(SQL, writeProject(SQL, p, pages), 'copy.bmpr');
    expect(after.pages).toHaveLength(3);
    expect(visiblePages(after.pages)).toHaveLength(2);
    after.pages[0].attributes.trashed = false;
    expect(
      visiblePages(readProject(SQL, writeProject(SQL, after, after.pages), 'restored.bmpr').pages),
    ).toHaveLength(3);
  });
  it('does not mutate model or original buffer when saving', () => {
    const p = fixture(),
      before = JSON.stringify(p),
      bytes = p.bytes.slice(),
      pages = structuredClone(p.pages);
    pages[0].attributes.name = 'Edited';
    const snapshot = JSON.stringify(pages);
    writeProject(SQL, p, pages);
    expect(JSON.stringify(pages)).toBe(snapshot);
    expect(JSON.stringify(p)).toBe(before);
    expect(p.bytes).toEqual(bytes);
  });
  it('rejects non-SQLite input and preserves malformed resources while warning', () => {
    expect(() => readProject(SQL, new Uint8Array([1, 2]), 'x.bmpr')).toThrow('SQLite');
    const p = fixture(),
      db = new SQL.Database(p.bytes);
    db.run('UPDATE RESOURCES SET DATA=? WHERE ID=?', ['invalid-json', p.pages[0].id]);
    const bytes = db.export();
    db.close();
    const result = readProject(SQL, bytes, 'x.bmpr');
    expect(result.warnings.some((w) => w.includes('illeggibili'))).toBe(true);
    expect(result.pages).toHaveLength(1);
    expect(writeProject(SQL, result, result.pages)).toEqual(bytes);
  });
  it('fails safely when additional required columns prohibit adding pages', () => {
    const db = new SQL.Database();
    db.run(
      "CREATE TABLE INFO(NAME TEXT, VALUE TEXT); INSERT INTO INFO VALUES('ArchiveFormat','bmpr'); CREATE TABLE RESOURCES(ID TEXT PRIMARY KEY, DATA TEXT, ATTRIBUTES TEXT, REQUIRED_UNKNOWN TEXT NOT NULL);",
    );
    const bytes = db.export();
    db.close();
    const p = readProject(SQL, bytes, 'future.bmpr');
    expect(() => writeProject(SQL, p, [newPage()])).toThrow();
    expect(p.bytes).toEqual(bytes);
  });
});
describe('editor model and history', () => {
  it('normalizes measured size, negative automatic dimensions and numeric colours without mutation', () => {
    const c = { x: '10', y: '20', w: '-1', measuredW: '81', measuredH: '22' },
      original = JSON.stringify(c);
    expect(boxOf(c)).toEqual({ x: 10, y: 20, w: 81, h: 22 });
    expect(colorOf('10667209')).toBe('#a2c4c9');
    expect(JSON.stringify(c)).toBe(original);
  });
  it('scales arrow endpoints and preserves normalized curvature and unknown fields', () => {
    const c = newControl('Arrow', []);
    c.custom = true;
    transformControl(c, { x: 40, y: 80, w: 360, h: 8 });
    expect(c.properties.p2).toEqual({ x: 360, y: 4 });
    expect(c.properties.p1).toEqual({ x: 0.5, y: 0 });
    expect(c.custom).toBe(true);
  });
  it('recognizes real group nesting and scales children without losing their fields', () => {
    const c = {
      typeID: '__group__',
      w: '100',
      h: '100',
      children: {
        controls: {
          control: [
            { ID: '1', typeID: 'Label', x: '10', y: '20', w: '30', h: '40', future: 'kept' },
          ],
        },
      },
    };
    transformControl(c, { x: 50, y: 50, w: 200, h: 300 });
    expect(c.children.controls.control[0]).toMatchObject({
      x: '20',
      y: '60',
      w: '60',
      h: '120',
      future: 'kept',
    });
  });
  it('duplicates with fresh ids and undo restores exact snapshots', () => {
    const p = createDemo(SQL),
      c = controlsOf(p.pages[0]);
    const copy = duplicateControls(c.slice(0, 2), c);
    expect(new Set([...c, ...copy].map((c) => c.ID)).size).toBe(c.length + 2);
    const next = structuredClone(p.pages);
    setControls(next[0], [...c, ...copy]);
    let h = historyReducer(
      { past: [], present: p.pages, future: [] },
      { type: 'commit', pages: next },
    );
    h = historyReducer(h, { type: 'undo' });
    expect(h.present).toEqual(p.pages);
    h = historyReducer(h, { type: 'redo' });
    expect(h.present).toEqual(next);
    h = historyReducer(h, { type: 'undo' });
    h = historyReducer(h, { type: 'commit', pages: [] });
    expect(h.future).toHaveLength(0);
  });
});
describe('exports', () => {
  it('resolves passive embedded images and rejects external URLs and active SVGs', () => {
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    expect(imageDataUri(png)).toBe(`data:image/png;base64,${png}`);
    expect(imageDataUri('https://example.test/image.png')).toBeUndefined();
    expect(imageDataUri(btoa('<svg onload="alert(1)"></svg>'))).toBeUndefined();
    const project = createDemo(SQL),
      p = project.pages[0],
      db = new SQL.Database(project.bytes);
    db.run('INSERT INTO RESOURCES VALUES (?, ?, ?, ?)', [
      'test-image',
      p.branchId,
      '{"kind":"asset"}',
      png,
    ]);
    const reread = readProject(SQL, db.export(), 'images.bmpr');
    db.close();
    expect(reread.assets!['test-image']).toBe(`data:image/png;base64,${png}`);
    setControls(reread.pages[0], [
      { typeID: 'Image', w: '30', h: '30', properties: { src: { ID: 'test-image' } } },
    ]);
    expect(svgFor(reread.pages[0], false, reread.assets)).toContain('data:image/png;base64,');
  });
  it('escapes SVG and draw.io content, including malicious text', () => {
    const p = createDemo(SQL).pages[0];
    controlsOf(p)[1].properties.text = '<script>alert("x")</script>';
    expect(svgFor(p)).not.toContain('<script>');
    expect(svgFor(p)).toContain('&lt;script&gt;');
    expect(drawioFor(p)).not.toContain('<script>');
    expect(drawioFor(p)).toContain('&lt;script&gt;');
  });
  it('exports known flow connections and labels without injecting Mermaid code', () => {
    const p = createDemo(SQL).pages[1];
    expect(mermaidFor(p)).toContain('n0 --> n1');
    expect(mermaidFor(p)).toContain('n1 --> n2');
    controlsOf(p)[0].properties.text = '"]\nclick n0 "https://invalid.test"';
    expect(mermaidFor(p)).not.toContain('\nclick');
    expect(mermaidFor(p)).toContain('#34;');
  });
  it('exports all live pages and excludes trashed pages', () => {
    const p = createDemo(SQL),
      pages: Page[] = structuredClone(p.pages);
    pages[1].attributes.trashed = true;
    const md = markdownFor(pages, 'Demo');
    expect(md).toContain('Il tuo prossimo progetto');
    expect(md).not.toContain('Un piccolo flusso');
  });
});
