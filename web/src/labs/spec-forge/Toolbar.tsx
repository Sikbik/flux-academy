import { type RefObject, useMemo } from 'react';
import { type LabShortcut, useLabFrame } from '@/app/LabFrame';
import type { SpecEditorHandle } from '@/forge';
import { downloadText } from '@/forge';
import { indexIssues, summarize } from '@/forge/issues';
import {
  BAKED_CONTEXT,
  encodeShare,
  type ForgeSession,
  freshSpec,
  isEnterprisePlaceholder,
  presetById,
  presetSpec,
  SHARE_KEY,
  shareUrl,
  specToText,
} from '@/forge/model';
import { copyText } from '@/lib/clipboard';
import { announce } from '@/system/announce';
import { isTypingTarget, useHotkey, useHotkeyScope } from '@/system/hotkeys';
import { toast } from '@/system/toasts';
import { Button, Glyph, IconButton } from '@/ui';
import { deployCopy, shareCopy } from './exporting';
import styles from './lab.module.css';
import { ABOUT_NOTES, teachNotes } from './notes';
import { BLANK, PresetMenu } from './PresetMenu';
import { useSessionSnapshot } from './useSessionSnapshot';

export const FLUXCLOUD_REGISTER = 'https://cloud.runonflux.com/apps/register';

const SHORTCUTS: readonly LabShortcut[] = [
  { keys: 'mod+z', label: 'Undo' },
  { keys: 'mod+shift+z', label: 'Redo' },
  { keys: 'mod+enter', label: 'Verify the price' },
  { keys: '/', label: 'Find a field, or add a component' },
  { keys: 'n c', label: 'Add a component' },
  { keys: 'n p', label: 'Add a private component' },
];

/** Past this many characters a link is likely to be cut by chat apps and mail clients. */
const LONG_LINK = 6000;

export interface ToolbarProps {
  session: ForgeSession | null;
  editor: RefObject<SpecEditorHandle | null>;
  onOpenImport: () => void;
  /** A dialog is open: the lab's shortcuts stand down. */
  modalOpen: boolean;
}

/**
 * The lab's tool bar, and the owner of everything the lab says to the frame (Teach me notes, shortcuts, the
 * status line), so it is the one component that follows every change of the session.
 */
