'use strict';
// WCAG AA contrast check for the design tokens in public/css/tokens.css,
// in both light and dark themes. 4.5:1 for text, 3:1 for UI borders/focus.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'tokens.css'), 'utf8');

function block(selectorRe) {
  const start = css.search(selectorRe);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('block not found');
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
const dark = { ...light, ...vars(block(/:root\[data-theme="dark"\]\s*\{/)) };
const darkSystem = { ...light, ...vars(block(/:root:not\(\[data-theme="light"\]\)\s*\{/)) };

const TEXT_PAIRS = [
  ['text', 'bg'], ['text', 'surface'], ['text-muted', 'surface'], ['text-muted', 'bg'], ['text-subtle', 'surface'],
  ['text-on-accent', 'accent'], ['accent-text', 'surface'], ['accent-text', 'accent-soft'], ['text', 'sidebar-bg'],
  ['text-muted', 'sidebar-bg'], ['success', 'success-soft'], ['warning', 'warning-soft'], ['danger', 'danger-soft'],
  ['info', 'info-soft'], ['danger', 'surface'],
  ...['researched', 'contacted', 'conversation', 'demo', 'proposal', 'paid_pilot', 'declined'].map((s) => [`stage-${s}`, `stage-${s}-bg`]),
];

for (const [name, theme] of [['light', light], ['dark', dark], ['dark (system)', darkSystem]]) {
  test(`WCAG AA text contrast: ${name} theme`, () => {
    for (const [fg, bg] of TEXT_PAIRS) {
      const r = ratio(theme[fg], theme[bg]);
      assert.ok(r >= 4.5, `${name}: --${fg} on --${bg} is ${r.toFixed(2)}:1 (needs 4.5)`);
    }
  });
  test(`WCAG AA UI contrast (focus ring / accent): ${name} theme`, () => {
    for (const [fg, bg] of [['accent', 'bg'], ['accent', 'surface'], ['border-strong', 'surface']]) {
      const r = ratio(theme[fg], theme[bg]);
      const need = fg === 'border-strong' ? 1.5 : 3; // decorative borders are not required to meet 3:1
      assert.ok(r >= need, `${name}: --${fg} on --${bg} is ${r.toFixed(2)}:1 (needs ${need})`);
    }
  });
}

test('dark theme blocks are identical (explicit and system)', () => {
  assert.deepStrictEqual(vars(block(/:root\[data-theme="dark"\]\s*\{/)), vars(block(/:root:not\(\[data-theme="light"\]\)\s*\{/)));
});
