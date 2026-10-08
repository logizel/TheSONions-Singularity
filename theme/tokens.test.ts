import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { breakpoints, colorVars, colors, elevation, layout, radius, risk, riskVars, space, z } from './tokens';

const css = readFileSync(path.join(__dirname, 'tokens.css'), 'utf8');
// First declaration of each var (the :root block), ignoring media overrides.
function cssVar(name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`missing ${name} in tokens.css`);
  return m[1].trim();
}

describe('theme tokens: tokens.css and tokens.ts agree', () => {
  it('colours', () => {
    for (const [key, hex] of Object.entries(colors)) {
      expect(cssVar(colorVars[key as keyof typeof colors]).toUpperCase()).toBe(hex.toUpperCase());
    }
  });

  it('risk scale', () => {
    for (const [sev, v] of Object.entries(risk)) {
      const prefix = riskVars[sev as keyof typeof risk];
      expect(cssVar(prefix)).toBe(v.fill);
      expect(cssVar(`${prefix}-text`)).toBe(v.text);
      expect(cssVar(`${prefix}-tint`)).toBe(v.tint);
    }
  });

  it('spacing, radii, elevation, z, breakpoints', () => {
    for (const [k, px] of Object.entries(space)) expect(cssVar(`--space-${k}`)).toBe(`${px}px`);
    for (const [k, px] of Object.entries(radius)) expect(cssVar(`--radius-${k}`)).toBe(`${px}px`);
    expect(cssVar('--elev-1')).toBe(elevation[1]);
    expect(cssVar('--elev-2')).toBe(elevation[2]);
    const zVar: Record<string, string> = { mapUi: 'map-ui' };
    for (const [k, n] of Object.entries(z)) expect(cssVar(`--z-${zVar[k] ?? k}`)).toBe(String(n));
    expect(cssVar('--bp-md')).toBe(`${breakpoints.md}px`);
    expect(cssVar('--bp-lg')).toBe(`${breakpoints.lg}px`);
    expect(cssVar('--bp-xl')).toBe(`${breakpoints.xl}px`);
    expect(cssVar('--bp-2xl')).toBe(`${breakpoints.xxl}px`);
    expect(cssVar('--topbar-h')).toBe(`${layout.topbarH}px`);
    expect(cssVar('--panel-w')).toBe(`${layout.panelW.md}px`);
    expect(cssVar('--sheet-w')).toBe(`${layout.sheetW.xl}px`);
  });

  it('bans slate/blue and gradients', () => {
    for (const banned of ['#2563eb', '#0f172a', '#475569', '#64748b', '#94a3b8', '#e2e8f0', 'gradient']) {
      expect(css.toLowerCase()).not.toContain(banned);
    }
  });
});
