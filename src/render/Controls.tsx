import rough from 'roughjs';
import { createContext, useContext } from 'react';
import { estimatedWidth, layoutText } from './textLayout';
import {
  arrowGeometry,
  boxOf,
  childControls,
  colorOf,
  number,
  textOf,
  typeOf,
  type Control,
} from '../model/document';

const ink = '#283849';
const generator = rough.generator();
export const AssetContext = createContext<Record<string, string>>({});
export function Frame({
  w,
  h,
  fill = '#fff',
  sketch = false,
  radius = 2,
  border = 'solid',
  borderColor = ink,
}: {
  w: number;
  h: number;
  fill?: string;
  sketch?: boolean;
  radius?: number;
  border?: string;
  borderColor?: string;
}) {
  if (border === 'none') return <rect width={w} height={h} fill={fill} />;
  if (sketch) {
    const drawable = generator.rectangle(0, 0, w, h, {
      seed: 17,
      roughness: 0.8,
      stroke: borderColor,
      strokeWidth: 1.3,
      fill,
      fillStyle: 'solid',
    });
    return (
      <>
        {generator.toPaths(drawable).map((p, i) => (
          <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill} />
        ))}
      </>
    );
  }
  return (
    <rect
      width={w}
      height={h}
      rx={radius}
      fill={fill}
      stroke={borderColor}
      strokeWidth="1.3"
      strokeDasharray={border === 'dashed' ? '6 4' : border === 'dotted' ? '2 3' : undefined}
    />
  );
}
export function SvgText({
  text,
  w,
  h,
  size = 15,
  color = ink,
  center = false,
  padding = 8,
  bold = false,
  wrap = true,
  italic = false,
}: {
  text: string;
  w: number;
  h: number;
  size?: number;
  color?: string;
  center?: boolean;
  padding?: number;
  bold?: boolean;
  wrap?: boolean;
  italic?: boolean;
}) {
  const lines = layoutText(text, Math.max(1, w - padding * 2), size, wrap).slice(
    0,
    Math.max(1, Math.floor((h - padding) / (size * 1.25))),
  );
  const y = center ? (h - (lines.length - 1) * size * 1.25) / 2 + size * 0.34 : padding + size;
  return (
    <text
      x={center ? w / 2 : padding}
      y={y}
      fontSize={size}
      fill={color}
      textAnchor={center ? 'middle' : 'start'}
      fontWeight={bold ? 700 : 400}
      fontStyle={italic ? 'italic' : undefined}
      fontFamily="Arial, sans-serif"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={center ? w / 2 : padding} dy={i ? size * 1.25 : 0}>
          {line.map((run, j) => (
            <tspan
              key={j}
              fontWeight={run.bold ? 700 : undefined}
              fontStyle={run.italic ? 'italic' : undefined}
            >
              {run.text}
            </tspan>
          ))}
        </tspan>
      ))}
    </text>
  );
}
export const arrowPoints = arrowGeometry;
function ArrowHead({
  at,
  from,
  color,
}: {
  at: { x: number; y: number };
  from: { x: number; y: number };
  color: string;
}) {
  const angle = (Math.atan2(at.y - from.y, at.x - from.x) * 180) / Math.PI;
  return (
    <path
      d="M -10 -5 L 0 0 L -10 5 Z"
      transform={`translate(${at.x} ${at.y}) rotate(${angle})`}
      fill={color}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
function IconShape({ id, color }: { id: string; color: string }) {
  if (id === 'file-o' || id === 'file')
    return (
      <path
        d="M4 1h10l6 6v16H4ZM14 1v7h6"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    );
  if (id.includes('gear') || id.includes('cog'))
    return (
      <g stroke={color} strokeWidth="1.5" fill="white">
        <circle cx="12" cy="12" r="7" />
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d="M10 5V2h4v3" transform={`rotate(${i * 45} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="3" />
      </g>
    );
  if (id.includes('database'))
    return (
      <g fill="none" stroke={color} strokeWidth="2">
        <ellipse cx="12" cy="4" rx="9" ry="3" />
        <path d="M3 4v15c0 4 18 4 18 0V4M3 11c0 4 18 4 18 0M3 16c0 4 18 4 18 0" />
      </g>
    );
  if (id.includes('envelope'))
    return (
      <g fill="none" stroke={color} strokeWidth="2">
        <rect x="2" y="5" width="20" height="15" rx="1" />
        <path d="m2 6 10 8L22 6" />
      </g>
    );
  if (id.includes('comment'))
    return (
      <path
        d="M3 18 1 23l7-3c15 5 21-15 5-18C0 0-2 12 3 18Z"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
    );
  if (id.includes('exclamation'))
    return (
      <g fill="none" stroke={color} strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v8M12 17v1" />
      </g>
    );
  if (id.includes('seal'))
    return (
      <path
        d="m12 0 3 3 4-1 1 4 4 3-2 4 1 4-4 2-2 4-4-2-4 1-2-4-4-2 2-4-1-4 4-2 1-4Z"
        fill={color}
      />
    );
  if (id.includes('check'))
    return <path d="m4 12 5 5L20 6" fill="none" stroke={color} strokeWidth="2.5" />;
  if (id.includes('user'))
    return (
      <>
        <circle cx="12" cy="7" r="4" fill={color} />
        <path d="M3 23v-5c0-7 18-7 18 0v5Z" fill={color} />
      </>
    );
  if (id.includes('home') || id.includes('house'))
    return <path d="m1 11 11-10 11 10h-4v12h-5v-8h-4v8H5V11Z" fill={color} />;
  if (id.includes('star'))
    return (
      <path
        d="m12 1 3.4 7 7.6 1.1-5.5 5.3 1.3 7.6-6.8-3.6L5.2 22l1.3-7.6L1 9.1 7.6 8Z"
        fill={color}
      />
    );
  if (id.includes('search') || id.includes('magnifying'))
    return (
      <>
        <circle cx="9" cy="9" r="7" fill="none" stroke={color} strokeWidth="2" />
        <path d="m14 14 9 9" stroke={color} strokeWidth="3" />
      </>
    );
  if (id.includes('circle'))
    return (
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={id.includes('solid') ? color : 'none'}
        stroke={color}
        strokeWidth="2"
      />
    );
  return (
    <>
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="3"
        fill="none"
        stroke={color}
        strokeDasharray="3 2"
      />
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial" fontSize="16" fill={color}>
        ?
      </text>
    </>
  );
}
export function ControlGraphic({
  control: c,
  sketch = false,
  depth = 0,
}: {
  control: Control;
  sketch?: boolean;
  depth?: number;
}) {
  const assets = useContext(AssetContext);
  const { w, h } = boxOf(c),
    type = typeOf(c),
    p = c.properties ?? {},
    text = textOf(c);
  const size = Math.max(8, Math.min(96, number(p.size, 13))),
    color = colorOf(p.color, '#000000');
  const label = (
    <SvgText
      text={text}
      w={w}
      h={h}
      size={size}
      color={color}
      padding={['Label', 'Paragraph', 'Link', 'SubTitle'].includes(type) ? 0 : 8}
      bold={p.bold === 'true' || p.bold === true}
      italic={p.italic === 'true' || p.italic === true}
      wrap={!['Label', 'Link', 'SubTitle', 'LineOfText', 'TextInput', 'ComboBox'].includes(type)}
    />
  );
  if (type === 'Image') {
    const id = typeof p.src === 'object' ? p.src?.ID : p.src;
    const src = id && assets[String(id)];
    if (src) return <image href={src} width={w} height={h} preserveAspectRatio="none" />;
    return (
      <>
        <rect width={w} height={h} fill="#eef2f6" stroke="#9caabd" strokeDasharray="5 3" />
        <path d={`M0 0L${w} ${h}M${w} 0L0 ${h}`} stroke="#c5ceda" />
        <SvgText text="Immagine non disponibile" w={w} h={h} size={12} center />
      </>
    );
  }
  if (type === 'Canvas' || type === 'FieldSet')
    return (
      <>
        <Frame
          w={w}
          h={h}
          fill={
            p.backgroundAlpha === '0' || p.backgroundAlpha === 0 ? 'none' : colorOf(p.color, '#fff')
          }
          sketch={sketch}
          border={p.borderStyle}
          borderColor={colorOf(p.borderColor, '#000000')}
        />
        {text && <SvgText text={text} w={w} h={h} size={size} />}
      </>
    );
  if (['Label', 'Paragraph', 'SubTitle', 'Link', 'Tooltip', 'LineOfText'].includes(type))
    return <g textDecoration={type === 'Link' ? 'underline' : undefined}>{label}</g>;
  if (type === 'StickyNote')
    return (
      <>
        <Frame w={w} h={h} fill={colorOf(p.color, '#fff0b3')} sketch={sketch} />
        <SvgText text={text} w={w} h={h} size={size} padding={16} />
      </>
    );
  if (
    ['TextInput', 'TextArea', 'ComboBox', 'DateChooser', 'NumericStepper', 'SearchBox'].includes(
      type,
    )
  )
    return (
      <>
        <Frame
          w={w}
          h={h}
          sketch={sketch}
          border={p.borderStyle}
          borderColor={colorOf(p.borderColor, '#000000')}
          fill={p.backgroundAlpha === '0' || p.backgroundAlpha === 0 ? 'none' : '#fff'}
        />
        {label}
        {type === 'ComboBox' && (
          <>
            <path d={`M${w - 28} 0v${h}`} stroke={ink} />
            <path d={`m${w - 20} ${h / 2 - 2} 6 6 6-6`} fill="none" stroke={ink} />
          </>
        )}
        {type === 'DateChooser' && <SvgText text="▦" w={w} h={h} center />}
      </>
    );
  if (type === 'RoundButton' || type === 'CallOut')
    return (
      <>
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2}
          ry={h / 2}
          fill={colorOf(p.color, type === 'CallOut' ? '#ffff00' : '#fff')}
          stroke={ink}
          strokeWidth="1.5"
        />
        <SvgText text={text} w={w} h={h} size={size} center />
      </>
    );
  if (type === 'RedX')
    return <path d={`M0 0L${w} ${h}M${w} 0L0 ${h}`} stroke="#d45252" strokeWidth="3" />;
  if (type === 'ModalScreen') return <rect width={w} height={h} fill="#263649" opacity=".3" />;
  if (type === 'HCurly' || type === 'VCurly')
    return (
      <>
        <path
          d={
            type === 'VCurly'
              ? `M${w} 0 C0 0 ${w} ${h / 2} 0 ${h / 2} C${w} ${h / 2} 0 ${h} ${w} ${h}`
              : `M0 ${h} C0 0 ${w / 2} ${h} ${w / 2} 0 C${w / 2} ${h} ${w} 0 ${w} ${h}`
          }
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />
        {text && label}
      </>
    );
  if (type === 'TabBar') {
    const tabs = text.split(/[,\n]/);
    const tabH = Math.min(h, size + 16);
    const widths = tabs.map((tab) => estimatedWidth(tab.trim(), size) + 28);
    return (
      <>
        <g transform={`translate(0 ${tabH})`}>
          <Frame w={w} h={Math.max(0, h - tabH)} fill="#fff" sketch={sketch} />
        </g>
        {tabs.map((tab, i) => (
          <g key={i} transform={`translate(${widths.slice(0, i).reduce((a, b) => a + b, 0)} 0)`}>
            <Frame
              w={widths[i]}
              h={tabH}
              fill={i === number(p.selectedIndex) ? '#fff' : '#e9eff5'}
              sketch={sketch}
            />
            {i === number(p.selectedIndex) && (
              <path d={`M1 ${tabH}H${widths[i] - 1}`} stroke="#fff" strokeWidth="3" />
            )}
            <SvgText text={tab.trim()} w={widths[i]} h={tabH} size={size} center wrap={false} />
          </g>
        ))}
      </>
    );
  }
  if (['ButtonBar', 'MenuBar'].includes(type)) {
    const tabs = text.split(/[,\n]/),
      tabW = w / Math.max(1, tabs.length);
    return (
      <>
        {tabs.map((tab, i) => (
          <g key={i} transform={`translate(${i * tabW} 0)`}>
            <Frame
              w={tabW}
              h={h}
              fill={i === number(p.selectedIndex) ? '#dfe9ff' : '#fff'}
              sketch={sketch}
            />
            <SvgText text={tab.trim()} w={tabW} h={h} size={size} center />
          </g>
        ))}
      </>
    );
  }
  if (type === 'CheckBoxGroup' || type === 'RadioButtonGroup')
    return (
      <>
        {text.split(/\r?\n/).map((line, i) => (
          <g key={i} transform={`translate(0 ${i * 28})`}>
            <ControlGraphic
              control={{
                ...c,
                typeID: type === 'CheckBoxGroup' ? 'CheckBox' : 'RadioButton',
                w,
                h: 26,
                properties: {
                  ...p,
                  text: line.replace(/^\s*\[[ xX]\]\s*/, ''),
                  selected: /^\s*\[[xX]\]/.test(line),
                },
              }}
            />
          </g>
        ))}
      </>
    );
  if (type === 'Button')
    return (
      <>
        <rect x="2" y="3" width={w} height={h} rx="3" fill="#c8d2dc" />
        <Frame w={w} h={h} fill="#f5f8fb" sketch={sketch} radius={4} />
        <SvgText text={text} w={w} h={h} color={color} size={size} center />
      </>
    );
  if (type === 'CheckBox' || type === 'RadioButton')
    return (
      <>
        {type === 'CheckBox' ? (
          <rect x="1" y={Math.max(1, h / 2 - 8)} width="16" height="16" fill="#fff" stroke={ink} />
        ) : (
          <circle cx="9" cy={h / 2} r="8" fill="#fff" stroke={ink} />
        )}
        {['true', true, 'selected', 'on'].includes(p.selected ?? p.state) &&
          (type === 'CheckBox' ? (
            <path d={`m4 ${h / 2} 4 4 7-8`} fill="none" stroke={ink} strokeWidth="2" />
          ) : (
            <circle cx="9" cy={h / 2} r="4" fill={ink} />
          ))}
        <g transform="translate(24 0)">
          <SvgText
            text={text}
            w={Math.max(1, w - 24)}
            h={h}
            size={size}
            color={color}
            padding={0}
            wrap={false}
          />
        </g>
      </>
    );
  if (type === 'Window' || type === 'BrowserWindow')
    return (
      <>
        <Frame w={w} h={h} sketch={sketch} />
        <rect x="1" y="1" width={Math.max(1, w - 2)} height={Math.min(36, h - 1)} fill="#e9eff5" />
        <path d={`M0 36H${w}`} stroke={ink} />
        <SvgText text={text} w={w - 40} h={36} size={14} />
        <circle cx={w - 17} cy="18" r="5" fill="#b8c5d1" />
      </>
    );
  if (type === 'DataGrid') {
    const rows = text
      .split(/\r?\n/)
      .slice(0, 100)
      .map((r) => r.split(','));
    const cols = Math.max(1, ...rows.map((r) => r.length)),
      rowH = Math.max(24, Math.min(36, h / Math.max(1, rows.length)));
    const natural = Array.from({ length: cols }, (_, j) =>
      Math.max(30, ...rows.map((row) => estimatedWidth(row[j]?.trim() ?? '', size) + 16)),
    );
    const total = natural.reduce((a, b) => a + b, 0);
    const widths = natural.map((n) => (n * w) / total);
    return (
      <>
        <Frame w={w} h={h} sketch={sketch} />
        {rows
          .filter((_, i) => i * rowH < h)
          .map((row, i) => (
            <g key={i} transform={`translate(0 ${i * rowH})`}>
              <rect
                x="1"
                y="1"
                width={Math.max(1, w - 2)}
                height={Math.min(rowH, h - i * rowH) - 1}
                fill={i === 0 ? '#e9eff5' : i % 2 ? '#fff' : '#f6f8fa'}
              />
              {row.map((cell, j) => (
                <g
                  key={j}
                  transform={`translate(${widths.slice(0, j).reduce((a, b) => a + b, 0)} 0)`}
                >
                  <svg width={widths[j]} height={rowH} overflow="hidden">
                    <SvgText
                      text={cell.trim()}
                      w={widths[j]}
                      h={rowH}
                      size={size}
                      bold={i === 0}
                      wrap={false}
                    />
                  </svg>
                </g>
              ))}
              <path d={`M0 ${Math.min(rowH, h - i * rowH)}H${w}`} stroke="#d2dae2" />
            </g>
          ))}
        {widths.slice(1).map((_, i) => (
          <path
            key={i}
            d={`M${widths.slice(0, i + 1).reduce((a, b) => a + b, 0)} 0V${h}`}
            stroke="#d2dae2"
          />
        ))}
      </>
    );
  }
  if (type === 'HRule' || type === 'VRule')
    return (
      <path
        d={type === 'HRule' ? `M0 ${h / 2}H${w}` : `M${w / 2} 0V${h}`}
        stroke={color}
        strokeWidth="2"
      />
    );
  if (type === 'Icon')
    return (
      <svg width={w} height={h} viewBox="0 0 24 24">
        <title>{String(p.icon?.ID ?? 'Icona')}</title>
        <IconShape id={String(p.icon?.ID ?? '')} color={color} />
      </svg>
    );
  if (type === 'Arrow') {
    const { a, b, q, curve } = arrowPoints(c);
    return (
      <>
        <path
          d={`M${a.x} ${a.y} ${curve ? `Q${q.x} ${q.y} ` : 'L'}${b.x} ${b.y}`}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={
            (p.stroke ?? p.borderStyle) === 'dotted'
              ? '1 6'
              : (p.stroke ?? p.borderStyle) === 'dashed'
                ? '8 5'
                : undefined
          }
        />
        {p.rightArrow !== 'false' && p.rightArrow !== false && (
          <ArrowHead at={b} from={curve ? q : a} color={color} />
        )}
        {p.leftArrow !== 'false' && p.leftArrow !== false && (
          <ArrowHead at={a} from={curve ? q : b} color={color} />
        )}
      </>
    );
  }
  const children = childControls(c);
  if (children.length && depth < 8) {
    const content = (
      <>
        {[...children]
          .sort((a, b) => number(a.zOrder) - number(b.zOrder))
          .map((child, i) => {
            const b = boxOf(child);
            return (
              <g key={i} transform={`translate(${b.x} ${b.y})`}>
                <ControlGraphic control={child} sketch={sketch} depth={depth + 1} />
              </g>
            );
          })}
      </>
    );
    const crop = String(p.crop ?? '')
      .split(',')
      .map(Number);
    if (crop.length === 4 && crop.every(Number.isFinite) && crop[2] > 0 && crop[3] > 0) {
      const childBoxes = children.map(boxOf);
      const fullW = Math.max(...childBoxes.map((b) => b.x + b.w));
      const fullH = Math.max(...childBoxes.map((b) => b.y + b.h));
      return (
        <svg
          width={w}
          height={h}
          viewBox={`${(fullW * crop[0]) / 1000} ${(fullH * crop[1]) / 1000} ${(fullW * crop[2]) / 1000} ${(fullH * crop[3]) / 1000}`}
          preserveAspectRatio="none"
          overflow="hidden"
        >
          {content}
        </svg>
      );
    }
    return content;
  }
  return (
    <>
      <rect width={w} height={h} fill="#f4f0fa" stroke="#9475b8" strokeDasharray="6 4" />
      <SvgText
        text={`${type}\n${text || 'Controllo conservato'}`}
        w={w}
        h={h}
        size={12}
        color="#76549a"
      />
    </>
  );
}
