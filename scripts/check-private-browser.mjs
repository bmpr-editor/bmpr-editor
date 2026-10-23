// Optional browser smoke test. No screenshots, traces, mockup copies or names
// are written. Requires an already running local app and a local sample root.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import initSqlJs from 'sql.js';
import { preview } from 'vite';

const root = process.argv[2];
const baseURL = process.argv[3] ?? 'http://127.0.0.1:4179';
if (!root)
  throw new Error('Usage: node scripts/check-private-browser.mjs SAMPLE_ROOT [LOCAL_APP_URL]');
const files = execFileSync('rg', ['--files', '--hidden', '-g', '*.bmpr', '-g', '*.BMPR', root], {
  encoding: 'utf8',
})
  .trim()
  .split(/\r?\n/);
const SQL = await initSqlJs();
const picks = new Map();
for (const file of files) {
  const db = new SQL.Database(readFileSync(file));
  try {
    const version = db.exec("SELECT VALUE FROM INFO WHERE NAME='SchemaVersion'")[0]?.values[0]?.[0];
    if (!picks.has(`schema-${version}`)) picks.set(`schema-${version}`, file);
    const data = db.exec('SELECT DATA FROM RESOURCES')[0]?.values ?? [];
    if (
      !picks.has('group') &&
      data.some((r) => typeof r[0] === 'string' && r[0].includes('"__group__"'))
    )
      picks.set('group', file);
    if (
      !picks.has('images') &&
      data.some((r) => typeof r[0] === 'string' && r[0].includes('"Image"'))
    )
      picks.set('images', file);
    if (
      !picks.has('table') &&
      data.some((r) => typeof r[0] === 'string' && r[0].includes('"DataGrid"'))
    )
      picks.set('table', file);
    if (picks.size >= 5) break;
  } finally {
    db.close();
  }
}
const localServer = !process.argv[3] ? await preview({ configFile: false, preview: { host: '127.0.0.1', port: 4179, strictPort: true } }) : undefined;
const browser = await chromium.launch(
  process.env.BMPR_TEST_BROWSER ? { executablePath: process.env.BMPR_TEST_BROWSER } : {},
);
let checked = 0;
try {
  for (const file of new Set(picks.values())) {
    const page = await browser.newPage();
    let errors = 0,
      outgoing = 0;
    page.on('pageerror', () => errors++);
    page.on('request', (r) => {
      if (!r.url().startsWith(new URL(baseURL).origin) && !/^(data:|blob:)/.test(r.url()))
        outgoing++;
    });
    try {
      await page.goto(baseURL);
      await page
        .getByLabel('Apri file bmpr')
        .setInputFiles({
          name: 'private.bmpr',
          mimeType: 'application/octet-stream',
          buffer: readFileSync(file),
        });
      await page.getByTestId('canvas').waitFor({ timeout: 30_000 });
      const pages = page.locator('.page-item');
      const count = await pages.count();
      for (const i of new Set([0, Math.floor(count / 2), count - 1])) {
        if (i >= 0) {
          await pages.nth(i).click();
          await page.getByTestId('canvas').waitFor();
        }
      }
      if (errors || outgoing)
        throw new Error('Private browser verification failed (content omitted).');
      checked++;
    } catch {
      throw new Error(
        `Private browser verification failed at anonymous sample ${checked}. No content recorded.`,
      );
    } finally {
      await page.close();
    }
  }
  console.log(
    JSON.stringify({
      privateBrowserSamples: checked,
      noPageErrors: true,
      externalRequests: 0,
      artifactsWritten: 0,
    }),
  );
} finally {
  await browser.close();
  await new Promise(resolve => localServer ? localServer.httpServer.close(resolve) : resolve());
}
