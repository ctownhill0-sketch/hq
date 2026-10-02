'use strict';
// Fakes for research tests: a fictional agency website (served by a fake
// transport + fake DNS) and a fake Anthropic API. No real network is used.

const SITE = 'https://www.acme-agency.com';

const PAGES = {
  '/robots.txt': { type: 'text/plain', body: 'User-agent: *\nDisallow: /private\n' },
  '/': {
    body: `<html><head><title>Acme Agency</title><script>steal()</script></head><body>
      <nav><a href="/apartment-insurance">Apartment Insurance</a><a href="/about">About us</a><a href="/team">Our Team</a>
      <a href="/private/staff">Staff</a><a href="/login">Client Login</a><a href="https://facebook.com/acme">Facebook</a></nav>
      <h1>Independent insurance agency serving Pennsylvania since 1987</h1>
      <p>We represent more than 20 carriers including Example Mutual and Sample Specialty.</p></body></html>`,
  },
  '/apartment-insurance': {
    body: `<html><body><h1>Apartment and habitational insurance</h1>
      <p>We insure apartment buildings, multifamily properties and landlords across the Delaware Valley.</p></body></html>`,
  },
  '/about': {
    body: `<html><body><p>Our team of 14 licensed professionals uses Applied Epic to manage renewals.</p>
      <p>We are hiring a commercial lines account manager to support renewal volume.</p></body></html>`,
  },
  '/team': { body: '<html><body><h2>Jordan Sample, President</h2><p>Jordan Sample, President, leads our commercial team.</p></body></html>' },
  '/private/staff': { body: '<html><body>secret</body></html>' },
};

function fakeSite({ pages = PAGES, ip = '93.184.216.34', dnsOverrides = {} } = {}) {
  const requested = [];
  const resolve = async (host) => {
    if (dnsOverrides[host]) return [].concat(dnsOverrides[host]).map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
    if (host === 'www.acme-agency.com' || host === 'acme-agency.com') return [{ address: ip, family: 4 }];
    throw new Error('ENOTFOUND');
  };
  const transport = async ({ url, address, headers, signal }) => {
    if (signal && signal.aborted) throw Object.assign(new Error('aborted'), { code: 'CANCELLED' });
    requested.push({ url, address, ua: headers['User-Agent'] });
    const u = new URL(url);
    const p = pages[u.pathname];
    if (!p) return { status: 404, headers: { 'content-type': 'text/html' }, body: Buffer.from('not found') };
    if (p.redirect) return { status: 301, headers: { location: p.redirect }, body: Buffer.alloc(0) };
    if (p.delayMs) await new Promise((r, j) => { const t = setTimeout(r, p.delayMs); signal && signal.addEventListener('abort', () => { clearTimeout(t); j(Object.assign(new Error('aborted'), { code: 'CANCELLED' })); }); });
    return { status: p.status || 200, headers: { 'content-type': p.type || 'text/html; charset=utf-8' }, body: Buffer.from(p.body) };
  };
  return { resolve, transport, requested };
}

// A fully valid model output whose quotes really appear on the fake pages.
function validOutput(overrides = {}) {
  return {
    apartments: {
      verdict: 'yes',
      explanation: 'The site has a dedicated apartment insurance page.',
      evidence: [{ label: 'Insures apartment buildings', source_url: `${SITE}/apartment-insurance`, quote: 'We insure apartment buildings, multifamily properties and landlords' }],
    },
    niches_and_lines: [],
    markets_carriers_wholesalers: [{ label: 'Represents 20+ carriers', source_url: `${SITE}/`, quote: 'We represent more than 20 carriers' }],
    team_size_signals: [{ label: '14 licensed staff', source_url: `${SITE}/about`, quote: 'Our team of 14 licensed professionals' }],
    technology: [{ label: 'Uses Applied Epic', source_url: `${SITE}/about`, quote: 'uses Applied Epic to manage renewals' }],
    pain_signals: [{ label: 'Hiring for renewal volume', source_url: `${SITE}/about`, quote: 'We are hiring a commercial lines account manager to support renewal volume.' }],
    red_flags: [],
    leaders: [{ name: 'Jordan Sample', title: 'President', source_url: `${SITE}/team`, quote: 'Jordan Sample, President' }],
    unknowns: ['How many apartment renewals per month?'],
    fit: {
      rubric: {
        apartment_evidence: { score: 28, reason: 'Dedicated page.' },
        independence: { score: 18, reason: 'Says independent.' },
        size_fit: { score: 12, reason: '14 staff.' },
        bottleneck_signal: { score: 14, reason: 'Hiring for renewals.' },
        reachable_decision_maker: { score: 10, reason: 'President named.' },
      },
      low_confidence: false,
      why: 'Strong apartment focus and visible renewal workload.',
    },
    discovery_questions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
    personalization_lines: ['Line one.', 'Line two.'],
    ...overrides,
  };
}

function fakeLlm(output, { status = 200, stop = 'end_turn', delayMs = 0 } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    if (delayMs) await new Promise((r, j) => { const t = setTimeout(r, delayMs); init.signal && init.signal.addEventListener('abort', () => { clearTimeout(t); j(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })); }); });
    if (status !== 200) {
      return new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key sk-test-SECRET-KEY' } }), { status, headers: { 'content-type': 'application/json' } });
    }
    const text = typeof output === 'string' ? output : JSON.stringify(output);
    return new Response(JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
      content: [{ type: 'text', text }], stop_reason: stop, stop_sequence: null,
      usage: { input_tokens: 12000, output_tokens: 3000 },
    }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  };
  return { fetch, calls };
}

const RESEARCH_CONFIG = {
  llm: { provider: 'anthropic', apiKey: 'sk-test-SECRET-KEY', model: 'claude-opus-5-5', effort: 'medium', refusalFallback: true },
  research: { contactEmail: 'founder@example.com', requestIntervalMs: 0 },
};

async function waitForRun(app, runId, timeoutMs = 5000) {
  const start = Date.now();
  for (;;) {
    const r = await app.request('GET', `/api/research/runs/${runId}`);
    if (r.body.run.status !== 'running') return r.body.run;
    if (Date.now() - start > timeoutMs) throw new Error('run did not finish');
    await new Promise((res) => setTimeout(res, 20));
  }
}

module.exports = { SITE, PAGES, fakeSite, validOutput, fakeLlm, RESEARCH_CONFIG, waitForRun };
