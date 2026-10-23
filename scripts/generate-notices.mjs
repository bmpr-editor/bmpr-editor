import { readFile, mkdir, writeFile } from 'node:fs/promises';

const packages = ['react', 'react-dom', 'scheduler', 'sql.js', 'roughjs', 'hachure-fill', 'path-data-parser', 'points-on-curve', 'points-on-path'];
const notices = ['Third-party libraries bundled with bmpr-editor.\nThe application itself has no assigned distribution license yet.\n'];
for (const name of packages) {
  const directory = `node_modules/${name}`;
  const manifest = JSON.parse(await readFile(`${directory}/package.json`, 'utf8'));
  const license = await readFile(`${directory}/LICENSE`, 'utf8');
  notices.push(`\n${'='.repeat(72)}\n${name} ${manifest.version}\n${'='.repeat(72)}\n\n${license}`);
}
await mkdir('public', { recursive: true });
await writeFile('public/third-party-notices.txt', notices.join('\n'), 'utf8');
console.log(`Collected license notices for ${packages.length} runtime libraries.`);
