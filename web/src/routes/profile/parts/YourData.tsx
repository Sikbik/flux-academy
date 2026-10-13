import { useId, useRef, useState } from 'react';
import { downloadBlob } from '@/learn/certificate';
import { type LearnerState, useLearner } from '@/learn/store';
import { announce } from '@/system/announce';
import { toast } from '@/system/toasts';
import { Button, Dialog, Glyph, Panel, TextField } from '@/ui';
import {
  exportFileName,
  exportText,
  type ImportResult,
  readImport,
  type StateSummary,
  summariseState,
} from '../dataTransfer';
import styles from './YourData.module.css';

const CONFIRM_WORD = 'reset';

function Summary({ s }: { s: StateSummary }) {
  return (
    <dl className={styles.summary}>
      <div>
        <dt>Lessons finished</dt>
        <dd>
          {s.lessonsDone} of {s.lessonsTotal}
        </dd>
      </div>
      <div>
        <dt>XP</dt>
        <dd>{s.xp.toLocaleString('en-US')}</dd>
      </div>
      <div>
        <dt>Medals</dt>
        <dd>
          {s.medals} of {s.medalsTotal}
        </dd>
      </div>
      <div>
        <dt>Active days</dt>
        <dd>{s.activeDays}</dd>
      </div>
    </dl>
  );
}

function pickState(): LearnerState {
  const s = useLearner.getState();
  return {
    schema: s.schema,
    lessons: s.lessons,
    xp: s.xp,
    achievements: s.achievements,
    activeDays: s.activeDays,
    name: s.name,
  };
}

/**
 * Your data: export a copy, import one (with a confirmation that shows what will be replaced), or start
 * over (behind a typed confirmation). Everything is in this browser; nothing here talks to a server.
 */
export function YourData() {
  const uid = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const importState = useLearner((s) => s.importState);
  const resetState = useLearner((s) => s.reset);

  const [pending, setPending] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const exportNow = () => {
    const now = new Date();
    const text = exportText(pickState(), now);
    downloadBlob(new Blob([text], { type: 'application/json' }), exportFileName(now));
    toast.success('Progress file saved');
    announce('Progress file saved to your downloads.');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const result = readImport(text, file.size);
      if (result.ok) {
        setPending(result);
      } else {
        setImportError(result.reason);
        announce(result.reason);
      }
    } catch {
      const reason = 'That file could not be read. Try choosing it again.';
      setImportError(reason);
      announce(reason);
    } finally {
      // Allow choosing the same file again.
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    const ok = importState(pending.state);
    setPending(null);
    if (ok) {
      toast.success('Progress imported');
      announce('Progress imported. Your rank, medals and lessons now match the file.');
    } else {
      setImportError('That file could not be imported.');
    }
  };

  const confirmReset = () => {
    resetState();
    setResetOpen(false);
    setTyped('');
    toast.success('Progress reset on this device');
    announce('Progress reset on this device.');
  };

  const current = summariseState(pickState());
  const canReset = typed.trim().toLowerCase() === CONFIRM_WORD;

  return (
    <Panel
      variant="slab"
      size="md"
      padding="lg"
      pattern="tr"
      className={styles.panel}
      contentClassName={styles.body}
    >
      <p className={styles.promise}>
        <Glyph name="shield" size={18} />
        <span>
          Your progress lives in this browser only. There is no account and nothing is sent to a server, so
          nobody can recover it for you: export a copy if you want to keep it or move it to another device.
        </span>
      </p>

      <div className={styles.action}>
        <div className={styles.actionText}>
          <h3 className={styles.actionTitle}>Export</h3>
          <p className={styles.actionNote}>
            Saves a small JSON file with your lessons, XP, medals, active days and name.
          </p>
        </div>
        <Button variant="secondary" icon="download" onClick={exportNow}>
          Export progress
        </Button>
      </div>

      <div className={styles.action}>
        <div className={styles.actionText}>
          <h3 className={styles.actionTitle}>Import</h3>
          <p className={styles.actionNote}>
            Choose a file exported from this page. You see what it holds before anything is replaced.
          </p>
          {importError ? (
            <p className={styles.error} role="alert">
              <Glyph name="warning" size={15} />
              <span>{importError}</span>
            </p>
          ) : null}
        </div>
        <Button variant="secondary" icon="upload" onClick={() => fileInput.current?.click()}>
          Import from file
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
          }}
        />
      </div>

      <div className={styles.action}>
        <div className={styles.actionText}>
          <h3 className={styles.actionTitle}>Start over</h3>
          <p className={styles.actionNote}>
            Erases lessons, XP, medals, active days and your name on this device. Your preferences stay.
          </p>
        </div>
        <Button variant="danger" icon="trash" onClick={() => setResetOpen(true)}>
          Reset progress
        </Button>
      </div>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Replace your progress with this file?"
        description="The file replaces what is saved in this browser. Export first if you want to keep a copy of the current progress."
        size="md"
        role="alertdialog"
        dismissOnScrim={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} data-autofocus>
              Keep what I have
            </Button>
            <Button variant="primary" onClick={confirmImport}>
              Replace with this file
            </Button>
          </>
        }
      >
        {pending ? (
          <div className={styles.compare}>
            <div>
              <h4 className={styles.compareTitle}>In the file</h4>
              <Summary s={pending.summary} />
            </div>
            <div>
              <h4 className={styles.compareTitle}>Saved now</h4>
              <Summary s={current} />
            </div>
            {pending.dropped > 0 ? (
              <p className={styles.dropped}>
                {pending.dropped} {pending.dropped === 1 ? 'entry' : 'entries'} in the file are not part of
                this version of the Academy and will be left out.
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setTyped('');
        }}
        title="Reset all progress?"
        description={`This erases ${current.lessonsDone} finished ${current.lessonsDone === 1 ? 'lesson' : 'lessons'}, ${current.xp.toLocaleString('en-US')} XP and ${current.medals} ${current.medals === 1 ? 'medal' : 'medals'} from this browser. It cannot be undone, and there is no copy anywhere else.`}
        size="sm"
        role="alertdialog"
        tone="crit"
        dismissOnScrim={false}
        footer={
          <>
            <Button
              variant="ghost"
              data-autofocus
              onClick={() => {
                setResetOpen(false);
                setTyped('');
              }}
            >
              Keep my progress
            </Button>
            <Button
              variant="danger"
              aria-disabled={canReset ? undefined : true}
              onClick={() => canReset && confirmReset()}
            >
              Erase everything
            </Button>
          </>
        }
      >
        <TextField
          label={`Type ${CONFIRM_WORD} to confirm`}
          hint="Export a copy first if you might want it back."
          value={typed}
          onValueChange={setTyped}
          autoComplete="off"
          spellCheck={false}
          id={`${uid}-confirm`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canReset) confirmReset();
          }}
        />
      </Dialog>
    </Panel>
  );
}
