'use strict';
// SSRF protections and robots.txt handling for the research crawler.
const test = require('node:test');
const assert = require('node:assert');
const { isPublicIp, registeredDomain, sameSite } = require('../src/research/netguard');
const { createSafeFetcher } = require('../src/research/fetcher');
const { parseRobots, isAllowed } = require('../src/research/robots');
const { startApp } = require('./helpers');
const { fakeSite, fakeLlm, validOutput, RESEARCH_CONFIG, waitForRun, PAGES } = require('./research-helpers');

test('private, loopback, link-local and special IPs are not public', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1',
    '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1',
    '::ffff:10.0.0.1', '::ffff:7f00:1', '64:ff9b::7f00:1', 'not-an-ip']) {
    assert.strictEqual(isPublicIp(ip), false, ip);
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111', '::ffff:93.184.216.34']) assert.strictEqual(isPublicIp(ip), true, ip);
});

test('registered domain and same-site rules', () => {
  assert.strictEqual(registeredDomain('www.acme-agency.com'), 'acme-agency.com');
  assert.strictEqual(registeredDomain('a.b.agency.co.uk'), 'agency.co.uk');
  assert.ok(sameSite('blog.acme-agency.com', 'acme-agency.com'));
  assert.ok(!sameSite('acme-agency.com.evil.com', 'acme-agency.com'));
  assert.ok(!sameSite('evilacme-agency.com', 'acme-agency.com'));
});

function fetcherWith(site, siteBase = 'acme-agency.com') {
  return createSafeFetcher({ siteBase, userAgent: 'HQDesk-research/1.0 (contact: t@example.com)', resolve: site.resolve, transport: site.transport });
}

test('fetcher blocks http, localhost, IP literals, odd ports and credentials', async () => {
  const site = fakeSite();
  const f = fetcherWith(site, null);
  for (const url of ['http://www.acme-agency.com/', 'https://localhost/', 'https://127.0.0.1/', 'https://[::1]/',
    'https://www.acme-agency.com:8443/', 'https://user:pw@www.acme-agency.com/', 'https://intranet/', 'https://printer.local/',
    'https://www.facebook.com/acme', 'https://www.google.com/search?q=x', 'file:///etc/passwd']) {
    await assert.rejects(f.fetch(url), (e) => e.code === 'BLOCKED', url);
  }
  assert.strictEqual(site.requested.length, 0, 'nothing may be requested');
});

test('fetcher blocks hosts that resolve to private addresses (any record)', async () => {
  const site = fakeSite({ dnsOverrides: { 'evil.acme-agency.com': ['93.184.216.34', '10.0.0.5'], 'meta.acme-agency.com': '169.254.169.254', 'v6.acme-agency.com': '::1' } });
  const f = fetcherWith(site);
  for (const host of ['evil', 'meta', 'v6']) {
    await assert.rejects(f.fetch(`https://${host}.acme-agency.com/`), /private or local/);
  }
  assert.strictEqual(site.requested.length, 0);
});

test('redirect to a private IP, to another domain, or too many redirects is blocked', async () => {
  const pages = {
    '/r-private': { redirect: 'https://internal.acme-agency.com/admin' },
    '/r-other': { redirect: 'https://other-site.com/' },
    '/r-http': { redirect: 'http://www.acme-agency.com/' },
    ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((i) => [`/loop${i}`, { redirect: `/loop${i + 1}` }])),
  };
  const site = fakeSite({ pages, dnsOverrides: { 'internal.acme-agency.com': '192.168.1.10' } });
  const f = fetcherWith(site);
  await assert.rejects(f.fetch('https://www.acme-agency.com/r-private'), /private or local/);
  await assert.rejects(f.fetch('https://www.acme-agency.com/r-other'), /Left the agency's domain/);
  await assert.rejects(f.fetch('https://www.acme-agency.com/r-http'), /Only https/);
  await assert.rejects(f.fetch('https://www.acme-agency.com/loop0'), /redirects/);
  assert.ok(!site.requested.some((r) => r.address === '192.168.1.10'), 'never connected to the private IP');
  // The connection is pinned to the checked IP.
  assert.ok(site.requested.every((r) => r.address === '93.184.216.34'));
});

test('fetcher refuses non-HTML content', async () => {
  const site = fakeSite({ pages: { '/file.pdf': { type: 'application/pdf', body: '%PDF' } } });
  await assert.rejects(fetcherWith(site).fetch('https://www.acme-agency.com/file.pdf'), /Not an HTML page/);
});

