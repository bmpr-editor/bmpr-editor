import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { arrowGeometry, visualBoxOf, type Control } from '../src/model/document';
import { ControlGraphic } from '../src/render/Controls';
import { layoutText, richRuns } from '../src/render/textLayout';
import { mermaidFor } from '../src/export/exports';

const draw = (control: Control) => renderToStaticMarkup(createElement(ControlGraphic, { control }));
describe('regressions discovered against private PNG references (synthetic inputs only)', () => {
  it('preserves literal cron asterisks and whitespace-only emphasis', () => {
    expect(richRuns('32 15 * * *')).toEqual([{ text: '32 15 * * *' }]);
    expect(richRuns('_ _')).toEqual([{ text: '_ _' }]);
    expect(richRuns('*API*')).toEqual([{ text: 'API', bold: true, italic: false }]);
  });
  it('places tabs above a full-width panel instead of stretching them to panel height', () => {
    const svg = draw({
      typeID: 'TabBar',
      w: 600,
      h: 400,
      properties: { text: 'General,Related assets' },
    });
    expect(svg).toContain('translate(0 29)');
    expect(svg).toContain('height="371"');
    expect(svg).not.toContain('height="400"');
  });
  it('recovers a quadratic through the stored midpoint, with screen-left normal', () => {
    const g = arrowGeometry({
      typeID: 'Arrow',
      w: '100',
      h: '100',
      properties: { p0: { x: 0, y: 0 }, p2: { x: 100, y: 100 }, p1: { x: 0.5, y: 0.25 } },
    });
    expect(g.q).toEqual({ x: 100, y: 0 });
    expect(0.25 * g.a.x + 0.5 * g.q.x + 0.25 * g.b.x).toBe(75);
    expect(0.25 * g.a.y + 0.5 * g.q.y + 0.25 * g.b.y).toBe(25);
  });
  it('includes curved extrema outside the stored rectangle in export bounds', () => {
    const box = visualBoxOf({
      typeID: 'Arrow',
      x: '100',
      y: '100',
      w: '10',
      h: '100',
      properties: { p0: { x: 0, y: 0 }, p2: { x: 0, y: 100 }, p1: { x: 0.5, y: -1 } },
    });
    expect(box.x).toBeLessThan(0);
    expect(box.x + box.w).toBeGreaterThanOrEqual(100);
  });
  it('renders both arrowheads by default and honors explicit false flags', () => {
    const c = { typeID: 'Arrow', w: '100', h: '10', properties: {} };
    expect(draw(c).match(/M -10 -5/g)).toHaveLength(2);
    expect(draw({ ...c, properties: { rightArrow: 'false' } }).match(/M -10 -5/g)).toHaveLength(1);
    expect(draw({ ...c, properties: { rightArrow: 'false', leftArrow: false } })).not.toContain(
      'M -10 -5',
    );
  });
  it('uses stroke rather than borderStyle for dotted arrow lines', () => {
    expect(draw({ typeID: 'Arrow', properties: { stroke: 'dotted' } })).toContain(
      'stroke-dasharray="1 6"',
    );
  });
  it('keeps complete single-line labels and interprets safe inline emphasis', () => {
    const svg = draw({
      typeID: 'Label',
      measuredW: '94',
      measuredH: '21',
      properties: { text: 'Demo environment *API*' },
    });
    expect(svg).toContain('Demo environment ');
    expect(svg).not.toContain('*API*');
    expect(svg).toContain('font-weight="700">API');
    expect(
      richRuns('field_name and *bold*')
        .map((r) => r.text)
        .join(''),
    ).toBe('field_name and bold');
    expect(layoutText('Long label with several words', 10, 13, false)).toHaveLength(1);
  });
  it('does not wrap radio labels and lose their ending', () => {
    expect(
      draw({
        typeID: 'RadioButton',
        w: '100',
        h: '21',
        properties: { text: 'Use the selected customer' },
      }),
    ).toContain('Use the selected customer');
  });
  it('honors borderless filled panels', () => {
    const svg = draw({
      typeID: 'Canvas',
      w: '200',
      h: '100',
      properties: { borderStyle: 'none', color: '14540253' },
    });
    expect(svg).toContain('fill="#dddddd"');
    expect(svg).not.toContain('stroke=');
  });
  it('crops a group using per-mille coordinates of its full child bounds', () => {
    const svg = draw({
      typeID: '__group__',
      w: '200',
      h: '50',
      properties: { crop: '0,250,1000,500' },
      children: {
        controls: { control: [{ typeID: 'Canvas', x: '0', y: '0', w: '200', h: '100' }] },
      },
    });
    expect(svg).toContain('viewBox="0 25 200 50"');
    expect(svg).toContain('overflow="hidden"');
  });
  it('exports default bidirectional arrow semantics consistently to Mermaid', () => {
    const page = {
      key: 'x',
      id: 'x',
      branchId: null,
      attributes: { name: 'Test' },
      data: {
        mockup: {
          controls: {
            control: [
              { typeID: 'Canvas', x: 0, y: 0, w: 100, h: 100 },
              { typeID: 'Canvas', x: 200, y: 0, w: 100, h: 100 },
              {
                typeID: 'Arrow',
                x: 100,
                y: 50,
                w: 100,
                h: 1,
                properties: { p0: { x: 0, y: 0 }, p2: { x: 100, y: 0 } },
              },
            ],
          },
        },
      },
    };
    expect(mermaidFor(page)).toContain('n0 <--> n1');
  });
});
