'use strict';
// SSRF guard: decides which hosts and IP addresses Deep Research may contact.
// Only public internet addresses are allowed; loopback, private, link-local,
// carrier-grade NAT, multicast, documentation and other special ranges are
// blocked. This check runs on EVERY hop, including after each redirect.
const net = require('net');

const blocked = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv4'));
[
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23],
  ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
].forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv6'));

function isPublicIp(address) {
  const family = net.isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) {
    const lower = address.toLowerCase();
    // IPv4-mapped / IPv4-compatible IPv6 (::ffff:127.0.0.1): judge the embedded IPv4.
    const mapped = lower.match(/^(?:0{0,4}:){0,5}(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isPublicIp(mapped[1]);
    const hexMapped = lower.match(/^(?:0{0,4}:){0,5}ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPublicIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    if (lower.startsWith('::ffff:')) return false;
    return !blocked.check(address, 'ipv6');
  }
  return false;
}

// Hostname sanity: a real public DNS name, never an IP literal or local name.
function checkHostname(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h || h.length > 253) return 'missing or too long host name';
  if (net.isIP(h) || h.startsWith('[')) return 'IP addresses are not allowed; use the agency\'s domain name';
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return 'host name is not a public domain';
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|test|invalid|example|onion)$/.test(h)) {
    return 'local or reserved host names are not allowed';
  }
  return null;
}

// "Registered domain" (eTLD+1), approximated without the full Public Suffix
// List: handles common two-part suffixes such as co.uk or com.au. US agency
// sites are almost always example.com style, where this is exact.
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au',
  'co.nz', 'org.nz', 'co.za', 'com.br', 'com.mx', 'co.jp', 'co.in', 'co.il', 'com.sg', 'com.hk',
  'pa.us', 'ny.us', 'nj.us', 'k12.pa.us',
]);
function registeredDomain(hostname) {
  const parts = String(hostname).toLowerCase().replace(/\.$/, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const last2 = parts.slice(-2).join('.');
  const last3 = parts.slice(-3).join('.');
  if (MULTI_PART_SUFFIXES.has(last3)) return parts.slice(-4).join('.');
  if (MULTI_PART_SUFFIXES.has(last2)) return last3;
  return last2;
}
function sameSite(hostname, base) {
  const h = String(hostname).toLowerCase().replace(/\.$/, '');
  return h === base || h.endsWith('.' + base);
}

// Sites we never research even if confirmed: search engines, social networks,
// review/maps sites and other login-gated platforms.
const FORBIDDEN_DOMAINS = [
  'google.com', 'google.co.uk', 'goo.gl', 'g.page', 'bing.com', 'duckduckgo.com', 'yahoo.com',
  'facebook.com', 'fb.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'tiktok.com',
  'youtube.com', 'pinterest.com', 'reddit.com', 'threads.net', 'yelp.com', 'nextdoor.com',
  'glassdoor.com', 'indeed.com', 'zoominfo.com', 'apollo.io', 'bbb.org',
];
function forbiddenSite(hostname) {
  const reg = registeredDomain(hostname);
  return FORBIDDEN_DOMAINS.some((d) => reg === d || reg.endsWith('.' + d));
}

module.exports = { isPublicIp, checkHostname, registeredDomain, sameSite, forbiddenSite };
