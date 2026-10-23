// Opt-in only. Customer files stay outside the repository, are read once, and
// modified copies live only in memory. Failures use anonymous file indexes.
import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { readProject, writeProject } from '../src/io/bmpr';
import { controlsOf } from '../src/model/document';

it.skipIf(!process.env.BMPR_SAMPLE_ROOT)(
  'checks private archives in memory without copying their contents into artifacts',
  async () => {
    const SQL = await initSqlJs();
    const paths = execFileSync(
      'rg',
      ['--files', '--hidden', '-g', '*.bmpr', '-g', '*.BMPR', process.env.BMPR_SAMPLE_ROOT!],
      { encoding: 'utf8' },
    )
      .trim()
      .split(/\r?\n/);
    let checked = 0,
      pages = 0,
      changed = 0;
    for (const [index, path] of paths.entries()) {
      const original = new Uint8Array(readFileSync(path));
      const project = readProject(SQL, original, 'private.bmpr');
      expect(
        Buffer.compare(
          Buffer.from(writeProject(SQL, project, project.pages)),
          Buffer.from(original),
        ) === 0,
        `archive ${index}: no-op`,
      ).toBe(true);
      pages += project.pages.length;
      const draft = structuredClone(project.pages),
        target = draft.find((p) => controlsOf(p).length);
      if (target) {
        const control = controlsOf(target)[0];
        control.properties ??= {};
        control.properties.text = 'LOCAL ROUNDTRIP TEST';
        const result = writeProject(SQL, project, draft),
          reread = readProject(SQL, result, 'private.bmpr');
        expect(
          JSON.stringify(reread.pages.find((p) => p.key === target.key)!.data) ===
            JSON.stringify(target.data),
          `archive ${index}: page data`,
        ).toBe(true);
        const before = new SQL.Database(original),
          after = new SQL.Database(result);
        try {
          const tables = before
            .exec("SELECT name FROM sqlite_master WHERE type='table'")[0]
            .values.map((r) => String(r[0]));
          for (const table of tables.filter(
            (t) => !['INFO', 'RESOURCES'].includes(t.toUpperCase()),
          )) {
            const escaped = '"' + table.replaceAll('"', '""') + '"';
            expect(
              JSON.stringify(before.exec(`SELECT * FROM ${escaped}`)) ===
                JSON.stringify(after.exec(`SELECT * FROM ${escaped}`)),
              `archive ${index}: untouched table`,
            ).toBe(true);
          }
          const rows = (db: typeof before) => {
            const q = db.exec('SELECT * FROM RESOURCES')[0],
              id = q.columns.indexOf('ID'),
              branch = q.columns.indexOf('BRANCHID');
            return q.values.filter(
              (r) =>
                !(
                  String(r[id]) === target.id &&
                  (branch < 0 ||
                    (r[branch] === null ? null : String(r[branch])) === target.branchId)
                ),
            );
          };
          expect(
            JSON.stringify(rows(before)) === JSON.stringify(rows(after)),
            `archive ${index}: other resources`,
          ).toBe(true);
          expect(
            after.exec('PRAGMA integrity_check')[0].values[0][0] === 'ok',
            `archive ${index}: integrity`,
          ).toBe(true);
        } finally {
          before.close();
          after.close();
        }
        changed++;
      }
      checked++;
    }
    console.log(
      JSON.stringify({
        privateArchives: checked,
        pages,
        editedAndReopenedInEditor: changed,
        filesWritten: 0,
      }),
    );
  },
  300_000,
);
