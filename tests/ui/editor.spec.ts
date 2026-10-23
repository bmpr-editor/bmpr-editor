import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('demo: editing, geometry, history, duplication, pages, exports and save round-trip', async ({
  page,
}, testInfo) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:4178') &&
      !r.url().startsWith('blob:') &&
      !r.url().startsWith('data:')
    )
      external.push(r.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Esplora la demo' }).click();
  await expect(page.getByTestId('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Etichetta', exact: true }).click();
  await page.getByLabel('Testo', { exact: true }).fill('Un test locale');
  await page.getByLabel('Testo', { exact: true }).blur();
  await expect(page.locator('svg text').filter({ hasText: 'Un test locale' })).toBeVisible();
  await page.getByLabel('X', { exact: true }).fill('350');
  await page.getByLabel('X', { exact: true }).press('Enter');
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('350');
  await page.getByRole('button', { name: 'Duplica', exact: true }).click();
  await expect(page.locator('[data-control-index]')).toHaveCount(10);
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.locator('[data-control-index]')).toHaveCount(9);
  await page.getByRole('button', { name: 'Ripeti', exact: true }).click();
  await expect(page.locator('[data-control-index]')).toHaveCount(10);
  await page.getByRole('button', { name: 'Aggiungi pagina', exact: true }).click();
  await expect(page.locator('[data-control-index]')).toHaveCount(0);
  await page.getByLabel('Nome pagina', { exact: true }).fill('Pagina di prova');
  await page.getByLabel('Nome pagina', { exact: true }).blur();
  await page.getByRole('button', { name: 'Pulsante', exact: true }).click();
  await page.getByRole('button', { name: 'Sposta nel cestino' }).click();
  await expect(page.getByText('Cestino (1)')).toBeVisible();
  await page.getByText('Cestino (1)').click();
  await page.getByRole('button', { name: '↶ Pagina di prova' }).click();
  await expect(page.getByLabel('Nome pagina')).toHaveValue('Pagina di prova');
  for (const name of ['SVG', 'PNG', 'Markdown', 'JSON', 'Mermaid', 'draw.io']) {
    await page.getByRole('button', { name: 'Esporta ↗' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(`^${name}`) })
      .click();
    const file = await downloadPromise;
    const path = await file.path();
    expect((await fs.stat(path!)).size).toBeGreaterThan(30);
    if (name === 'PNG')
      expect((await fs.readFile(path!)).subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
  }
  await page.getByRole('button', { name: 'Salva copia…' }).click();
  await expect(page.getByRole('button', { name: 'Scarica copia .bmpr' })).toBeDisabled();
  await page.getByLabel('Abilita il download sperimentale').check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica copia .bmpr' }).click();
  const file = await downloadPromise,
    path = await file.path();
  await page
    .getByLabel('Apri file bmpr')
    .setInputFiles({
      name: 'roundtrip.bmpr',
      mimeType: 'application/octet-stream',
      buffer: await fs.readFile(path!),
    });
  await expect(page.getByRole('button', { name: /Pagina di prova 03/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('editor-demo.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('pointer movement, resizing, text editing, keyboard and sketch', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Esplora la demo' }).click();
  await page.getByTestId('canvas').waitFor();
  await page.getByRole('button', { name: 'Etichetta', exact: true }).click();
  const control = page.locator('[data-control-index="8"]');
  const before = await page.getByLabel('X', { exact: true }).inputValue();
  const box = await control.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  expect(Number(await page.getByLabel('X', { exact: true }).inputValue())).toBeGreaterThan(
    Number(before),
  );
  const width = Number(await page.getByLabel('Larghezza').inputValue());
  const handle = await page.locator('[data-handle="se"]').boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x + 50, handle!.y + 30, { steps: 4 });
  await page.mouse.up();
  expect(Number(await page.getByLabel('Larghezza').inputValue())).toBeGreaterThan(width);
  await control.dblclick();
  await page.getByLabel('Modifica testo elemento').fill('Test doppio clic');
  await page.getByRole('button', { name: 'Applica testo' }).click();
  await expect(control).toContainText('Test doppio clic');
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Control+d');
  await expect(page.locator('[data-control-index]')).toHaveCount(10);
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-control-index]')).toHaveCount(9);
  await page.getByLabel('Stile sketch').check();
  await expect(page.getByTestId('canvas').locator('path').first()).toBeVisible();
});

test('invalid files report an error without replacing the open project', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Esplora la demo' }).click();
  await page.getByTestId('canvas').waitFor();
  await page
    .getByLabel('Apri file bmpr')
    .setInputFiles({
      name: 'invalid.bmpr',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('not sqlite'),
    });
  await expect(page.getByRole('alert')).toContainText('SQLite');
  await expect(page.locator('[data-control-index]')).toHaveCount(8);
});

test('responsive layout and welcome screenshot contain only synthetic content', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('welcome.png'), fullPage: true });
  await page.getByRole('button', { name: 'Esplora la demo' }).click();
  await expect(page.getByTestId('canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('editor-pristine.png'), fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Etichetta', exact: true }).click();
  await expect(page.getByLabel('Testo', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('tablet.png'), fullPage: true });
});
