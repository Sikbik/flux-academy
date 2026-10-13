/**
 * Reading what a person pastes into the Import dialog. Three shapes are understood, all of them the things
 * people actually have to hand:
 *
 *   a spec           the JSON itself, from FluxCloud, the docs or another forge
 *   a share link     `https://.../labs/spec-forge#s=...` (or just the `#s=...` part)
 *   an API answer    `{ "status": "success", "data": { ...spec } }`, or a list holding one spec
 *
 * Pure apart from the share link, which is decoded with the platform's DecompressionStream.
 */

import { decodeShare, parseJsonText } from '@/forge/model';

export type ImportSource = 'json' | 'link' | 'api';

export type ImportResult =
  | { ok: true; value: Record<string, unknown>; source: ImportSource }
  | { ok: false; message: string; hint?: string; line?: number; column?: number };

const LINK = /[#&?]s=([A-Za-z0-9_.-]+)/;
const BARE_PAYLOAD = /^(?:[dr]\.)?[A-Za-z0-9_-]{24,}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function looksLikeCompose(text: string): boolean {
  const t = text.trimStart();
  if (t.startsWith('{') || t.startsWith('[')) return false;
  return /^(services|version|x-[\w-]+|volumes|networks)\s*:/m.test(t);
}

type Unwrapped =
  | { ok: true; value: Record<string, unknown>; source: 'json' | 'api' }
  | { ok: false; message: string; hint?: string };

function unwrap(value: unknown, depth = 0): Unwrapped {
  if (Array.isArray(value)) {
    if (value.length === 0) return { ok: false, message: 'That list is empty, so there is no spec in it.' };
    if (value.length > 1) {
      return {
        ok: false,
        message: `That is a list of ${value.length} specs.`,
        hint: 'Paste just one of them.',
      };
    }
    const inner = unwrap(value[0], depth + 1);
    return inner.ok ? { ...inner, source: 'api' } : inner;
  }
  if (!isRecord(value)) {
    return {
      ok: false,
      message: 'A spec is a JSON object, which starts with an opening brace.',
      hint: 'Paste the whole spec, from the first { to the last }.',
    };
  }
  const wrapped =
    depth < 2 &&
    'data' in value &&
    (typeof value.status === 'string' || Object.keys(value).length <= 2) &&
    (isRecord(value.data) || Array.isArray(value.data));
  if (wrapped) {
    const inner = unwrap(value.data, depth + 1);
    return inner.ok ? { ...inner, source: 'api' } : inner;
  }
  return { ok: true, value, source: 'json' };
}

/** Understand pasted text. Never throws. */
export async function readImport(text: string): Promise<ImportResult> {
  const raw = text.trim();
  if (!raw) return { ok: false, message: 'Nothing to import yet.', hint: 'Paste a spec, or choose a file.' };

  if (looksLikeCompose(raw)) {
    return {
      ok: false,
      message: 'This looks like a Docker Compose file, which is YAML.',
      hint: 'The forge reads Flux specs, which are JSON. FluxCloud has an Import compose / spec button for compose files.',
    };
  }

  // A share link, a bare fragment, or the payload on its own.
  const link = LINK.exec(raw);
  const bare = !raw.startsWith('{') && !raw.startsWith('[') && BARE_PAYLOAD.test(raw);
  if (link || bare) {
    const payload = link ? (link[1] as string) : raw;
    const decoded = await decodeShare(payload);
    if (!decoded.ok) return { ok: false, message: decoded.message };
    const inner = unwrap(decoded.value);
    return inner.ok ? { ok: true, value: inner.value, source: 'link' } : inner;
  }

  const parsed = parseJsonText(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.error.message,
      hint: parsed.error.hint,
      line: parsed.error.line + 1,
      column: parsed.error.column + 1,
    };
  }
  const inner = unwrap(parsed.value);
  return inner.ok ? { ok: true, value: inner.value, source: inner.source } : inner;
}
