// Private visual review: reads originals, writes comparisons ONLY outside repo.
import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import initSqlJs from 'sql.js';
import { chromium } from '@playwright/test';

const folder = await realpath(path.resolve(process.argv[2]));
const repository = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const relative = path.relative(repository, folder);
if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)))
  throw new Error('Use a temporary directory outside the repository.');
const manifest = JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8'));
const selected = process.argv[3]
  ? process.argv[3].split(',').map(Number)
  : manifest
      .filter((p) => p.size[0] < 2000 && p.size[1] < 1800 && p.controls > 5)
      .slice(0, 10)
      .map((p) => p.sample);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
let browser;
try {
  const { readProject } = await server.ssrLoadModule('/src/io/bmpr.ts');
  const { svgFor } = await server.ssrLoadModule('/src/export/exports.tsx');
  const SQL = await initSqlJs();
  browser = await chromium.launch(
    process.env.BMPR_TEST_BROWSER ? { executablePath: process.env.BMPR_TEST_BROWSER } : {},
  );
  for (const sample of selected) {
    const pair = manifest.find((p) => p.sample === sample);
    const project = readProject(SQL, new Uint8Array(await readFile(pair.file)), 'private.bmpr');
    const modelPage = project.pages.find((p) => p.key === pair.key);
    if (!modelPage) throw new Error(`Missing sample ${sample}`);
    const svg = svgFor(modelPage, false, project.assets);
    const original = (await readFile(pair.image)).toString('base64');
    const page = await browser.newPage({
      viewport: { width: 1800, height: 1200 },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>body{margin:0;background:#eee;font:16px Arial}main{display:grid;grid-template-columns:1fr 1fr;gap:8px}section{background:white;min-width:0}h2{font:16px Arial;margin:0;padding:14px;background:#e1e8f0}img{display:block;width:100%;height:auto}</style><main><section><h2>Campione ${sample} — esportazione di riferimento</h2><img src="data:image/png;base64,${original}"/></section><section><h2>Rendering editor</h2><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"/></section></main>`,
    );
    await page.locator('img').evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
    await page.screenshot({ path: path.join(folder, `comparison-${sample}.png`), fullPage: true });
    await writeFile(path.join(folder, `render-${sample}.svg`), svg);
    await page.close();
    console.log(
      JSON.stringify({
        sample,
        controls: pair.controls,
        types: pair.types,
        referenceSize: pair.size,
      }),
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
