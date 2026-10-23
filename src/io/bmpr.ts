import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {
  createId,
  newControl,
  newPage,
  type Page,
  type Project,
  type Raw,
} from '../model/document';

let sqlPromise: Promise<SqlJsStatic> | undefined;
export function getSql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl }).catch((error) => {
    sqlPromise = undefined;
    throw error;
  });
  return sqlPromise;
}
const decode = (v: SqlValue): string =>
  v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v ?? '');
const encode = (v: string, blob?: boolean): SqlValue => (blob ? new TextEncoder().encode(v) : v);
export function imageDataUri(value: SqlValue): string | undefined {
  // Only passive raster formats are accepted. Never load a URL or SVG from an
  // archive: doing so could leak project data or execute untrusted content.
  const base64 = decode(value).replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return;
  try {
    const head = atob(base64.slice(0, 32));
    const mime = head.startsWith('\x89PNG\r\n\x1a\n')
      ? 'image/png'
      : head.startsWith('\xff\xd8\xff')
        ? 'image/jpeg'
        : head.startsWith('GIF87a') || head.startsWith('GIF89a')
          ? 'image/gif'
          : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP'
            ? 'image/webp'
            : undefined;
    return mime ? `data:${mime};base64,${base64}` : undefined;
  } catch {
    return;
  }
}
function rows(db: Database, sql: string): Record<string, SqlValue>[] {
  const result = db.exec(sql)[0];
  return result
    ? result.values.map((values) =>
        Object.fromEntries(result.columns.map((col, i) => [col.toUpperCase(), values[i]])),
      )
    : [];
}
function json(value: SqlValue, label: string): Raw {
  try {
    const result = JSON.parse(decode(value));
    if (!result || Array.isArray(result) || typeof result !== 'object') throw new Error();
    return result;
  } catch {
    throw new Error(`${label}: JSON non valido. Il file originale non è stato modificato.`);
  }
}
export function readProject(SQL: SqlJsStatic, bytes: Uint8Array, name: string): Project {
  if (new TextDecoder().decode(bytes.slice(0, 16)) !== 'SQLite format 3\0')
    throw new Error('Il file non è un database SQLite .bmpr valido.');
  let db: Database | undefined;
  try {
    db = new SQL.Database(bytes);
    const tables = rows(db, "SELECT name FROM sqlite_master WHERE type='table'").map((r) =>
      String(r.NAME).toUpperCase(),
    );
    if (!tables.includes('INFO') || !tables.includes('RESOURCES'))
      throw new Error('Mancano le tabelle INFO o RESOURCES: formato non supportato.');
    const info = Object.fromEntries(
      rows(db, 'SELECT NAME, VALUE FROM INFO').map((r) => [decode(r.NAME), decode(r.VALUE)]),
    );
    if (info.ArchiveFormat && info.ArchiveFormat.toLowerCase() !== 'bmpr')
      throw new Error('Questo archivio non è un progetto .bmpr.');
    const warnings: string[] = [];
    const schema = info.SchemaVersion ?? 'sconosciuto';
    if (schema !== '2.0')
      warnings.push(
        `Schema ${schema}: compatibilità non verificata. I dati sconosciuti saranno conservati.`,
      );
    const pages: Page[] = [];
    const assets: Record<string, string> = Object.create(null);
    let unsupportedAssets = 0;
    const ids = new Set<string>();
    for (const r of rows(db, 'SELECT * FROM RESOURCES')) {
      let attributes: Raw;
      try {
        attributes = json(r.ATTRIBUTES, `Risorsa ${r.ID}`);
      } catch {
        warnings.push(`Risorsa ${r.ID}: attributi illeggibili, conservata senza modificarla.`);
        continue;
      }
      if (attributes.kind === 'asset') {
        const uri = imageDataUri(r.DATA);
        if (uri) assets[decode(r.ID)] = uri;
        else unsupportedAssets++;
        continue;
      }
      if (attributes.kind !== 'mockup') continue;
      const id = decode(r.ID),
        branchId = r.BRANCHID === null || r.BRANCHID === undefined ? null : decode(r.BRANCHID);
      const key = JSON.stringify([id, branchId]);
      if (ids.has(key))
        throw new Error(
          'Identificatori di pagina duplicati: apertura interrotta per evitare modifiche ambigue.',
        );
      ids.add(key);
      let data: Raw;
      try {
        data = json(r.DATA, `Pagina ${attributes.name || id}`);
      } catch {
        warnings.push(
          `Pagina ${attributes.name || id}: dati illeggibili, conservata senza modificarla.`,
        );
        continue;
      }
      const controls = data.mockup?.controls?.control;
      if (!data.mockup || (controls !== undefined && (!controls || typeof controls !== 'object'))) {
        warnings.push(
          `Pagina ${attributes.name || id}: struttura non supportata, conservata senza modificarla.`,
        );
        continue;
      }
      pages.push({
        key,
        id,
        branchId,
        attributes,
        data,
        originalData: decode(r.DATA),
        originalAttributes: decode(r.ATTRIBUTES),
        dataIsBlob: r.DATA instanceof Uint8Array,
        attributesIsBlob: r.ATTRIBUTES instanceof Uint8Array,
      });
    }
    pages.sort((a, b) => Number(a.attributes.order ?? 0) - Number(b.attributes.order ?? 0));
    if (unsupportedAssets)
      warnings.push(
        `${unsupportedAssets} risorse non visualizzabili: conservate nel file originale.`,
      );
    return {
      name: name.replace(/\.bmpr$/i, ''),
      bytes: bytes.slice(),
      pages,
      warnings,
      schema,
      assets,
    };
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Impossibile leggere il file.');
  } finally {
    db?.close();
  }
}
export function pageChanged(p: Page): boolean {
  return (
    !!p.isNew ||
    JSON.stringify(p.data) !== JSON.stringify(JSON.parse(p.originalData!)) ||
    JSON.stringify(p.attributes) !== JSON.stringify(JSON.parse(p.originalAttributes!))
  );
}
export function writeProject(SQL: SqlJsStatic, project: Project, pages: Page[]): Uint8Array {
  const changed = pages.filter(pageChanged);
  if (!changed.length) return project.bytes.slice();
  const db = new SQL.Database(project.bytes);
  try {
    db.run('BEGIN TRANSACTION');
    const columns = rows(db, 'PRAGMA table_info(RESOURCES)').map((r) =>
      String(r.NAME).toUpperCase(),
    );
    const hasBranch = columns.includes('BRANCHID');
    for (const p of changed) {
      const attrs = structuredClone(p.attributes);
      attrs.modified = Date.now();
      const dataUnchanged =
        p.originalData !== undefined &&
        JSON.stringify(p.data) === JSON.stringify(JSON.parse(p.originalData));
      const values: SqlValue[] = [
        encode(dataUnchanged ? p.originalData! : JSON.stringify(p.data), p.dataIsBlob),
        encode(JSON.stringify(attrs), p.attributesIsBlob),
      ];
      if (p.isNew) {
        // Unknown required columns cannot safely be invented. SQLite constraints
        // fail the transaction, leaving the original project untouched.
        db.run(
          hasBranch
            ? 'INSERT INTO RESOURCES (DATA, ATTRIBUTES, ID, BRANCHID) VALUES (?, ?, ?, ?)'
            : 'INSERT INTO RESOURCES (DATA, ATTRIBUTES, ID) VALUES (?, ?, ?)',
          [...values, p.id, ...(hasBranch ? [p.branchId] : [])],
        );
      } else {
        db.run(
          `UPDATE RESOURCES SET DATA=?, ATTRIBUTES=? WHERE ID=?${hasBranch ? ' AND BRANCHID IS ?' : ''}`,
          [...values, p.id, ...(hasBranch ? [p.branchId] : [])],
        );
        if (db.getRowsModified() !== 1)
          throw new Error(`Salvataggio interrotto: pagina ${p.id} non univoca.`);
      }
    }
    const revision = rows(db, "SELECT VALUE FROM INFO WHERE NAME='ArchiveRevision'")[0];
    if (revision) {
      const value = Number(decode(revision.VALUE));
      if (!Number.isSafeInteger(value) || value < 0)
        throw new Error('ArchiveRevision non riconosciuto: salvataggio interrotto.');
      db.run("UPDATE INFO SET VALUE=? WHERE NAME='ArchiveRevision'", [String(value + 1)]);
    }
    db.run("UPDATE INFO SET VALUE=? WHERE NAME='ArchiveRevisionUUID'", [createId()]);
    db.run('COMMIT');
    const result = db.exec('PRAGMA integrity_check');
    if (result[0]?.values[0]?.[0] !== 'ok')
      throw new Error('Verifica di integrità SQLite fallita.');
    return db.export();
  } finally {
    db.close();
  }
}
export function createDemo(SQL: SqlJsStatic, blank = false): Project {
  const db = new SQL.Database();
  try {
    db.run(
      'CREATE TABLE INFO (NAME TEXT PRIMARY KEY, VALUE TEXT); CREATE TABLE BRANCHES (ID TEXT PRIMARY KEY, ATTRIBUTES TEXT); CREATE TABLE RESOURCES (ID TEXT PRIMARY KEY, BRANCHID TEXT, ATTRIBUTES TEXT, DATA TEXT); CREATE TABLE THUMBNAILS (ID TEXT PRIMARY KEY, DATA BLOB); CREATE TABLE USERS (ID TEXT PRIMARY KEY, DATA TEXT); CREATE TABLE COMMENTS (ID TEXT PRIMARY KEY, DATA TEXT);',
    );
    const branchId = createId();
    db.run('INSERT INTO BRANCHES VALUES (?, ?)', [branchId, JSON.stringify({ name: 'Main' })]);
    for (const [key, value] of Object.entries({
      SchemaVersion: '2.0',
      ArchiveFormat: 'bmpr',
      ArchiveRevision: '1',
      ArchiveRevisionUUID: createId(),
      ArchiveAttributes: JSON.stringify({ name: 'Progetto demo', creationDate: Date.now() }),
    }))
      db.run('INSERT INTO INFO VALUES (?, ?)', [key, value]);
    const p = newPage();
    p.branchId = branchId;
    p.attributes.name = blank ? 'Pagina 1' : '01 · Un’idea prende forma';
    if (!blank) {
      const items: [string, number, number, number, number, string?, string?][] = [
        ['Canvas', 80, 70, 760, 480, '', '#ffffff'],
        ['Label', 120, 105, 600, 40, 'Il tuo prossimo progetto'],
        [
          'Paragraph',
          120,
          155,
          580,
          70,
          'Dai spazio alle idee.\nSeleziona un elemento e inizia a modificarlo.',
        ],
        ['Label', 120, 255, 160, 30, 'Nome progetto'],
        ['TextInput', 120, 290, 420, 44, 'Una nuova idea'],
        ['CheckBox', 120, 360, 400, 30, 'Condividi con il team'],
        ['Button', 120, 430, 200, 48, 'Iniziamo'],
        [
          'StickyNote',
          900,
          110,
          220,
          180,
          'Tutto resta qui.\nI tuoi file non lasciano il browser.',
          '#fff0b3',
        ],
      ];
      const cs: Raw[] = [];
      for (const [type, x, y, w, h, text, color] of items) {
        const c = newControl(type, cs, x, y);
        c.w = String(w);
        c.h = String(h);
        if (text !== undefined) c.properties.text = text;
        if (color) c.properties.color = String(parseInt(color.slice(1), 16));
        cs.push(c);
      }
      cs[1].properties.size = '28';
      p.data.mockup.controls.control = cs;
    }
    db.run('INSERT INTO RESOURCES VALUES (?, ?, ?, ?)', [
      p.id,
      p.branchId,
      JSON.stringify(p.attributes),
      JSON.stringify(p.data),
    ]);
    if (!blank) {
      const flow = newPage(p);
      flow.attributes.name = '02 · Un piccolo flusso';
      const cs: Raw[] = [];
      for (let i = 0; i < 3; i++) {
        const c = newControl('Button', cs, 100 + i * 300, 200);
        c.w = '200';
        c.h = '80';
        c.properties.text = ['Idea', 'Prototipo', 'Condivisione'][i];
        cs.push(c);
        if (i < 2) {
          const arrow = newControl('Arrow', cs, 300 + i * 300, 238);
          arrow.w = '100';
          arrow.properties.p2.x = 100;
          cs.push(arrow);
        }
      }
      flow.data.mockup.controls.control = cs;
      db.run('INSERT INTO RESOURCES VALUES (?, ?, ?, ?)', [
        flow.id,
        flow.branchId,
        JSON.stringify(flow.attributes),
        JSON.stringify(flow.data),
      ]);
    }
    const project = readProject(
      SQL,
      db.export(),
      blank ? 'Senza titolo.bmpr' : 'Progetto demo.bmpr',
    );
    project.synthetic = true;
    project.warnings.push(
      'Progetto sintetico creato dall’editor. Compatibilità con Balsamiq da verificare.',
    );
    return project;
  } finally {
    db.close();
  }
}
