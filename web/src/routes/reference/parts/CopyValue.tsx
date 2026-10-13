import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { announce } from '@/system/announce';
import { Glyph } from '@/ui';
import styles from './parts.module.css';

const FEEDBACK_MS = 1600;

/** A small button that copies a value (a URL, a command) and says so. */
export function CopyValue({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onClick = async () => {
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'failed');
    announce(ok ? 'Copied to clipboard' : 'Copy failed. Select the text and copy it by hand.');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), FEEDBACK_MS);
  };
  return (
    <button
      type="button"
      className={styles.copyValue}
      data-state={state}
      aria-label={label}
      onClick={onClick}
    >
      <Glyph name={state === 'copied' ? 'check' : 'copy'} size={15} />
      <span aria-hidden="true">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Failed' : 'Copy'}</span>
    </button>
  );
}
