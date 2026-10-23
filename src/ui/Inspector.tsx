import { useEffect, useState } from 'react';
import { boxOf, colorOf, colorValue, textOf, typeOf, type Control } from '../model/document';

export function Field({
  label,
  value,
  onCommit,
  type = 'text',
  min,
}: {
  label: string;
  value: string | number;
  onCommit: (value: string) => void;
  type?: string;
  min?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    if (
      type === 'number' &&
      (!draft.trim() ||
        !Number.isFinite(Number(draft)) ||
        (min !== undefined && Number(draft) < min))
    ) {
      setDraft(String(value));
      return;
    }
    if (draft !== String(value)) onCommit(draft);
  };
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type={type}
        min={min}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(String(value));
            e.stopPropagation();
          }
        }}
      />
    </label>
  );
}
export function Inspector({
  control,
  count,
  onGeometry,
  onProperty,
  onDelete,
  onDuplicate,
  onOrder,
  onAlign,
}: {
  control?: Control;
  count: number;
  onGeometry: (field: string, value: number) => void;
  onProperty: (field: string, value: unknown) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onOrder: (front: boolean) => void;
  onAlign: (axis: 'x' | 'y') => void;
}) {
  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(control ? textOf(control) : ''), [control]);
  const b = control && boxOf(control);
  return (
    <aside className="inspector">
      <div className="panel-heading">
        <h2>Proprietà</h2>
        <span className="eyebrow">
          {count ? `${count} selezionat${count === 1 ? 'o' : 'i'}` : 'Nessuna selezione'}
        </span>
      </div>
      {!count ? (
        <div className="inspector-empty">
          <div className="selection-glyph">↖</div>
          <h3>Ogni dettaglio conta</h3>
          <p>Seleziona un elemento per modificarne posizione, dimensioni e contenuto.</p>
          <div className="shortcut-list">
            <span>
              Annulla <kbd>Ctrl Z</kbd>
            </span>
            <span>
              Duplica <kbd>Ctrl D</kbd>
            </span>
            <span>
              Elimina <kbd>Canc</kbd>
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="inspector-section">
            <div className="type-label">{control ? typeOf(control) : 'Selezione multipla'}</div>
            {b && (
              <div className="field-grid">
                {(['x', 'y', 'w', 'h'] as const).map((key) => (
                  <Field
                    key={key}
                    label={{ x: 'X', y: 'Y', w: 'Larghezza', h: 'Altezza' }[key]}
                    value={b[key]}
                    type="number"
                    min={key === 'w' || key === 'h' ? 1 : undefined}
                    onCommit={(v) => onGeometry(key, Number(v))}
                  />
                ))}
              </div>
            )}
            <div className="button-row">
              <button onClick={() => onOrder(false)}>In fondo</button>
              <button onClick={() => onOrder(true)}>In primo piano</button>
            </div>
            {count > 1 && (
              <div className="button-row">
                <button onClick={() => onAlign('x')}>Allinea a sinistra</button>
                <button onClick={() => onAlign('y')}>Allinea in alto</button>
              </div>
            )}
          </div>
          {control && (
            <div className="inspector-section">
              <h3>Contenuto</h3>
              <label className="field">
                <span>Testo</span>
                <textarea
                  aria-label="Testo"
                  value={draft}
                  rows={6}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (draft !== textOf(control)) onProperty('text', draft);
                  }}
                />
              </label>
              <div className="field-grid">
                <Field
                  label="Dimensione testo"
                  value={control.properties?.size ?? 13}
                  type="number"
                  min={8}
                  onCommit={(v) => onProperty('size', v)}
                />
                <label className="field">
                  <span>Colore</span>
                  <input
                    type="color"
                    aria-label="Colore"
                    value={colorOf(control.properties?.color, '#283849')}
                    onChange={(e) => onProperty('color', colorValue(e.target.value))}
                  />
                </label>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={control.properties?.bold === 'true' || control.properties?.bold === true}
                  onChange={(e) => onProperty('bold', String(e.target.checked))}
                />
                Grassetto
              </label>
              {['CheckBox', 'RadioButton'].includes(typeOf(control)) && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={
                      control.properties?.selected === 'true' ||
                      control.properties?.selected === true
                    }
                    onChange={(e) => onProperty('selected', String(e.target.checked))}
                  />
                  Selezionato
                </label>
              )}
              {typeOf(control) === 'Icon' && (
                <label className="field">
                  <span>Icona</span>
                  <select
                    aria-label="Icona"
                    value={control.properties?.icon?.ID ?? ''}
                    onChange={(e) =>
                      onProperty('icon', { ...control.properties?.icon, ID: e.target.value })
                    }
                  >
                    {![
                      'circle-solid',
                      'circle',
                      'check',
                      'user',
                      'home',
                      'star',
                      'search',
                    ].includes(control.properties?.icon?.ID) && (
                      <option value={control.properties?.icon?.ID ?? ''}>
                        {control.properties?.icon?.ID ?? 'Sconosciuta'}
                      </option>
                    )}
                    {['circle-solid', 'circle', 'check', 'user', 'home', 'star', 'search'].map(
                      (i) => (
                        <option key={i}>{i}</option>
                      ),
                    )}
                  </select>
                </label>
              )}
              {typeOf(control) === 'Arrow' && (
                <>
                  {['leftArrow', 'rightArrow'].map((key, i) => (
                    <label className="checkbox-row" key={key}>
                      <input
                        type="checkbox"
                        checked={
                          control.properties?.[key] === 'true' ||
                          control.properties?.[key] === true ||
                          control.properties?.[key] === undefined
                        }
                        onChange={(e) => onProperty(key, String(e.target.checked))}
                      />
                      {i === 0 ? 'Punta iniziale' : 'Punta finale'}
                    </label>
                  ))}
                  <Field
                    label="Curva (approssimata)"
                    value={control.properties?.p1?.y ?? 0}
                    type="number"
                    onCommit={(v) =>
                      onProperty('p1', {
                        ...control.properties?.p1,
                        x: control.properties?.p1?.x ?? 0.5,
                        y: Number(v),
                      })
                    }
                  />
                </>
              )}
            </div>
          )}
          <div className="inspector-section button-row">
            <button onClick={onDuplicate}>Duplica</button>
            <button className="danger" onClick={onDelete}>
              Elimina
            </button>
          </div>
          {control && (
            <details className="raw-details">
              <summary>Dati originali del controllo</summary>
              <pre>{JSON.stringify(control, null, 2)}</pre>
            </details>
          )}
        </>
      )}
      <div className="privacy-note">
        <span className="status-dot" /> Elaborazione locale nel browser
      </div>
    </aside>
  );
}
