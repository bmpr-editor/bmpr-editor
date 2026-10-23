import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  boundsOf,
  boxOf,
  number,
  transformControl,
  type Box,
  type Control,
} from '../model/document';
import { AssetContext, ControlGraphic } from '../render/Controls';

type Drag = {
  mode: 'move' | 'resize' | 'pan' | 'select';
  start: { x: number; y: number };
  client: { x: number; y: number };
  view: Box;
  indexes: number[];
  boxes: Box[];
  originals: Control[];
  handle?: string;
  additive?: boolean;
};
export function Canvas({
  controls,
  selected,
  onSelect,
  onChange,
  onEdit,
  sketch,
  panMode,
  assets = {},
}: {
  controls: Control[];
  selected: number[];
  onSelect: (indexes: number[]) => void;
  onChange: (controls: Control[]) => void;
  onEdit: (index: number) => void;
  sketch: boolean;
  panMode: boolean;
  assets?: Record<string, string>;
}) {
  const ref = useRef<SVGSVGElement>(null),
    host = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const lastClick = useRef<{ index: number; time: number } | null>(null);
  const fitted = useRef(false);
  const [viewport, setViewport] = useState({ w: 1000, h: 700 });
  const [view, setView] = useState<Box>(() => boundsOf(controls, 80));
  const [draft, setDraft] = useState<Control[] | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [space, setSpace] = useState(false);
  const draftRef = useRef<Control[] | null>(null);
  const scale = view.w / viewport.w;
  const actualView = { ...view, h: (view.w * viewport.h) / viewport.w };
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setViewport({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
      if (!fitted.current && r.width > 0 && r.height > 0) {
        fitted.current = true;
        const b = boundsOf(controls, 64);
        b.w = Math.max(b.w, (b.h * r.width) / r.height);
        setView(b);
      }
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const svg = ref.current;
    const preventNativeScroll = (e: WheelEvent) => e.preventDefault();
    svg?.addEventListener('wheel', preventNativeScroll, { passive: false });
    return () => svg?.removeEventListener('wheel', preventNativeScroll);
  }, []);
  useEffect(() => {
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpace(false);
    };
    const blur = () => setSpace(false);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const point = (e: { clientX: number; clientY: number }) => {
    const matrix = ref.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: p.x, y: p.y };
  };
  const begin = (e: ReactPointerEvent, index?: number, handle?: string) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    ref.current?.focus();
    const pan = e.button === 1 || panMode || space;
    let indexes = selected;
    if (!pan && index !== undefined && !handle) {
      if (e.shiftKey) {
        indexes = selected.includes(index)
          ? selected.filter((i) => i !== index)
          : [...selected, index];
        onSelect(indexes);
        return;
      }
      indexes = selected.includes(index) ? selected : [index];
      onSelect(indexes);
    }
    if (!pan && index === undefined && !e.shiftKey) {
      indexes = [];
      onSelect([]);
    }
    drag.current = {
      mode: pan ? 'pan' : handle ? 'resize' : index === undefined ? 'select' : 'move',
      start: point(e),
      client: { x: e.clientX, y: e.clientY },
      view: { ...actualView },
      indexes,
      boxes: indexes.map((i) => boxOf(controls[i])),
      originals: controls,
      handle,
      additive: e.shiftKey,
    };
    ref.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'pan') {
      setView({
        ...d.view,
        x: d.view.x - (e.clientX - d.client.x) * scale,
        y: d.view.y - (e.clientY - d.client.y) * scale,
      });
      return;
    }
    const p = point(e),
      dx = p.x - d.start.x,
      dy = p.y - d.start.y;
    if (d.mode === 'select') {
      setMarquee({
        x: Math.min(p.x, d.start.x),
        y: Math.min(p.y, d.start.y),
        w: Math.abs(dx),
        h: Math.abs(dy),
      });
      return;
    }
    const next = structuredClone(d.originals);
    d.indexes.forEach((index, i) => {
      const b = d.boxes[i],
        nextBox = { ...b };
      if (d.mode === 'move') {
        nextBox.x += dx;
        nextBox.y += dy;
      } else {
        if (d.handle?.includes('e')) nextBox.w = Math.max(8, b.w + dx);
        if (d.handle?.includes('s')) nextBox.h = Math.max(8, b.h + dy);
        if (d.handle?.includes('w')) {
          nextBox.w = Math.max(8, b.w - dx);
          nextBox.x = b.x + b.w - nextBox.w;
        }
        if (d.handle?.includes('n')) {
          nextBox.h = Math.max(8, b.h - dy);
          nextBox.y = b.y + b.h - nextBox.h;
        }
      }
      transformControl(next[index], nextBox);
    });
    draftRef.current = next;
    setDraft(next);
  };
  const end = (e: ReactPointerEvent, cancel = false) => {
    const d = drag.current;
    if (!d) return;
    if (!cancel && draftRef.current) onChange(draftRef.current);
    if (
      !cancel &&
      d.mode === 'move' &&
      d.indexes.length === 1 &&
      Math.hypot(e.clientX - d.client.x, e.clientY - d.client.y) < 4
    ) {
      const index = d.indexes[0];
      if (lastClick.current?.index === index && e.timeStamp - lastClick.current.time < 450) {
        lastClick.current = null;
        onEdit(index);
      } else lastClick.current = { index, time: e.timeStamp };
    } else lastClick.current = null;
    if (!cancel && d.mode === 'select') {
      const p = point(e),
        r = {
          x: Math.min(p.x, d.start.x),
          y: Math.min(p.y, d.start.y),
          w: Math.abs(p.x - d.start.x),
          h: Math.abs(p.y - d.start.y),
        };
      if (r.w + r.h > 3 * scale)
        onSelect([
          ...new Set([
            ...(d.additive ? d.indexes : []),
            ...controls.flatMap((c, i) => {
              const b = boxOf(c);
              return b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h
                ? [i]
                : [];
            }),
          ]),
        ]);
    }
    drag.current = null;
    draftRef.current = null;
    setDraft(null);
    setMarquee(null);
    if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);
  };
  const zoom = (
    factor: number,
    center = { x: view.x + actualView.w / 2, y: view.y + actualView.h / 2 },
  ) => {
    const w = Math.max(viewport.w / 4, Math.min(viewport.w * 10, view.w * factor)),
      ratio = w / view.w;
    setView({
      ...view,
      x: center.x - (center.x - view.x) * ratio,
      y: center.y - (center.y - view.y) * ratio,
      w,
    });
  };
  const fit = () => {
    const b = boundsOf(controls, 64);
    b.w = Math.max(b.w, (b.h * viewport.w) / viewport.h);
    setView(b);
  };
  const displayed = draft ?? controls;
  return (
    <AssetContext.Provider value={assets}>
      <div className={`canvas-host ${panMode || space ? 'panning' : ''}`} ref={host}>
        <svg
          ref={ref}
          className="drawing"
          data-testid="canvas"
          aria-label="Area di disegno"
          tabIndex={0}
          viewBox={`${actualView.x} ${actualView.y} ${actualView.w} ${actualView.h}`}
          onPointerDown={(e) => begin(e)}
          onPointerMove={move}
          onPointerUp={(e) => end(e)}
          onPointerCancel={(e) => end(e, true)}
          onLostPointerCapture={(e) => {
            if (drag.current) end(e, true);
          }}
          onKeyDown={(e) => {
            if (e.code === 'Space') {
              e.preventDefault();
              setSpace(true);
            }
          }}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, point(e));
            else setView((v) => ({ ...v, x: v.x + e.deltaX * scale, y: v.y + e.deltaY * scale }));
          }}
        >
          <defs>
            <pattern id="editor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r={Math.max(0.6, scale * 0.8)} fill="#cfd8e3" />
            </pattern>
          </defs>
          <rect
            x={actualView.x}
            y={actualView.y}
            width={actualView.w}
            height={actualView.h}
            fill="url(#editor-grid)"
          />
          {displayed
            .map((c, i) => ({ c, i }))
            .sort((a, b) => number(a.c.zOrder) - number(b.c.zOrder))
            .map(({ c, i }) => {
              const b = boxOf(c);
              return (
                <g
                  key={i}
                  data-control-index={i}
                  transform={`translate(${b.x} ${b.y})`}
                  onPointerDown={(e) => begin(e, i)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEdit(i);
                  }}
                  className="control"
                >
                  <ControlGraphic control={c} sketch={sketch} />
                  <rect
                    width={b.w}
                    height={b.h}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={8 * scale}
                  />
                </g>
              );
            })}
          {selected
            .filter((i) => displayed[i])
            .map((i) => {
              const b = boxOf(displayed[i]);
              return (
                <g key={i} className="selection">
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    fill="none"
                    stroke="#2962ff"
                    strokeWidth={1.5 * scale}
                    pointerEvents="none"
                  />
                  {selected.length === 1 &&
                    [
                      ['nw', b.x, b.y],
                      ['n', b.x + b.w / 2, b.y],
                      ['ne', b.x + b.w, b.y],
                      ['e', b.x + b.w, b.y + b.h / 2],
                      ['se', b.x + b.w, b.y + b.h],
                      ['s', b.x + b.w / 2, b.y + b.h],
                      ['sw', b.x, b.y + b.h],
                      ['w', b.x, b.y + b.h / 2],
                    ].map(([h, x, y]) => (
                      <rect
                        key={h}
                        data-handle={h}
                        x={Number(x) - 4 * scale}
                        y={Number(y) - 4 * scale}
                        width={8 * scale}
                        height={8 * scale}
                        fill="#fff"
                        stroke="#2962ff"
                        strokeWidth={1.5 * scale}
                        style={{ cursor: `${h}-resize` }}
                        onPointerDown={(e) => begin(e, i, String(h))}
                      />
                    ))}
                </g>
              );
            })}
          {marquee && (
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.h}
              fill="#2962ff18"
              stroke="#2962ff"
              strokeWidth={scale}
              pointerEvents="none"
            />
          )}
        </svg>
        {!controls.length && (
          <div className="canvas-empty">
            <span>Un foglio, tutte le possibilità.</span>
            <p>Aggiungi un elemento dalla libreria a sinistra.</p>
          </div>
        )}
        <div className="canvas-help">
          Maiusc + clic · selezione multipla <span>Spazio + trascina · sposta vista</span>
        </div>
        <div className="zoom-controls">
          <button onClick={() => zoom(1.2)} aria-label="Riduci zoom">
            −
          </button>
          <span>{Math.round(100 / scale)}%</span>
          <button onClick={() => zoom(1 / 1.2)} aria-label="Aumenta zoom">
            +
          </button>
          <i />
          <button onClick={fit} title="Adatta la pagina alla vista">
            Adatta
          </button>
        </div>
      </div>
    </AssetContext.Provider>
  );
}
