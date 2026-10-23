"""Build a portable source archive from an explicit allowlist, without private data."""
from pathlib import Path
import hashlib
import zipfile

root = Path(__file__).resolve().parent.parent
output = root / 'artifacts' / 'bmpr-editor-0.1.0.zip'
output.parent.mkdir(exist_ok=True)
top_level = [
    'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts',
    'playwright.config.ts', 'index.html', 'Dockerfile', 'compose.yaml',
    'nginx.conf', '.dockerignore', '.gitignore', '.prettierrc.json',
    'README.md', 'VALIDAZIONE.md', 'CLAUDE.md', 'PIANO_editor_bmpr.md',
    'NOTE_bmpr_cantiere_personale.md',
]
paths = [root / name for name in top_level]
for directory in ['src', 'tests', 'scripts', 'docs', 'public']:
    for path in (root / directory).rglob('*'):
        if path.is_file() and path.suffix in {'.ts', '.tsx', '.css', '.py', '.mjs', '.md', '.png', '.txt'}:
            if 'generated' not in path.parts and '__pycache__' not in path.parts:
                paths.append(path)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(set(paths)):
        archive.write(path, path.relative_to(root).as_posix())
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'package-lock.json' in archive.namelist()
    assert not any(name.endswith('.bmpr') or name.startswith(('node_modules/', '.git/', 'private-samples/')) for name in archive.namelist())
digest = hashlib.sha256(output.read_bytes()).hexdigest()
(output.parent / (output.name + '.sha256')).write_text(f'{digest}  {output.name}\n', encoding='utf-8')
print(f'{output.name}: {output.stat().st_size} bytes, {len(paths)} files, SHA256 {digest}')
