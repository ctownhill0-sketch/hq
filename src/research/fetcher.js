'use strict';
// SSRF-safe page fetcher for Deep Research.
// - https only, port 443, no credentials in URLs
// - DNS is resolved by us; every address must be public (see netguard.js)
// - the connection is pinned to the checked IP (no second DNS lookup, which
//   defeats DNS-rebinding), with TLS still verified against the host name
// - redirects are followed manually (max 5) and every hop is re-checked,
//   including the same-registered-domain rule
// - 10s timeout, 1.5MB cap (after decompression), no cookies, no auth
const https = require('https');
const dns = require('dns').promises;
const zlib = require('zlib');
const { isPublicIp, checkHostname, sameSite, forbiddenSite } = require('./netguard');

class FetchBlockedError extends Error {
  constructor(message) { super(message); this.code = 'BLOCKED'; }
}
class FetchFailedError extends Error {
  constructor(message, code = 'FETCH_FAILED') { super(message); this.code = code; }
}

async function defaultResolve(hostname) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => ({ address: r.address, family: r.family }));
}

// Real network transport. Connects to the pre-checked IP only.
function httpsTransport({ url, address, family, headers, timeoutMs, maxBytes, signal }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      protocol: 'https:',
      hostname: u.hostname,
      servername: u.hostname, // SNI + certificate check against the real name
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers,
      agent: false,
      signal,
      // Pin: always return the IP we already validated.
      lookup: (_h, opts, cb) => (opts && opts.all ? cb(null, [{ address, family }]) : cb(null, address, family)),
    });
    const timer = setTimeout(() => req.destroy(new FetchFailedError('Timed out after 10s.', 'TIMEOUT')), timeoutMs);
    req.on('error', (e) => { clearTimeout(timer); reject(e.code === 'ABORT_ERR' ? new FetchFailedError('Cancelled.', 'CANCELLED') : e); });
    req.on('response', (res) => {
      const status = res.statusCode;
      const resHeaders = res.headers;
      if (status >= 300 && status < 400) { res.resume(); clearTimeout(timer); return resolve({ status, headers: resHeaders, body: Buffer.alloc(0) }); }
      const enc = String(resHeaders['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      const chunks = [];
      let size = 0;
      stream.on('data', (c) => {
        size += c.length;
        if (size > maxBytes) {
          clearTimeout(timer);
          req.destroy();
          reject(new FetchFailedError('Page is larger than 1.5MB; skipped.', 'TOO_LARGE'));
          return;
        }
        chunks.push(c);
      });
      stream.on('end', () => { clearTimeout(timer); resolve({ status, headers: resHeaders, body: Buffer.concat(chunks) }); });
      stream.on('error', (e) => { clearTimeout(timer); reject(new FetchFailedError(`Could not read response: ${e.message}`)); });
    });
    req.end();
  });
}

/**
 * createSafeFetcher(opts) -> { fetch(url, { kind: 'html' | 'robots', signal }) }
 * siteBase: registered domain all requests must stay on.
 * resolve/transport are injectable for tests.
 */
function createSafeFetcher({
  siteBase, userAgent, timeoutMs = 10000, maxBytes = 1.5 * 1024 * 1024, maxRedirects = 5,
  resolve = defaultResolve, transport = httpsTransport,
}) {
  async function checkUrl(raw) {
    let u;
    try { u = new URL(raw); } catch { throw new FetchBlockedError('Not a valid URL.'); }
    if (u.protocol !== 'https:') throw new FetchBlockedError('Only https:// pages are fetched.');
    if (u.username || u.password) throw new FetchBlockedError('URLs with credentials are not allowed.');
    if (u.port && u.port !== '443') throw new FetchBlockedError('Only the standard https port (443) is allowed.');
    const hostProblem = checkHostname(u.hostname);
    if (hostProblem) throw new FetchBlockedError(`Blocked host: ${hostProblem}.`);
    if (forbiddenSite(u.hostname)) throw new FetchBlockedError('Search engines, social networks and review sites are never researched.');
    if (siteBase && !sameSite(u.hostname, siteBase)) throw new FetchBlockedError(`Left the agency's domain (${siteBase}); not followed.`);
    let addrs;
    try { addrs = await resolve(u.hostname); } catch { throw new FetchFailedError(`Could not resolve ${u.hostname}.`, 'DNS'); }
    if (!addrs || !addrs.length) throw new FetchFailedError(`No address for ${u.hostname}.`, 'DNS');
    // Every address must be public; one private record blocks the host.
    for (const a of addrs) {
      if (!isPublicIp(a.address)) throw new FetchBlockedError(`Blocked: ${u.hostname} points to a private or local network address.`);
    }
    return { url: u, address: addrs[0].address, family: addrs[0].family || (addrs[0].address.includes(':') ? 6 : 4) };
  }

  async function safeFetch(startUrl, { kind = 'html', signal } = {}) {
    let current = startUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (signal && signal.aborted) throw new FetchFailedError('Cancelled.', 'CANCELLED');
      const { url, address, family } = await checkUrl(current);
      const headers = {
        'User-Agent': userAgent,
        Accept: kind === 'robots' ? 'text/plain' : 'text/html,application/xhtml+xml;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.8',
      };
      const res = await transport({ url: url.toString(), address, family, headers, timeoutMs, maxBytes, signal });
      if (res.status >= 300 && res.status < 400 && res.headers && res.headers.location) {
        current = new URL(String(res.headers.location), url).toString(); // re-checked on next loop
        continue;
      }
      const contentType = String((res.headers && res.headers['content-type']) || '').toLowerCase();
      if (kind === 'html' && res.status < 400 && !/^(text\/html|application\/xhtml\+xml)/.test(contentType)) {
        throw new FetchFailedError(`Not an HTML page (${contentType.split(';')[0] || 'unknown type'}); skipped.`, 'NOT_HTML');
      }
      if (res.body && res.body.length > maxBytes) throw new FetchFailedError('Page is larger than 1.5MB; skipped.', 'TOO_LARGE');
      return { finalUrl: url.toString(), status: res.status, contentType, body: res.body || Buffer.alloc(0) };
    }
    throw new FetchFailedError(`More than ${maxRedirects} redirects; stopped.`, 'REDIRECTS');
  }

  return { fetch: safeFetch, checkUrl };
}

module.exports = { createSafeFetcher, FetchBlockedError, FetchFailedError, httpsTransport };
