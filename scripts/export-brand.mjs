import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../assets/logos/', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const browser = await chromium.launch(process.env.BMPR_TEST_BROWSER ? { executablePath: process.env.BMPR_TEST_BROWSER } : {});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const item of manifest) {
    const svg = await readFile(path.join(root, item.file), 'utf8');
    const folder = path.join(root, item.concept);
    await mkdir(path.join(folder, 'png'), { recursive: true });
    await mkdir(path.join(folder, 'print'), { recursive: true });
    const sizes = item.layout === 'mark' ? [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024] : [320, 640, 1280, 2560];
    for (const width of sizes) {
      const height = Math.round(width * item.height / item.width);
      await page.setViewportSize({ width, height });
      const background = item.variant === 'color-white' ? '#fff' : item.variant === 'color-dark' ? '#111827' : 'transparent';
      await page.setContent(`<style>html,body{margin:0;background:${background}}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
      await page.screenshot({ path: path.join(folder, 'png', `${item.layout}-${item.variant}-${width}.png`), omitBackground: true });
    }
    const mm = item.layout === 'mark' ? 50 : 150;
    const heightMM = mm * item.height / item.width;
    await page.setContent(`<style>@page{size:${mm}mm ${heightMM}mm;margin:0}html,body{margin:0}svg{display:block;width:${mm}mm;height:${heightMM}mm}*{-webkit-print-color-adjust:exact}</style>${svg}`);
    await page.pdf({ path: path.join(folder, 'print', `${item.layout}-${item.variant}-${mm}mm.pdf`), preferCSSPageSize: true, printBackground: true });
    console.log(`${item.concept} / ${item.layout} / ${item.variant}`);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.screenshot({ path: path.join(root, 'preview.png'), fullPage: true });
  await page.pdf({ path: path.join(root, 'catalogo.pdf'), format: 'A3', printBackground: true, margin: { top:'12mm', bottom:'12mm', left:'12mm', right:'12mm' } });
} finally {
  await browser.close();
}
