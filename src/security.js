'use strict';
// Local-only hardening.
// - Host check: only accept requests addressed to 127.0.0.1/localhost on our
//   port. Blocks DNS-rebinding attacks from websites you visit.
// - CSRF: every state-changing request must carry the custom X-HQ-Desk header
//   (browsers cannot send it cross-site without a CORS preflight, which we
//   never approve) and, if present, an Origin matching this server.
// - Strict security headers: no external scripts, no framing.

function allowedHosts(port) {
  return new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
}

function hostCheck(port) {
  const hosts = allowedHosts(port);
  return (req, res, next) => {
    if (!hosts.has(String(req.headers.host || '').toLowerCase())) {
      return res.status(403).json({ error: 'Forbidden host.' });
    }
    next();
  };
}

function csrfCheck(port) {
  const origins = new Set([...allowedHosts(port)].map((h) => `http://${h}`));
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) return res.status(403).json({ error: 'Cross-origin request blocked.' });
    if (req.headers['x-hq-desk'] !== '1') return res.status(403).json({ error: 'Missing X-HQ-Desk header (CSRF protection).' });
    if (req.method !== 'DELETE' && !req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json.' });
    }
    next();
  };
}

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
}

module.exports = { hostCheck, csrfCheck, securityHeaders };
