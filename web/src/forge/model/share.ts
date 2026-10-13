/**
 * Share links: a spec in the URL hash, compressed.
 *
 *   https://academy.app.runonflux.io/labs/spec-forge#s=d.<base64url of deflate-raw of the compact JSON>
 *
 * The payload starts with a method letter and a dot:
 *   `d.`  deflate-raw (CompressionStream), the usual case, about 3x smaller than the JSON
 *   `r.`  the JSON itself, base64url, for browsers without CompressionStream
 * A payload without a prefix is read as `d.`, so hand built links keep working.
 *
 * Decoding is defensive: the hash is untrusted input. Sizes are capped before and during decompression and
 * every failure comes back as a result with a message a person can act on ("this link is damaged").
 */

import { specToCompactText } from './jsonText';

export const SHARE_KEY = 's';
const MAX_ENCODED = 60_000;
const MAX_DECODED = 400_000;

export type ShareFailure = 'empty' | 'format' | 'unsupported' | 'corrupt' | 'toolarge' | 'notjson';

export type ShareDecode =
  | { ok: true; value: unknown; method: 'd' | 'r' }
  | { ok: false; reason: ShareFailure; message: string };

const FAIL_MESSAGES: Record<ShareFailure, string> = {
  empty: 'This link has no spec in it.',
  format: 'This link is damaged: part of it is missing or was changed.',
  unsupported: 'This link needs a newer browser to open. Ask for the JSON instead.',
  corrupt: 'This link is damaged: it could not be unpacked.',
  toolarge: 'This link holds far more data than any Flux spec.',
  notjson: 'This link unpacked, but what is inside is not a spec.',
};

function fail(reason: ShareFailure): ShareDecode {
  return { ok: false, reason, message: FAIL_MESSAGES[reason] };
}

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  let b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Streams
// ---------------------------------------------------------------------------

export function canCompress(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

async function collect(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const source = new Blob([bytes as BlobPart]).stream();
  const piped = source.pipeThrough(new CompressionStream('deflate-raw'));
  const out = await collect(piped, MAX_DECODED);
  if (!out) throw new Error('compression failed');
  return out;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  const source = new Blob([bytes as BlobPart]).stream();
  const piped = source.pipeThrough(new DecompressionStream('deflate-raw'));
  return collect(piped, MAX_DECODED);
}

// ---------------------------------------------------------------------------
// Encode and decode
// ---------------------------------------------------------------------------

/** The payload for a spec (the part after `#s=`). Compresses when the browser can. */
export async function encodeShare(spec: unknown): Promise<string> {
  const text = specToCompactText(spec);
  const bytes = new TextEncoder().encode(text);
  if (canCompress()) {
    try {
      return `d.${bytesToBase64Url(await deflateRaw(bytes))}`;
    } catch {
      // fall through to the uncompressed form
    }
  }
  return `r.${bytesToBase64Url(bytes)}`;
}

/** Read a payload back into a JSON value. Never throws. */
export async function decodeShare(payload: string): Promise<ShareDecode> {
  const raw = payload.trim();
  if (!raw) return fail('empty');
  if (raw.length > MAX_ENCODED) return fail('toolarge');
  let method: 'd' | 'r' = 'd';
  let body = raw;
  const dot = raw.indexOf('.');
  if (dot >= 0) {
    const m = raw.slice(0, dot);
    if (m !== 'd' && m !== 'r') return fail('format');
    method = m;
    body = raw.slice(dot + 1);
  }
  if (!body) return fail('empty');
  const bytes = base64UrlToBytes(body);
  if (!bytes) return fail('format');
  let json: Uint8Array | null;
  if (method === 'd') {
    if (typeof DecompressionStream !== 'function') return fail('unsupported');
    try {
      json = await inflateRaw(bytes);
    } catch {
      return fail('corrupt');
    }
    if (!json) return fail('toolarge');
  } else {
    if (bytes.length > MAX_DECODED) return fail('toolarge');
    json = bytes;
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(json);
  } catch {
    return fail('corrupt');
  }
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail('notjson');
    return { ok: true, value, method };
  } catch {
    return fail('notjson');
  }
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/** The payload in a hash (`#s=...` or `#a=1&s=...`), or null when there is none. */
export function readShareHash(hash: string): string | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h) return null;
  for (const part of h.split('&')) {
    if (part.startsWith(`${SHARE_KEY}=`)) return part.slice(SHARE_KEY.length + 1);
  }
  return null;
}

/** A full link to this page carrying the payload. */
export function shareUrl(
  payload: string,
  base: { origin: string; pathname: string; search?: string },
): string {
  return `${base.origin}${base.pathname}${base.search ?? ''}#${SHARE_KEY}=${payload}`;
}
