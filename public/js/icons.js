// Self-hosted line icons (24x24, stroke). Drawn as SVG via DOM APIs, so they
// need no external files, fonts or inline-script exceptions to the CSP.
const P = {
  today: ['M12 3v2', 'M12 19v2', 'M5 12H3', 'M21 12h-2', 'M6.3 6.3 4.9 4.9', 'M19.1 19.1l-1.4-1.4', 'M6.3 17.7l-1.4 1.4', 'M19.1 4.9l-1.4 1.4', 'C12 12 4'],
  building: ['M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'M16 9h2a2 2 0 0 1 2 2v10', 'M3 21h18', 'M8 7h4', 'M8 11h4', 'M8 15h4'],
  search: ['C11 11 7', 'M21 21l-4.6-4.6'],
  plus: ['M12 5v14', 'M5 12h14'],
  phone: ['M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'],
  mail: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M3 7l9 6 9-6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  task: ['M4 5h16v14H4z', 'M8 12l2.5 2.5L16 9'],
  calendar: ['M4 6h16v15H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  notes: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'],
  sparkles: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z'],
  chevronLeft: ['M15 6l-6 6 6 6'],
  chevronRight: ['M9 6l6 6-6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  sun: ['C12 12 4', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
  monitor: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
  keyboard: ['M3 6h18v12H3z', 'M7 10h.01', 'M11 10h.01', 'M15 10h.01', 'M7 14h10'],
  command: ['M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  pin: ['M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z', 'C12 9.5 2.5'],
  pipeline: ['M4 5h4v14H4z', 'M10 5h4v9h-4z', 'M16 5h4v5h-4z'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M3 20h18'],
  message: ['M4 5h16v11H9l-5 4z'],
  users: ['C9 8 3.5', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.5a3.5 3.5 0 0 1 0 7', 'M18.5 20a6.5 6.5 0 0 0-3-5.5'],
  award: ['C12 9 6', 'M8.5 14 7 22l5-3 5 3-1.5-8'],
  flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
  wallet: ['M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M3 7l12-4v4', 'M16 13.5h.01'],
  clipboard: ['M8 4h8v3H8z', 'M8 5H5v16h14V5h-3', 'M9 12h6', 'M9 16h4'],
  sidebar: ['M3 4h18v16H3z', 'M9 4v16'],
  sortUp: ['M8 14l4-4 4 4'],
  sortDown: ['M8 10l4 4 4-4'],
  globe: ['C12 12 9', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  clock: ['C12 12 9', 'M12 7v5l3 2'],
  alert: ['M12 4 2.5 20h19z', 'M12 10v4', 'M12 17h.01'],
  undo: ['M9 14 4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  download: ['M12 4v12', 'M7 11l5 5 5-5', 'M5 20h14'],
  refresh: ['M20 11a8 8 0 0 0-14.6-4.5L4 8', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.6 4.5L20 16', 'M20 20v-4h-4'],
  more: ['C5 12 1', 'C12 12 1', 'C19 12 1'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  stop: ['M7 7h10v10H7z'],
  thumbDown: ['M10 15v4a2 2 0 0 0 2 2l3-7V4H6.5a2 2 0 0 0-2 1.7l-1.4 7A2 2 0 0 0 5 15z', 'M15 4h4v10h-4'],
  eyeOff: ['M3 3l18 18', 'M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6', 'M6.6 7.6C4 9.4 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.4-1.1', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
};

const NS = 'http://www.w3.org/2000/svg';

export function icon(name, { size = 16, label } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'icon');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  for (const d of P[name] || []) {
    if (d.startsWith('C')) { // "C cx cy r" = circle
      const [cx, cy, r] = d.slice(1).trim().split(/\s+/);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
      svg.append(c);
    } else {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      svg.append(p);
    }
  }
  return svg;
}
