import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { createDemo, getSql, readProject, writeProject } from '../io/bmpr';
import {
  boxOf,
  controlsOf,
  duplicateControls,
  isTrashed,
  newControl,
  newPage,
  number,
  pageName,
  palette,
  setControls,
  supportedTypes,
  textOf,
  transformControl,
  typeOf,
  visiblePages,
  type Control,
  type Page,
  type Project,
} from '../model/document';
import { historyReducer } from '../editor/history';
import { download, drawioFor, markdownFor, mermaidFor, pngFor, svgFor } from '../export/exports';
import { Canvas } from './Canvas';
import { Field, Inspector } from './Inspector';

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button aria-label="Chiudi finestra" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: [], future: [] });
  const [active, setActive] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sketch, setSketch] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [modal, setModal] = useState<'export' | 'save' | 'help' | 'debug' | null>(null);
  const [experimental, setExperimental] = useState(false);
  const [textEditor, setTextEditor] = useState<{ index: number; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    clipboard = useRef<Control[]>([]);
  const pages = history.present,
    livePages = visiblePages(pages);
  const page = livePages.find((p) => p.key === active) ?? livePages[0];
  const controls = page ? controlsOf(page) : [];
  const selection = selected.filter((i) => controls[i]);
  const signature = JSON.stringify(pages),
    dirty = !!project && signature !== saved;
  const unsupported = controls.filter((c) => !supportedTypes.includes(typeOf(c))).length;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    setSelected([]);
  }, [page?.key]);
  const run = async (work: () => void | Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };
  const replace = (p: Project) => {
    setProject(p);
    dispatch({ type: 'reset', pages: p.pages });
    setSaved(JSON.stringify(p.pages));
    setActive(visiblePages(p.pages)[0]?.key ?? '');
    setSelected([]);
    setModal(null);
    setTextEditor(null);
  };
  const canReplace = () =>
    !dirty ||
    window.confirm('Ci sono modifiche non scaricate. Vuoi chiudere questo progetto e continuare?');
  const openFile = async (file?: File) => {
    if (!file || busy || !canReplace()) return;
    await run(async () => {
      if (file.size > 100 * 1024 * 1024)
        throw new Error('Il file supera il limite di 100 MB di questa versione.');
      const SQL = await getSql(),
        bytes = new Uint8Array(await file.arrayBuffer());
      replace(readProject(SQL, bytes, file.name));
      setMessage('Progetto aperto. Il file originale resta invariato.');
    });
  };
  const startProject = (blank: boolean) => {
    if (!canReplace()) return;
    void run(async () => replace(createDemo(await getSql(), blank)));
  };
  const commit = (edit: (draft: Page[]) => void) => {
    const next = structuredClone(pages);
    edit(next);
    dispatch({ type: 'commit', pages: next });
  };
  const editPage = (edit: (draft: Page) => void) => {
    if (page)
      commit((next) => {
        const target = next.find((p) => p.key === page.key);
        if (target) edit(target);
      });
  };
  const editSelection = (edit: (control: Control, index: number) => void) =>
    editPage((p) => {
      const cs = controlsOf(p);
      selection.forEach((i) => edit(cs[i], i));
      setControls(p, cs);
    });
  const remove = () => {
    editPage((p) =>
      setControls(
        p,
        controlsOf(p).filter((_, i) => !selection.includes(i)),
      ),
    );
    setSelected([]);
  };
  const duplicate = (source = selection.map((i) => controls[i])) => {
    if (!source.length || !page) return;
    const copies = duplicateControls(source, controls);
    editPage((p) => setControls(p, [...controlsOf(p), ...copies]));
    setSelected(copies.map((_, i) => controls.length + i));
  };
  const undo = () => {
    dispatch({ type: 'undo' });
    setSelected([]);
  };
  const redo = () => {
    dispatch({ type: 'redo' });
    setSelected([]);
  };
  const save = () =>
    void run(async () => {
      if (!project) return;
      const bytes = writeProject(await getSql(), project, pages);
      download(bytes.slice().buffer, `${project.name}-modificato.bmpr`, 'application/octet-stream');
      setSaved(signature);
      setModal(null);
      setMessage(
        'Copia scaricata. Verifica la riapertura in Balsamiq prima di usarla al posto dell’originale.',
      );
    });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('input, textarea, select, [contenteditable="true"], dialog') ||
        busy ||
        !project
      )
        return;
      const mod = e.ctrlKey || e.metaKey,
        k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        redo();
      } else if (mod && k === 's') {
        e.preventDefault();
        setExperimental(false);
        setModal('save');
      } else if (mod && k === 'a') {
        e.preventDefault();
        setSelected(controls.map((_, i) => i));
      } else if (mod && k === 'c' && selection.length) {
        e.preventDefault();
        clipboard.current = structuredClone(selection.map((i) => controls[i]));
        setMessage('Elementi copiati negli appunti dell’editor.');
      } else if (mod && k === 'x' && selection.length) {
        e.preventDefault();
        clipboard.current = structuredClone(selection.map((i) => controls[i]));
        remove();
      } else if (mod && k === 'v' && clipboard.current.length) {
        e.preventDefault();
        duplicate(clipboard.current);
      } else if (mod && k === 'd') {
        e.preventDefault();
        duplicate();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove();
      } else if (e.key === 'Escape') setSelected([]);
      else if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) &&
        selection.length
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        editSelection((c) => {
          const b = boxOf(c);
          b.x += e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          b.y += e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          transformControl(c, b);
        });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const exportFile = (format: string) =>
    void run(async () => {
      if (!project || !page) return;
      if (format === 'svg')
        download(svgFor(page, sketch, project.assets), `${pageName(page)}.svg`, 'image/svg+xml');
      if (format === 'png')
        download(await pngFor(page, sketch, project.assets), `${pageName(page)}.png`, 'image/png');
      if (format === 'md')
        download(
          markdownFor(pages, project.name),
          `${project.name}.md`,
          'text/markdown;charset=utf-8',
        );
      if (format === 'mmd')
        download(mermaidFor(page), `${pageName(page)}.mmd`, 'text/plain;charset=utf-8');
      if (format === 'drawio')
        download(drawioFor(page), `${pageName(page)}.drawio`, 'application/xml');
      if (format === 'json')
        download(
          JSON.stringify(
            livePages.map((p) => ({ id: p.id, attributes: p.attributes, data: p.data })),
            null,
            2,
          ),
          `${project.name}.json`,
          'application/json',
        );
      setMessage(`Export ${format.toUpperCase()} scaricato.`);
      setModal(null);
    });
  const addPage = () => {
    const p = newPage(page ?? pages[0]);
    p.attributes.name = `Pagina ${pages.length + 1}`;
    commit((next) => next.push(p));
    setActive(p.key);
    setSelected([]);
  };
  const add = (type: string) => {
    if (!page) return;
    const c = newControl(
      type,
      controls,
      100 + (controls.length % 8) * 24,
      100 + (controls.length % 8) * 24,
    );
    editPage((p) => setControls(p, [...controlsOf(p), c]));
    setSelected([controls.length]);
  };
  return (
    <div
      className="app"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        void openFile(e.dataTransfer.files[0]);
      }}
    >
      <input
        type="file"
        accept=".bmpr"
        ref={fileInput}
        aria-label="Apri file bmpr"
        className="visually-hidden"
        onChange={(e) => {
          void openFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            b<span>↗</span>
          </span>
          <strong>
            bmpr<span>-editor</span>
          </strong>
          <span className="version-tag">LOCAL</span>
        </div>
        {project && (
          <div className="project-title" title={project.name}>
            {project.name}
            <span
              className={dirty ? 'dirty-dot' : 'saved-dot'}
              title={dirty ? 'Modifiche non scaricate' : 'Nessuna modifica non scaricata'}
            />
          </div>
        )}
        <div className="top-actions">
          <button disabled={busy} onClick={() => fileInput.current?.click()}>
            Apri file
          </button>
          {project && (
            <>
              <button disabled={busy} onClick={() => startProject(true)}>
                Nuovo
              </button>
              <button disabled={busy || !page} onClick={() => setModal('export')}>
                Esporta ↗
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => {
                  setExperimental(false);
                  setModal('save');
                }}
              >
                Salva copia…
              </button>
            </>
          )}
          <button className="help-button" aria-label="Guida" onClick={() => setModal('help')}>
            ?
          </button>
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button aria-label="Chiudi errore" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {!project ? (
        <main className="welcome">
          <div className="welcome-copy">
            <div className="eyebrow">IL TUO SPAZIO PER PROGETTARE</div>
            <h1>
              Le idee prendono forma.
              <br />
              <em>I file restano tuoi.</em>
            </h1>
            <p>
              Apri un progetto .bmpr, esplora le pagine e modifica i tuoi wireframe. Direttamente
              nel browser.
            </p>
            <div className="welcome-actions">
              <button
                className="primary large"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                Apri un file .bmpr <span>↗</span>
              </button>
              <button className="large" disabled={busy} onClick={() => startProject(false)}>
                Esplora la demo
              </button>
            </div>
            <button className="text-button" disabled={busy} onClick={() => startProject(true)}>
              oppure inizia da un foglio vuoto →
            </button>
            <div className="local-badge">
              <span className="status-dot" /> Nessun upload · Nessun account · Tutto in locale
            </div>
          </div>
          <div className="welcome-visual" aria-hidden="true">
            <div className="mini-toolbar">
              <i />
              <i />
              <i />
              <span>La prossima buona idea</span>
            </div>
            <div className="mini-content">
              <div className="mini-nav" />
              <div className="mini-heading" />
              <div className="mini-line" />
              <div className="mini-line short" />
              <div className="mini-cards">
                <i />
                <i />
                <i />
              </div>
              <div className="mini-button" />
              <div className="mini-note">
                Prova.
                <br />
                Sposta.
                <br />
                Immagina.
              </div>
              <span className="mini-cursor">
                ↖ <small>Tu, qui.</small>
              </span>
            </div>
          </div>
          <div className="welcome-footer">
            Compatibile con file .bmpr · Progetto indipendente · Salvataggio sperimentale
          </div>
        </main>
      ) : (
        <>
          <div className="toolbar">
            <div className="tool-group">
              <button
                className={!panMode ? 'active' : ''}
                title="Seleziona e modifica"
                aria-label="Strumento selezione"
                onClick={() => setPanMode(false)}
              >
                ↖ <span>Seleziona</span>
              </button>
              <button
                className={panMode ? 'active' : ''}
                aria-label="Sposta vista"
                onClick={() => setPanMode(true)}
              >
                ✥ <span>Sposta vista</span>
              </button>
              <i />
              <button
                aria-label="Annulla"
                title="Annulla (Ctrl Z)"
                disabled={!history.past.length}
                onClick={undo}
              >
                ↶
              </button>
              <button
                aria-label="Ripeti"
                title="Ripeti (Ctrl Maiusc Z)"
                disabled={!history.future.length}
                onClick={redo}
              >
                ↷
              </button>
            </div>
            <div className="toolbar-center">{page ? pageName(page) : 'Nessuna pagina'}</div>
            <div className="tool-group">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={sketch}
                  onChange={(e) => setSketch(e.target.checked)}
                />
                Stile sketch
              </label>
              <button
                onClick={() => setModal('debug')}
                title="Ispeziona i dati del progetto"
              >{`{ }`}</button>
            </div>
          </div>
          <div className="workspace">
            <aside className="sidebar">
              <section className="pages-section">
                <div className="panel-heading">
                  <h2>
                    Pagine <span>{livePages.length}</span>
                  </h2>
                  <button aria-label="Aggiungi pagina" onClick={addPage}>
                    +
                  </button>
                </div>
                <div className="page-list">
                  {livePages.map((p, i) => (
                    <button
                      key={p.key}
                      className={`page-item ${page?.key === p.key ? 'active' : ''}`}
                      onClick={() => {
                        setActive(p.key);
                        setSelected([]);
                      }}
                    >
                      <span className="page-icon">▤</span>
                      <span>{pageName(p)}</span>
                      <small>{String(i + 1).padStart(2, '0')}</small>
                    </button>
                  ))}
                </div>
                {page && (
                  <div className="page-settings">
                    <Field
                      label="Nome pagina"
                      value={pageName(page)}
                      onCommit={(v) =>
                        editPage((p) => {
                          p.attributes.name = v.trim() || 'Senza nome';
                        })
                      }
                    />
                    <button
                      className="text-button danger"
                      onClick={() => {
                        editPage((p) => {
                          p.attributes.trashed = true;
                        });
                        setSelected([]);
                      }}
                    >
                      Sposta nel cestino
                    </button>
                  </div>
                )}
                {pages.some(isTrashed) && (
                  <details className="trash">
                    <summary>Cestino ({pages.filter(isTrashed).length})</summary>
                    {pages.filter(isTrashed).map((p) => (
                      <button
                        key={p.key}
                        onClick={() => {
                          commit((next) => {
                            next.find((x) => x.key === p.key)!.attributes.trashed = false;
                          });
                          setActive(p.key);
                        }}
                      >
                        ↶ {pageName(p)}
                      </button>
                    ))}
                  </details>
                )}
              </section>
              <section className="library">
                <div className="panel-heading">
                  <h2>Elementi</h2>
                  <span className="eyebrow">CLIC PER AGGIUNGERE</span>
                </div>
                <input
                  aria-label="Cerca elementi"
                  placeholder="Cerca un elemento…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="palette">
                  {palette
                    .filter(([t, label]) =>
                      `${t} ${label}`.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map(([type, label], i) => (
                      <button
                        key={type}
                        aria-label={label}
                        disabled={!page}
                        onClick={() => add(type)}
                      >
                        <span className="palette-symbol">
                          {(
                            {
                              Canvas: '□',
                              Label: 'T',
                              Paragraph: '≡',
                              Arrow: '⟶',
                              Icon: '☆',
                              CheckBox: '☑',
                              RadioButton: '◉',
                              DataGrid: '▦',
                              StickyNote: '▱',
                            } as Record<string, string>
                          )[type] ?? ['▭', '▤', '▢'][i % 3]}
                        </span>
                        {label}
                      </button>
                    ))}
                </div>
              </section>
            </aside>
            <main className="stage">
              {page ? (
                <Canvas
                  key={project.name + page.key}
                  controls={controls}
                  selected={selection}
                  onSelect={setSelected}
                  onChange={(cs) => editPage((p) => setControls(p, cs))}
                  onEdit={(i) => {
                    setSelected([i]);
                    setTextEditor({ index: i, text: textOf(controls[i]) });
                  }}
                  sketch={sketch}
                  panMode={panMode}
                  assets={project.assets}
                />
              ) : (
                <div className="no-pages">
                  <h2>Uno spazio nuovo</h2>
                  <p>Aggiungi una pagina o ripristinala dal cestino.</p>
                  <button className="primary" onClick={addPage}>
                    Aggiungi pagina
                  </button>
                </div>
              )}
            </main>
            <Inspector
              key={`${page?.key}:${selection.join(',')}`}
              control={selection.length === 1 ? controls[selection[0]] : undefined}
              count={selection.length}
              onGeometry={(field, value) =>
                editSelection((c) => {
                  const b = boxOf(c);
                  transformControl(c, { ...b, [field]: value });
                })
              }
              onProperty={(field, value) =>
                editSelection((c) => {
                  c.properties ??= {};
                  c.properties[field] = value;
                })
              }
              onDelete={remove}
              onDuplicate={() => duplicate()}
              onOrder={(front) => {
                const z = (front ? Math.max : Math.min)(
                  0,
                  ...controls.map((c) => number(c.zOrder)),
                );
                editSelection((c, i) => {
                  c.zOrder = String(z + (front ? 1 : -1) * (i + 1));
                });
              }}
              onAlign={(axis) => {
                const min = Math.min(...selection.map((i) => boxOf(controls[i])[axis]));
                editSelection((c) => transformControl(c, { ...boxOf(c), [axis]: min }));
              }}
            />
          </div>
          <footer className="statusbar">
            <span>
              <span className="status-dot" /> File sul tuo dispositivo
            </span>
            <span>
              {controls.length} elementi{unsupported ? ` · ${unsupported} non supportati` : ''}
            </span>
            <button onClick={() => setModal('debug')}>
              {project.warnings.length ? `${project.warnings.length} note sul formato · ` : ''}
              Schema {project.schema}
            </button>
            <span className="save-status">
              {dirty ? 'Modifiche non scaricate' : 'Nessuna modifica non scaricata'}
            </span>
          </footer>
        </>
      )}
      {busy && (
        <div className="busy" role="status">
          <span className="spinner" />
          Elaborazione in corso…
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      {modal === 'save' && (
        <Modal title="Scarica una copia .bmpr" onClose={() => setModal(null)}>
          <p>
            Il file originale resta intatto. La copia include le modifiche e conserva i dati non
            riconosciuti.
          </p>
          <div className="notice">
            <strong>Salvataggio sperimentale</strong>
            <p>
              La riapertura in Balsamiq non è ancora verificata. Anteprime, simboli e metadati
              avanzati potrebbero richiedere aggiornamenti. Conserva l’originale e verifica la copia
              prima di utilizzarla.
            </p>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={experimental}
              onChange={(e) => setExperimental(e.target.checked)}
            />
            Abilita il download sperimentale per questo salvataggio
          </label>
          <div className="modal-actions">
            <button onClick={() => setModal(null)}>Annulla</button>
            <button className="primary" disabled={!experimental || busy} onClick={save}>
              Scarica copia .bmpr
            </button>
          </div>
        </Modal>
      )}
      {modal === 'export' && (
        <Modal title="Porta le tue idee con te" onClose={() => setModal(null)}>
          <p>Esporta la pagina corrente o i contenuti del progetto.</p>
          <div className="export-options">
            {[
              ['svg', 'SVG', 'Pagina · vettoriale'],
              ['png', 'PNG', 'Pagina · immagine'],
              ['md', 'Markdown', 'Tutte le pagine · testi'],
              ['json', 'JSON', 'Tutte le pagine · dati'],
              ['mmd', 'Mermaid', 'Diagramma · approssimato'],
              ['drawio', 'draw.io', 'Diagramma · approssimato'],
            ].map(([format, label, detail]) => (
              <button key={format} disabled={busy} onClick={() => exportFile(format)}>
                <strong>{label}</strong>
                <span>{detail}</span>
                <b>↗</b>
              </button>
            ))}
          </div>
          <p className="muted">
            Mermaid e draw.io associano le frecce ai riquadri vicini: controlla i collegamenti dopo
            l’esportazione.
          </p>
        </Modal>
      )}
      {modal === 'debug' && (
        <Modal title="Dati e compatibilità" onClose={() => setModal(null)}>
          <p>
            Schema {project?.schema}. Controlli sconosciuti e risorse non visualizzate restano nel
            file.
          </p>
          {project?.warnings.map((w, i) => (
            <p className="notice" key={i}>
              {w}
            </p>
          ))}
          <p className="muted">
            Le frecce curve, i gruppi e il testo formattato sono approssimati. Le immagini e i
            simboli non risolti sono segnaposto. Le anteprime incorporate restano quelle originali.
          </p>
          <pre className="debug-json">{JSON.stringify(page?.data ?? {}, null, 2)}</pre>
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="Il tuo editor, in locale" onClose={() => setModal(null)}>
          <p>
            Apri o trascina un file .bmpr. Seleziona i controlli, trascinali e usa le maniglie per
            ridimensionarli. Doppio clic per modificare il testo.
          </p>
          <dl className="help-shortcuts">
            {[
              ['Ctrl / ⌘ Z', 'Annulla'],
              ['Ctrl / ⌘ Maiusc Z', 'Ripeti'],
              ['Ctrl / ⌘ C, X, V', 'Copia, taglia e incolla nell’editor'],
              ['Ctrl / ⌘ D', 'Duplica'],
              ['Ctrl / ⌘ A', 'Seleziona tutto'],
              ['Frecce / Maiusc + frecce', 'Sposta di 1 / 10 pixel'],
              ['Spazio + trascina', 'Sposta la vista'],
              ['Ctrl / ⌘ + rotella', 'Zoom'],
              ['Maiusc + clic', 'Selezione multipla'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>
                  <kbd>{k}</kbd>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="notice">
            Scarica una copia prima di chiudere la scheda: le modifiche sono in memoria. Il
            salvataggio .bmpr è sperimentale e richiede una verifica in Balsamiq.
          </p>
          <p className="muted">
            Progetto indipendente, senza affiliazione con Balsamiq. Nessun file viene caricato su un
            server.
          </p>
        </Modal>
      )}
      {textEditor && (
        <Modal title="Modifica testo" onClose={() => setTextEditor(null)}>
          <textarea
            className="text-editor"
            aria-label="Modifica testo elemento"
            autoFocus
            rows={8}
            value={textEditor.text}
            onChange={(e) => setTextEditor({ ...textEditor, text: e.target.value })}
          />
          <div className="modal-actions">
            <button onClick={() => setTextEditor(null)}>Annulla</button>
            <button
              className="primary"
              onClick={() => {
                editPage((p) => {
                  const c = controlsOf(p)[textEditor.index];
                  if (c) {
                    c.properties ??= {};
                    c.properties.text = textEditor.text;
                  }
                });
                setTextEditor(null);
              }}
            >
              Applica testo
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
