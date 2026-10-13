/**
 * The JSON panel: the spec as text, two-way bound to the form. Edits are tolerant while typing (a document
 * that does not parse keeps the last good spec and says where it broke), the learner's text is never
 * rewritten under them, and every lint issue shows up on its line.
 */

import { type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { toast } from '@/system/toasts';
import { Glyph, IconButton } from '@/ui';
import { useForgeUi } from '../context';
import controls from '../controls/controls.module.css';
import { applySuggestion } from '../model';
import { JsonEditor, type JsonEditorHandle } from './json/JsonEditor';
import styles from './json/json.module.css';

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function JsonPanel({ editorRef }: { editorRef: RefObject<JsonEditorHandle | null> }) {
  const ui = useForgeUi();
  const { snap } = ui;
  const { text, spec } = snap;
  const errorId = useId();
  const stage = useRef<HTMLDivElement>(null);

  // The underlines are errors and warnings; notes live in the Issues panel.
  const marked = useMemo(() => ui.issues.issues.filter((i) => i.severity !== 'info'), [ui.issues]);
  const noteMarkers = useMemo(() => ui.focusNotes.map((n) => ({ path: n.path, n: n.n })), [ui.focusNotes]);

  // The scan: a thin accent line sweeps the editor when what lint says changes, not on every keystroke.
  const signature = useMemo(() => marked.map((i) => i.key).join('|'), [marked]);
  const [scan, setScan] = useState(1);
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setScan((n) => n + 1);
  }, [signature]);

  // A text edit that touched a locked path was put back: show the reality again once the learner has read why.
  const ignoredKey = text.ignored.join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart the timer only when the ignored set changes
  useEffect(() => {
    if (!ignoredKey) return;
    const t = window.setTimeout(() => ui.session.revertText(), 2200);
    return () => window.clearTimeout(t);
  }, [ignoredKey]);

  const label = `JSON of ${spec.name || 'the app'}`;
  const canFormat = !text.error && text.custom && !snap.readOnly;

  const copy = async () => {
    const ok = await copyText(text.text);
    toast(ok ? 'JSON copied' : 'Could not copy. Select the text and copy it by hand.', {
      kind: ok ? 'success' : 'warn',
    });
  };
  const download = () => {
    const safe = (spec.name || 'spec').replace(/[^a-zA-Z0-9._-]+/g, '-');
    downloadText(`${safe}.json`, `${text.text.trimEnd()}\n`);
  };

  const state = text.error ? 'error' : text.custom ? 'custom' : 'ok';

  return (
    <div className={styles.editor} style={{ minBlockSize: 0 }}>
      <div className={styles.head}>
        <span className={styles.state} data-state={state} style={{ marginInlineEnd: 'auto' }}>
          <Glyph
            name={state === 'error' ? 'status-crit' : state === 'custom' ? 'edit' : 'status-ok'}
            size={13}
          />
          {text.error
            ? `Line ${text.error.line + 1}, column ${text.error.column + 1}`
            : text.custom
              ? 'Your layout'
              : 'Valid JSON'}
        </span>
        <IconButton
          icon="sort"
          label="Format the JSON"
          size="sm"
          variant="ghost"
          disabled={!canFormat}
          onClick={() => ui.session.revertText()}
        />
        <IconButton icon="copy" label="Copy the JSON" size="sm" variant="ghost" onClick={copy} />
        <IconButton icon="download" label="Download the JSON" size="sm" variant="ghost" onClick={download} />
      </div>

      {text.error ? (
        <div className={styles.banner} id={errorId} data-kind="error">
          <p>
            <strong>
              Line {text.error.line + 1}, column {text.error.column + 1}: {text.error.message}
            </strong>
            {text.error.hint ? ` ${text.error.hint}` : ''}
          </p>
          <p>The form and the price still show the last version that was valid.</p>
          <div className={styles.bannerRow}>
            <button
              type="button"
              className={controls.addBtn}
              onClick={() => editorRef.current?.revealLine(text.error?.line ?? 0)}
            >
              <Glyph name="arrow-right" size={14} />
              Go to the line
            </button>
            <button type="button" className={controls.addBtn} onClick={() => ui.session.revertText()}>
              <Glyph name="undo" size={14} />
              Discard my edit
            </button>
          </div>
        </div>
      ) : null}

      {text.ignored.length > 0 ? (
        <div className={styles.banner} data-kind="locked" role="status">
          <p>
            <strong>Put back: {text.ignored.slice(0, 3).join(', ')}</strong>
            {text.ignored.length > 3 ? ` and ${text.ignored.length - 3} more` : ''}. This step keeps those
            fixed, so the rest of your change was kept.
          </p>
        </div>
      ) : null}

      {!text.error && text.notes.length > 0 ? (
        <div className={styles.banner} data-kind="note">
          <p>
            <strong>Read with these changes</strong>
          </p>
          {text.notes.slice(0, 3).map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      ) : null}

      <div ref={stage} style={{ position: 'relative', flex: '1 1 auto', minBlockSize: 0, display: 'flex' }}>
        <div style={{ flex: '1 1 auto', minInlineSize: 0, position: 'relative', display: 'flex' }}>
          <JsonEditor
            ref={editorRef}
            text={text.text}
            tree={text.tree}
            error={text.error}
            issues={marked}
            notes={noteMarkers}
            readOnly={snap.readOnly}
            label={label}
            describedBy={text.error ? errorId : undefined}
            onChange={(v) => ui.session.setText(v)}
            onUndo={() => ui.session.undo()}
            onRedo={() => ui.session.redo()}
            canApply={(i) => ui.canEdit(i.at)}
            onApplySuggestion={(i) =>
              ui.edit(i.at, (s) => applySuggestion(s, i), {
                key: null,
                label: 'Apply suggestion',
                origin: 'suggestion',
              })
            }
          />
          <span key={scan} className={styles.scan} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
