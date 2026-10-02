'use strict';
// WCAG AA contrast check for the design tokens in web/src/styles/tokens.css,
// in light and dark themes. 4.5:1 for text, 3:1 for focus ring / accent UI.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'web', 'src', 'styles', 'tokens.css'), 'utf8');

function block(selectorRe) {
  const start = css.search(selectorRe);
  if (start < 0) throw new Error(`block not found: ${selectorRe}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('unterminated block');
}
function vars(text) {
  const out = {};
  for (const m of text.matchAll(/--([a-z0-9_-]+):\s*(#[0-9a-f]{6})\b/gi)) out[m[1]] = m[2];
  return out;
}
function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const light = vars(block(/:root\s*\{/));
const dark = { ...light, ...vars(block(/\.dark\s*\{/)) };

const STAGES = ['researched', 'contacted', 'conversation', 'demo', 'proposal', 'paid_pilot', 'declined'];
const TEXT_PAIRS = [
  ['foreground', 'background'], ['foreground', 'card'], ['foreground', 'popover'],
  ['muted-foreground', 'card'], ['muted-foreground', 'background'], ['muted-foreground', 'popover'],
  ['primary-foreground', 'primary'], ['accent-text', 'card'], ['accent-text', 'accent-soft'],
  ['sidebar-foreground', 'sidebar'], ['sidebar-primary-foreground', 'sidebar-primary'],
  ['success-foreground', 'success-soft'], ['warning-foreground', 'warning-soft'],
  ['destructive-foreground', 'destructive-soft'], ['info-foreground', 'info-soft'],
  ['destructive-foreground', 'card'], ['success-foreground', 'card'], ['warning-foreground', 'card'],
  ...STAGES.map((s) => [`stage-${s}`, `stage-${s}-bg`]),
];

for (const [name, theme] of [['light', light], ['dark', dark]]) {
  test(`WCAG AA text contrast: ${name} theme`, () => {
    for (const [fg, bg] of TEXT_PAIRS) {
      assert.ok(theme[fg] && theme[bg], `${name}: missing --${fg} or --${bg}`);
      const r = ratio(theme[fg], theme[bg]);
      assert.ok(r >= 4.5, `${name}: --${fg} on --${bg} is ${r.toFixed(2)}:1 (needs 4.5)`);
    }
  });
  test(`WCAG AA non-text contrast (focus ring, accent): ${name} theme`, () => {
    for (const [fg, bg] of [['ring', 'background'], ['ring', 'card'], ['primary', 'card'], ['primary', 'background']]) {
      const r = ratio(theme[fg], theme[bg]);
      assert.ok(r >= 3, `${name}: --${fg} on --${bg} is ${r.toFixed(2)}:1 (needs 3)`);
    }
  });
}

test('every light token has a dark counterpart', () => {
  const missing = Object.keys(vars(block(/:root\s*\{/))).filter((k) => !(k in vars(block(/\.dark\s*\{/))));
  assert.deepStrictEqual(missing, []);
});
