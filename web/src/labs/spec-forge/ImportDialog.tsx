import { useId, useRef, useState } from 'react';
import { Button, Dialog, TextArea } from '@/ui';
import { type ImportSource, readImport } from './importing';
import styles from './lab.module.css';

const MAX_FILE = 1_000_000;

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the value that was read. The dialog closes itself afterwards. */
  onImport: (value: Record<string, unknown>, source: ImportSource) => void;
}

/** Paste a spec or a share link, or choose a file. Reading is forgiving; the error says what to do. */
export function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const fileId = useId();

  const attempt = async (source: string) => {
    setBusy(true);
    try {
      const result = await readImport(source);
      if (!result.ok) {
        const where = result.line ? `Line ${result.line}, column ${result.column}: ` : '';
        setProblem(`${where}${result.message}${result.hint ? ` ${result.hint}` : ''}`);
        return;
      }
      setProblem(null);
      onImport(result.value, result.source);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE) {
      setProblem('That file is far bigger than any Flux spec.');
      return;
    }
    const content = await f.text();
    setText(content);
    await attempt(content);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={() => {
        setText('');
        setProblem(null);
        setOver(false);
      }}
      title="Import a spec"
      description="Paste a spec as JSON, or a share link. It is read in your browser and nothing is sent anywhere."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" icon="upload" onClick={() => file.current?.click()}>
            Choose a file
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={text.trim() === ''}
            onClick={() => void attempt(text)}
          >
            Import
          </Button>
        </>
      }
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a file drop target; Choose a file is the keyboard way */}
      <div
        className={`${styles.importBody} ${styles.drop}`}
        data-over={over ? 'true' : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void readFile(e.dataTransfer.files[0]);
        }}
      >
        <TextArea
          label="Spec JSON or share link"
          mono
          rows={10}
          value={text}
          onValueChange={(v) => {
            setText(v);
            if (problem) setProblem(null);
          }}
          error={problem}
          hint="You can also drop a .json file here."
          spellCheck={false}
          placeholder={'{\n  "version": 8,\n  "name": "my-app",\n  ...\n}'}
          data-autofocus=""
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && text.trim()) {
              e.preventDefault();
              void attempt(text);
            }
          }}
        />
        <input
          ref={file}
          id={fileId}
          className={styles.hiddenFile}
          type="file"
          accept=".json,application/json,text/plain"
          tabIndex={-1}
          aria-label="Choose a JSON file"
          onChange={(e) => {
            void readFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </Dialog>
  );
}