test('robots.txt parsing: groups, longest match, wildcards', () => {
  const g = parseRobots('User-agent: *\nDisallow: /\nAllow: /public\n\nUser-agent: HQDesk-research\nDisallow: /private\nDisallow: /*.php$\n');
  assert.strictEqual(isAllowed(g, '/about'), true); // our specific group applies, not "*"
  assert.strictEqual(isAllowed(g, '/private/x'), false);
  assert.strictEqual(isAllowed(g, '/index.php'), false);
  assert.strictEqual(isAllowed(g, '/index.php?x=1'), true);
  assert.strictEqual(isAllowed(g, '/about', 'someotherbot'), false);
  assert.strictEqual(isAllowed(g, '/public/x', 'someotherbot'), true);
  assert.strictEqual(isAllowed(parseRobots('User-agent: *\nDisallow:\n'), '/x'), true);
});

test('research run obeys robots.txt and sends a descriptive User-Agent', async () => {
  const site = fakeSite();
  const llm = fakeLlm(validOutput());
  const app = await startApp(RESEARCH_CONFIG, undefined, { llmFetch: llm.fetch, researchResolve: site.resolve, researchTransport: site.transport });
  try {
    const { body } = await app.request('POST', '/api/agencies/manual', { manual_name: 'Acme' });
    const start = await app.request('POST', `/api/agencies/${body.id}/research`, { confirmed_url: 'https://www.acme-agency.com/' });
    assert.strictEqual(start.status, 202, JSON.stringify(start.body));
    const run = await waitForRun(app, start.body.id);
    assert.strictEqual(run.status, 'succeeded', run.error);
    const urls = site.requested.map((r) => new URL(r.url).pathname);
    assert.strictEqual(urls[0], '/robots.txt');
    assert.ok(!urls.includes('/private/staff'), 'disallowed page must not be fetched');
    assert.ok(!urls.includes('/login'), 'login pages are skipped');
    assert.ok(site.requested.every((r) => r.ua === 'HQDesk-research/1.0 (contact: founder@example.com)'));
    assert.ok(run.pages.some((p) => p.note === 'blocked by robots.txt'));
    assert.ok(run.pages.length <= 8);
  } finally { await app.close(); }
});

test('robots.txt server error or "Disallow: /" stops the run before any page is fetched', async () => {
  for (const robots of [{ status: 503, type: 'text/plain', body: 'down' }, { type: 'text/plain', body: 'User-agent: *\nDisallow: /' }]) {
    const site = fakeSite({ pages: { ...PAGES, '/robots.txt': robots } });
    const llm = fakeLlm(validOutput());
    const app = await startApp(RESEARCH_CONFIG, undefined, { llmFetch: llm.fetch, researchResolve: site.resolve, researchTransport: site.transport });
    try {
      const { body } = await app.request('POST', '/api/agencies/manual', { manual_name: 'Acme' });
      const start = await app.request('POST', `/api/agencies/${body.id}/research`, { confirmed_url: 'https://www.acme-agency.com/' });
      const run = await waitForRun(app, start.body.id);
      assert.strictEqual(run.status, 'failed');
      assert.ok(robots.status ? /robots/.test(run.error) : run.pages.every((p) => p.note === 'blocked by robots.txt'), run.error);
      assert.deepStrictEqual(site.requested.map((r) => new URL(r.url).pathname), ['/robots.txt']);
      assert.strictEqual(llm.calls.length, 0, 'LLM never called');
    } finally { await app.close(); }
  }
});

test('confirmed URL must be a public https site (not localhost, Google or social)', async () => {
  const site = fakeSite();
  const app = await startApp(RESEARCH_CONFIG, undefined, { llmFetch: fakeLlm(validOutput()).fetch, researchResolve: site.resolve, researchTransport: site.transport });
  try {
    const { body } = await app.request('POST', '/api/agencies/manual', { manual_name: 'Acme' });
    for (const url of ['http://www.acme-agency.com/', 'https://localhost:4317/', 'https://192.168.0.1/', 'https://www.google.com/maps/place/x', 'https://www.linkedin.com/company/acme']) {
      const r = await app.request('POST', `/api/agencies/${body.id}/research`, { confirmed_url: url });
      assert.strictEqual(r.status, 400, url);
    }
    assert.strictEqual(app.db.prepare('SELECT COUNT(*) n FROM research_runs').get().n, 0);
    assert.strictEqual(site.requested.length, 0);
  } finally { await app.close(); }
});
