'use strict';
// Turns untrusted HTML into plain text + candidate links. Nothing here is
// ever rendered as HTML; output is plain strings. All regexes are bounded
// to keep worst-case time linear on hostile input.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: '...', copy: '(c)', reg: '(R)', trade: '(TM)', bull: '*', middot: '-' };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ' ';
    }
    const v = ENTITIES[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

// Remove <tag ...>...</tag> blocks (and comments) with linear indexOf scans,
// not lazy regexes, so hostile pages cannot cause quadratic slowdowns.
function removeBetween(src, open, close, openIsTag) {
  const lower = src.toLowerCase();
  let out = '';
  let i = 0;
  while (i < src.length) {
    let start = lower.indexOf(open, i);
    while (openIsTag && start !== -1 && /[a-z0-9-]/.test(lower[start + open.length] || '')) start = lower.indexOf(open, start + 1);
    if (start === -1) { out += src.slice(i); break; }
    out += src.slice(i, start) + ' ';
    const end = lower.indexOf(close, start + open.length);
    if (end === -1) break; // unclosed: drop the rest
    const gt = openIsTag ? lower.indexOf('>', end) : end + close.length - 1;
    i = gt === -1 ? src.length : gt + 1;
  }
  return out;
}

function stripBlocks(html, tags) {
  let out = html;
  for (const t of tags) out = removeBetween(out, `<${t}`, `</${t}`, true);
  return out;
}

function htmlToText(html) {
  let s = removeBetween(String(html), '<!--', '-->', false);
  s = stripBlocks(s, ['script', 'style', 'noscript', 'svg', 'template', 'iframe', 'nav', 'form', 'select', 'button']);
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer|\/td|\/dd|\/dt)\b[^>]{0,500}>/gi, '\n');
  s = s.replace(/<[^>]{0,2000}>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‍﻿]/g, '');
  s = s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function extractTitle(html) {
  const m = String(html).match(/<title\b[^>]{0,500}>([\s\S]{0,500}?)<\/title>/i);
  return m ? decodeEntities(m[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

function extractLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]{0,2000}?\bhref\s*=\s*(?:"([^"]{0,2000})"|'([^']{0,2000})'|([^\s>]{1,2000}))[^>]{0,2000}>([\s\S]{0,600}?)<\/a>/gi;
  let m;
  let n = 0;
  while ((m = re.exec(html)) && n < 2000) {
    n++;
    const href = decodeEntities((m[1] || m[2] || m[3] || '').trim());
    if (!href || /^(mailto:|tel:|javascript:|data:|#)/i.test(href)) continue;
    let abs;
    try { abs = new URL(href, baseUrl); } catch { continue; }
    abs.hash = '';
    const text = decodeEntities(m[4].replace(/<[^>]{0,2000}>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 120);
    out.push({ url: abs.toString(), text });
  }
  return out;
}

// Page selection: which internal links are worth reading.
const KEYWORDS = [
  [/apartment|habitational|multi-?family|landlord|residential-?rental|property-?owner|real-?estate|hoa|condo/i, 10],
  [/commercial|business-?insurance|industr|specialt|program|niche|services|coverage|products|lines/i, 5],
  [/about|team|staff|people|leadership|our-?agents|who-?we-?are|history|company/i, 6],
  [/carrier|compan(y|ies)-?we|partners|markets|insurers/i, 6],
  [/technology|careers|jobs|hiring|join/i, 4],
  [/contact|locations|office/i, 3],
  [/news|blog|press|insights/i, 2],
];
const SKIP = /(log-?in|sign-?in|sign-?up|account|portal|my-?policy|cart|checkout|payment|pay-?bill|make-?a-?payment|wp-admin|wp-login|\/feed\b|privacy|terms|cookie|sitemap|accessibility|\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4|mp3|ics|xml|json)(\?|$))/i;

function scoreLink(link) {
  const u = new URL(link.url);
  const hay = `${u.pathname} ${link.text}`;
  if (SKIP.test(u.pathname + u.search) || SKIP.test(link.text)) return -1;
  let score = 0;
  for (const [re, w] of KEYWORDS) if (re.test(hay)) score += w;
  if (u.search) score -= 2;
  if (u.pathname.split('/').filter(Boolean).length > 3) score -= 2;
  return score;
}

function normalizeUrl(url) {
  const u = new URL(url);
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  let p = u.pathname.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/$/, '');
  u.pathname = p;
  return u.toString();
}

function selectPages(links, { sameSiteFn, max, exclude = new Set() }) {
  const seen = new Set(exclude);
  const scored = [];
  for (const l of links) {
    let norm;
    try { norm = normalizeUrl(l.url); } catch { continue; }
    if (seen.has(norm)) continue;
    const u = new URL(norm);
    if (u.protocol !== 'https:' || !sameSiteFn(u.hostname)) continue;
    const s = scoreLink({ url: norm, text: l.text });
    if (s <= 0) continue;
    seen.add(norm);
    scored.push({ url: norm, score: s });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, max).map((x) => x.url);
}

module.exports = { htmlToText, extractTitle, extractLinks, selectPages, normalizeUrl, decodeEntities };