export function Toolbar({ session, editor, onOpenImport, modalOpen }: ToolbarProps) {
  const snap = useSessionSnapshot(session);

  const issues = useMemo(
    () =>
      snap
        ? indexIssues(snap.lint, { enterprisePlaceholder: isEnterprisePlaceholder(snap.spec.enterprise) })
        : null,
    [snap],
  );

  const notes = useMemo(() => (snap ? teachNotes(snap.spec, snap.quote) : []), [snap]);

  const usd = snap ? `$${snap.quote.usdPerMonth.toFixed(2)} a month` : '';
  const verdict = issues ? summarize(issues) : '';

  useLabFrame({
    about: ABOUT_NOTES,
    teach: notes,
    teachTitle: 'Teach me',
    shortcuts: SHORTCUTS,
    status: snap ? `${usd}. ${verdict}.` : undefined,
  });

  // ---- shortcuts that work anywhere on the page ---------------------------------------------------------------
  useHotkeyScope('forge', { active: !modalOpen });
  const enabled = () => !modalOpen && session !== null;
  useHotkey({
    id: 'forge.undo',
    keys: 'mod+z',
    label: 'Undo the last change',
    group: 'Spec Forge',
    scope: 'forge',
    enabled,
    run: (e) => {
      if (isTypingTarget(e.target)) return false;
      session?.undo();
      return undefined;
    },
  });
  useHotkey({
    id: 'forge.redo',
    keys: ['mod+shift+z', 'mod+y'],
    label: 'Redo',
    group: 'Spec Forge',
    scope: 'forge',
    enabled,
    run: (e) => {
      if (isTypingTarget(e.target)) return false;
      session?.redo();
      return undefined;
    },
  });
  useHotkey({
    id: 'forge.verify',
    keys: 'mod+enter',
    label: 'Verify the price with Flux',
    group: 'Spec Forge',
    scope: 'forge',
    enabled,
    allowInInput: true,
    run: () => {
      editor.current?.verify();
      return undefined;
    },
  });
  useHotkey({
    id: 'forge.search',
    keys: '/',
    label: 'Find a field in the form',
    group: 'Spec Forge',
    scope: 'forge',
    enabled,
    run: () => {
      editor.current?.focusSearch();
      return undefined;
    },
  });

  useHotkey({
    id: 'forge.addComponent',
    keys: 'n c',
    label: 'Add a component',
    group: 'Spec Forge',
    scope: 'forge',
    enabled,
    run: () => {
      editor.current?.addComponent({ focus: true });
      return undefined;
    },
  });
  useHotkey({
    id: 'forge.addPrivateComponent',
    keys: 'n p',
    label: 'Add a private component',
    group: 'Spec Forge',
    scope: 'forge',
    enabled,
    run: () => {
      editor.current?.addComponent({ private: true, focus: true });
      return undefined;
    },
  });

  // ---- actions ------------------------------------------------------------------------------------------------------
  const currentText = (): { text: string; stale: boolean } => {
    const s = session?.getSnapshot();
    if (!s) return { text: '', stale: false };
    if (s.text.error) return { text: specToText(s.spec), stale: true };
    return { text: s.text.text, stale: false };
  };

  const pickPreset = (id: string) => {
    if (!session) return;
    if (id === BLANK) {
      session.replace(freshSpec(), 'preset', 'Start from a blank spec');
      toast('Blank spec. The checker lists what is missing.');
      announce('Blank spec loaded.');
      return;
    }
    const spec = presetSpec(id);
    const preset = presetById(id);
    if (!spec || !preset) return;
    session.replace(spec, 'preset', `Load ${preset.label}`);
    toast(`${preset.label} loaded. Undo brings your spec back.`);
    announce(`${preset.label} loaded.`);
  };

  const copyJson = async () => {
    const { text, stale } = currentText();
    const ok = await copyText(`${text.trimEnd()}\n`);
    if (!ok) toast('Could not copy. Select the text in the JSON panel instead.', { kind: 'warn' });
    else if (stale)
      toast('The JSON has a mistake in it, so the last valid spec was copied.', { kind: 'warn' });
    else toast('JSON copied.');
  };

  const download = () => {
    const { text, stale } = currentText();
    const spec = session?.getSnapshot().spec;
    const safe = (spec?.name || 'flux-app').replace(/[^a-zA-Z0-9._-]+/g, '-');
    downloadText(`${safe}.json`, `${text.trimEnd()}\n`);
    toast(stale ? `Saved ${safe}.json from the last valid spec.` : `Saved ${safe}.json.`);
  };

  const copyLink = async () => {
    const s = session?.getSnapshot();
    if (!s) return;
    const { spec, credentialsLeftOut } = shareCopy(s.spec);
    const payload = await encodeShare(spec);
    const url = shareUrl(payload, {
      origin: window.location.origin,
      pathname: window.location.pathname,
      search: window.location.search,
    });
    try {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#${SHARE_KEY}=${payload}`,
      );
    } catch {
      // The address bar is a convenience; the copied link is what matters.
    }
    const ok = await copyText(url);
    if (!ok) {
      toast('Could not copy the link. It is in the address bar now.', { kind: 'warn' });
      return;
    }
    if (credentialsLeftOut > 0) toast('Link copied. Registry credentials were left out of it.');
    else if (url.length > LONG_LINK) {
      toast(`Link copied, but it is ${url.length} characters long. Some apps cut long links.`, {
        kind: 'warn',
      });
    } else toast('Share link copied. It holds the whole spec.');
  };

  const deploy = () => {
    const s = session?.getSnapshot();
    if (!s) return;
    const { text, enterpriseLeftEmpty } = deployCopy(s.spec);
    // Both start inside the click, so neither is blocked as a pop-up or a clipboard write without a gesture.
    const copying = copyText(`${text.trimEnd()}\n`);
    window.open(FLUXCLOUD_REGISTER, '_blank', 'noopener,noreferrer');
    void copying.then((ok) => {
      const errors = indexIssues(s.lint, {
        enterprisePlaceholder: isEnterprisePlaceholder(s.spec.enterprise),
      }).errors;
      if (!ok) {
        toast('Could not copy automatically. Use Copy JSON, then paste it in Advanced mode on FluxCloud.', {
          kind: 'warn',
        });
      } else if (errors > 0) {
        toast(
          `Spec copied. It still has ${errors} ${errors === 1 ? 'error' : 'errors'}, so FluxCloud will refuse it until they are fixed.`,
          { kind: 'warn' },
        );
      } else if (enterpriseLeftEmpty) {
        toast(
          'Spec copied with enterprise left empty. Switch Enterprise on in FluxCloud, which encrypts it.',
        );
      } else {
        toast('Spec copied. Paste it in Advanced mode on FluxCloud.');
      }
    });
  };

  const disabled = session === null;
  const state = !issues ? undefined : issues.errors > 0 ? 'crit' : issues.warnings > 0 ? 'warn' : 'ok';

  return (
    <fieldset className={styles.bar} aria-label="Spec tools">
      <div className={styles.group}>
        <PresetMenu
          className={styles.examples}
          pricing={snap?.pricing ?? BAKED_CONTEXT}
          disabled={disabled}
          onPick={pickPreset}
        />
        <IconButton
          className={styles.tool}
          icon="upload"
          label="Import a spec"
          disabled={disabled}
          onClick={onOpenImport}
        />
        <IconButton
          className={styles.tool}
          icon="copy"
          label="Copy JSON"
          disabled={disabled}
          onClick={() => void copyJson()}
        />
        <IconButton
          className={styles.tool}
          icon="download"
          label="Download JSON"
          disabled={disabled}
          onClick={download}
        />
        <IconButton
          className={styles.tool}
          icon="share"
          label="Copy share link"
          disabled={disabled}
          onClick={() => void copyLink()}
        />
      </div>

      <span className={styles.sep} aria-hidden="true" />

      <div className={styles.group}>
        <IconButton
          className={styles.history}
          icon="undo"
          label={snap?.undoLabel ? `Undo: ${snap.undoLabel}` : 'Undo'}
          shortcut="mod+z"
          disabled={!snap?.canUndo}
          onClick={() => session?.undo()}
        />
        <IconButton
          className={styles.history}
          icon="redo"
          label={snap?.redoLabel ? `Redo: ${snap.redoLabel}` : 'Redo'}
          shortcut="mod+shift+z"
          disabled={!snap?.canRedo}
          onClick={() => session?.redo()}
        />
      </div>

      <span className={styles.grow} />

      {snap && issues ? (
        <span className={styles.verdict} data-state={state}>
          <Glyph
            name={state === 'crit' ? 'status-crit' : state === 'warn' ? 'status-warn' : 'status-ok'}
            size={14}
          />
          <span>
            {usd}
            <span aria-hidden="true">{' · '}</span>
            <span className="sr-only">. </span>
            {verdict}
          </span>
        </span>
      ) : null}

      <Button
        className={styles.deploy}
        variant="primary"
        iconEnd="external"
        disabled={disabled}
        onClick={deploy}
      >
        Deploy on FluxCloud
      </Button>
    </fieldset>
  );
}
