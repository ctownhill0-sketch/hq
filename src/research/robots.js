'use strict';
// Minimal robots.txt support (RFC 9309): user-agent groups, Allow/Disallow,
// longest match wins (Allow wins ties), "*" wildcards and "$" end anchors.
// Fetch outcome rules: 2xx -> parse; 4xx -> everything allowed;
// 5xx / network error -> everything disallowed (we stay away).

const AGENT_TOKEN = 'hqdesk-research';

function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const rawLine of String(text || '').split(/\r?\n/).slice(0, 5000)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent || !current) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && current) {
      lastWasAgent = false;
      if (key === 'disallow' && value === '') continue; // empty Disallow = allow all
      current.rules.push({ allow: key === 'allow', pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function patternToRegex(pattern) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

function rulesFor(groups, token = AGENT_TOKEN) {
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && token.startsWith(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

function isAllowed(groups, pathWithQuery, token = AGENT_TOKEN) {
  const rules = rulesFor(groups, token);
  let best = null;
  for (const r of rules) {
    if (!r.pattern || !patternToRegex(r.pattern).test(pathWithQuery)) continue;
    const len = r.pattern.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
  }
  return best ? best.allow : true;
}

// Turn a fetch outcome into a policy object.
function robotsPolicy({ status, body, error }) {
  if (error || status >= 500) return { allowAll: false, disallowAll: true, groups: [], note: 'robots.txt unavailable (server error); not crawling' };
  if (status >= 400) return { allowAll: true, disallowAll: false, groups: [], note: 'no robots.txt' };
  return { allowAll: false, disallowAll: false, groups: parseRobots(body), note: 'robots.txt read' };
}

function policyAllows(policy, url) {
  if (policy.disallowAll) return false;
  if (policy.allowAll) return true;
  const u = new URL(url);
  return isAllowed(policy.groups, u.pathname + u.search);
}

module.exports = { parseRobots, isAllowed, robotsPolicy, policyAllows, AGENT_TOKEN };
