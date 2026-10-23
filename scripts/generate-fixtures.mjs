// Synthetic examples only. No external file is read or copied.
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import initSqlJs from 'sql.js';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { createDemo, writeProject } = await server.ssrLoadModule('/src/io/bmpr.ts');
  const { newControl, setControls, palette } = await server.ssrLoadModule('/src/model/document.ts');
  const { svgFor, markdownFor } = await server.ssrLoadModule('/src/export/exports.tsx');
  const SQL = await initSqlJs();
  const directory = 'tests/fixtures/generated';
  await mkdir(directory, { recursive: true });
  const examples = [
    ['form', ['Label', 'TextInput', 'TextArea', 'Button', 'CheckBox', 'RadioButton', 'ComboBox']],
    ['table', ['DataGrid', 'Window']],
    ['icons-arrows', ['Icon', 'Arrow', 'Canvas']],
    ['controls', palette.map(([type]) => type)],
  ];
  for (const [name, types] of examples) {
    const project = createDemo(SQL, true),
      page = project.pages[0],
      controls = [];
    for (const [i, type] of types.entries())
      controls.push(newControl(type, controls, 60 + (i % 3) * 460, 60 + Math.floor(i / 3) * 300));
    if (name === 'icons-arrows') {
      controls[1].properties.p1.y = 0.3;
      controls[1].h = '100';
    }
    setControls(page, controls);
    await writeFile(`${directory}/${name}.bmpr`, writeProject(SQL, project, project.pages));
    await writeFile(`${directory}/${name}.svg`, svgFor(page));
  }
  const demo = createDemo(SQL);
  await writeFile(`${directory}/multipage.bmpr`, demo.bytes);
  await writeFile(`${directory}/multipage.md`, markdownFor(demo.pages, 'Demo'));
  console.log(
    `Generated five synthetic BMPR examples and SVG references in ${directory}. References are from this editor, not from Balsamiq.`,
  );
} finally {
  await server.close();
}
