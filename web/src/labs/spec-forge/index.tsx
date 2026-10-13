/**
 * Spec Forge: build and price a Flux app spec with a form, with JSON, or both at once.
 *
 * The lab is the editor (`@/forge`) plus the things only a page owns: a tool bar (examples, import, copy,
 * download, share link, undo and redo, Deploy on FluxCloud), the Teach me notes, shortcuts that work
 * anywhere on the page, the share link in the address bar and the achievements. The lab frame around it
 * (title, Teach me drawer, status strip) is the app's; `useLabFrame` in the tool bar feeds it.
 *
 * Linting and pricing are the shared engine's, run inside the editor's session: nothing here computes a
 * price or decides what is valid.
 */

import type { FluxAppSpec } from '@shared/flux/types';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGeo } from '@/data';
import { type ForgeState, SpecEditor, type SpecEditorHandle } from '@/forge';
import { indexIssues } from '@/forge/issues';
import {
  decodeShare,
  eligibleNodes,
  type ForgeSession,
  isEnterprisePlaceholder,
  presetSpec,
  readShareHash,
} from '@/forge/model';
import { unlock } from '@/learn/achievements';
import type { DeepPartial } from '@/learn/types';
import { isTypingTarget } from '@/system/hotkeys';
import { toast } from '@/system/toasts';
import { Button, Callout, Skeleton } from '@/ui';
import { ImportDialog } from './ImportDialog';
import type { ImportSource } from './importing';
import styles from './lab.module.css';
import { Toolbar } from './Toolbar';

/** The spec the lab opens with: a small web app with a location rule, so every panel has something to say. */
const START = 'web-app';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringsOf(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ---------------------------------------------------------------------------
// Opening from a share link
// ---------------------------------------------------------------------------

type Boot =
  | { status: 'loading' }
  | { status: 'ready'; spec: Record<string, unknown> | null; failure: string | null };

function hashPayload(): string | null {
  return typeof window === 'undefined' ? null : readShareHash(window.location.hash);
}

/** Decodes `#s=...` once, on arrival. A link that cannot be read falls back to the starting spec and says so. */
function useBoot(): Boot {
  const [boot, setBoot] = useState<Boot>(() =>
    hashPayload() ? { status: 'loading' } : { status: 'ready', spec: null, failure: null },
  );
  useEffect(() => {
    const payload = hashPayload();
    if (!payload) {
      setBoot((b) => (b.status === 'loading' ? { status: 'ready', spec: null, failure: null } : b));
      return;
    }
    let live = true;
    void decodeShare(payload).then((r) => {
      if (!live) return;
      if (r.ok && isRecord(r.value)) setBoot({ status: 'ready', spec: r.value, failure: null });
      else {
        setBoot({
          status: 'ready',
          spec: null,
          failure: r.ok ? 'This link unpacked, but what is inside is not a spec.' : r.message,
        });
      }
    });
    return () => {
      live = false;
    };
  }, []);
  return boot;
}

// ---------------------------------------------------------------------------
// The lab
// ---------------------------------------------------------------------------

function Forge({ start, failure }: { start: Record<string, unknown> | null; failure: string | null }) {
  const editor = useRef<SpecEditorHandle>(null);
  const [session, setSession] = useState<ForgeSession | null>(null);
  const [importing, setImporting] = useState(false);
  const [noticeShown, setNoticeShown] = useState(true);

  const initial = useMemo<DeepPartial<FluxAppSpec> | FluxAppSpec | undefined>(
    () => (start as DeepPartial<FluxAppSpec> | null) ?? presetSpec(START) ?? undefined,
    [start],
  );

  // The editor makes its session when it mounts; the tool bar and the shortcuts need it.
  useLayoutEffect(() => {
    setSession(editor.current?.getSession() ?? null);
  }, []);

  // How many nodes the geolocation leaves, from the live census when there is one: the checker says so when
  // the app asks for more instances than that. Only the geolocation is watched, so typing elsewhere does
  // not re-render the lab.
  const geo = useGeo();
  const [geolocation, setGeolocation] = useState<readonly string[]>(() =>
    stringsOf((initial as { geolocation?: unknown } | undefined)?.geolocation),
  );
  const onChange = useCallback((s: ForgeState) => {
    setGeolocation((cur) => (sameList(cur, s.spec.geolocation) ? cur : s.spec.geolocation));
  }, []);
  const eligible = useMemo(() => {
    const countries = geo.data?.countries;
    return countries && countries.length > 0 ? eligibleNodes(geolocation, countries).nodes : undefined;
  }, [geo.data, geolocation]);
  const lintContext = useMemo(() => ({ teaching: true, eligibleNodes: eligible }), [eligible]);

  // Someone pastes another share link into the address bar while the lab is open.
  useEffect(() => {
    if (!session) return;
    const onHash = () => {
      const payload = hashPayload();
      if (!payload) return;
      void decodeShare(payload).then((r) => {
        if (!r.ok) {
          toast(r.message, { kind: 'error' });
          return;
        }
        session.replace(r.value, 'share');
        toast('Opened the shared spec. Undo brings your last spec back.');
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [session]);

  // On this page `/` finds a field, not a page. The command deck keeps Ctrl+K, and `/` still opens it when a
  // dialog or the page chrome has focus. Capture phase so it wins over the app-wide `/`.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (isTypingTarget(e.target)) return;
      if (document.documentElement.dataset.scrollLocked === 'true') return;
      const t = e.target;
      const inChrome = t instanceof Element && t.closest('header, nav, footer, [role="dialog"]') !== null;
      if (inChrome) return;
      e.preventDefault();
      e.stopPropagation();
      editor.current?.focusSearch();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  const onImport = (value: Record<string, unknown>, source: ImportSource) => {
    if (!session) return;
    session.replace(value, 'import');
    const s = session.getSnapshot();
    const errors = indexIssues(s.lint, {
      enterprisePlaceholder: isEnterprisePlaceholder(s.spec.enterprise),
    }).errors;
    const what =
      source === 'link'
        ? 'Opened the shared spec'
        : source === 'api'
          ? 'Found the spec in that answer'
          : 'Spec imported';
    toast(errors > 0 ? `${what}. It has ${errors} ${errors === 1 ? 'error' : 'errors'} to fix.` : `${what}.`);
  };

  return (
    <div className={styles.lab}>
      <Toolbar
        session={session}
        editor={editor}
        modalOpen={importing}
        onOpenImport={() => setImporting(true)}
      />

      {failure && noticeShown ? (
        <Callout kind="gotcha" title="That link did not open">
          <p style={{ margin: 0 }}>
            {failure} The starting spec is shown instead.{' '}
            <Button variant="ghost" size="sm" onClick={() => setNoticeShown(false)}>
              Dismiss
            </Button>
          </p>
        </Callout>
      ) : null}

      <div className={styles.stage}>
        <SpecEditor
          ref={editor}
          initial={initial}
          lintContext={lintContext}
          onChange={onChange}
          onAchievement={unlock}
        />
      </div>

      <ImportDialog open={importing} onClose={() => setImporting(false)} onImport={onImport} />
    </div>
  );
}

export default function SpecForgeLab() {
  const boot = useBoot();
  if (boot.status === 'loading') {
    return (
      <div className={styles.opening} role="status" aria-busy="true">
        <Skeleton shape="block" height={360} />
        <span>Opening the shared spec</span>
      </div>
    );
  }
  return <Forge start={boot.spec} failure={boot.failure} />;
}
