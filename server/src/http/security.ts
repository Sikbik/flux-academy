// Adapted from fluxcommunity/server/src/http/security.ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from '../config.ts';

/**
 * Content Security Policy, exactly as docs/ARCHITECTURE.md section 8 gives it. `media-src` is absent on
 * purpose: it falls back to `default-src 'self'`. Inline `<script type="application/ld+json">` data blocks
 * are not executed, so `script-src 'self'` does not affect them.
 */
export const CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

/** Nothing the app does needs a sensor, a payment sheet or a device API. */
export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), interest-cohort=()';

export interface SecurityHeaders {
  apply(req: IncomingMessage, res: ServerResponse): void;
  readonly csp: string;
}

export function createSecurityHeaders(config: Pick<Config, 'trustProxyHops'>): SecurityHeaders {
  return {
    csp: CSP,
    apply(req, res) {
      res.setHeader('Content-Security-Policy', CSP);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      // The page and API are same-origin only. Static media overrides this so social cards can be embedded.
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      // HSTS only when the proxy we trust says the visitor used TLS; never on plain HTTP. No
      // includeSubDomains: the parent domain is shared with other apps.
      if (
        config.trustProxyHops > 0 &&
        String(req.headers['x-forwarded-proto'] ?? '')
          .split(',')[0]
          ?.trim() === 'https'
      ) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      }
    },
  };
}
