/**
 * "The call behind this": the two public requests the lookup is built from, with their exact URLs and a
 * copy button each, so a learner can repeat them in a terminal or a browser. The Academy's server makes
 * them on the learner's behalf (and trims node ports and encrypted contents from what it passes on); the
 * URLs here are the real, public ones.
 */
import { useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { toast } from '@/system/toasts';
import { Button, Glyph } from '@/ui';
import styles from './CallCard.module.css';
import { publicCalls } from './model';

export interface CallCardProps {
  name: string;
  docs?: { specUrl: string; locationUrl: string };
  /** The made-up sample: the URLs show the shape of the calls, they would not find an app. */
  sample: boolean;
}

export function CallCard({ name, docs, sample }: CallCardProps) {
  const calls = publicCalls(name, docs);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (id: string, text: string, what: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(id);
      toast.success(`${what} copied`, { key: 'explorer-copy' });
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    } else {
      toast('Copying was blocked. Select the text and copy it by hand.', { kind: 'warn' });
    }
  };

  return (
    <section className={styles.root} aria-labelledby="explorer-call">
      <div className={styles.head}>
        <Glyph name="external" size={16} />
        <h3 id="explorer-call" className={styles.title}>
          The call behind this
        </h3>
      </div>
      <p className={styles.lead}>
        This page got its answer from two plain public GET requests to the Flux API, which the Academy's
        server made for you. You can ask them yourself, with no account and no key.
        {sample ? ' This is the sample app, so these show the shape of the calls and would not find it.' : ''}
      </p>
      <ol className={styles.calls}>
        {calls.map((c, i) => (
          <li key={c.id} className={styles.call}>
            <div className={styles.callHead}>
              <span className={styles.num} aria-hidden="true">
                {i + 1}
              </span>
              <h4 className={styles.callTitle}>{c.title}</h4>
              <span className={styles.verb}>GET</span>
            </div>
            <code className={styles.url}>{c.url}</code>
            <p className={styles.returns}>{c.returns}</p>
            <div className={styles.actions}>
              <Button
                size="sm"
                variant="secondary"
                icon={copied === `${c.id}-url` ? 'check' : 'copy'}
                onClick={() => copy(`${c.id}-url`, c.url, 'URL')}
              >
                {copied === `${c.id}-url` ? 'Copied' : 'Copy URL'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={copied === `${c.id}-curl` ? 'check' : 'terminal'}
                onClick={() => copy(`${c.id}-curl`, c.curl, 'curl command')}
              >
                {copied === `${c.id}-curl` ? 'Copied' : 'Copy as curl'}
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
