/**
 * Callouts are marginalia: a short note beside the main text with its own glyph, word and tint (the
 * design system's `Callout`). The tint is never the only signal: each kind has a glyph and a label.
 */

import { MarkupText } from '@/learn/MarkupText';
import type { Callout as CalloutData } from '@/learn/types';
import { Callout } from '@/ui';
import styles from './Callouts.module.css';

export function Callouts({ callouts }: { callouts: readonly CalloutData[] }) {
  if (callouts.length === 0) return null;
  return (
    <div className={styles.notes}>
      {callouts.map((c, i) => (
        <Callout
          // biome-ignore lint/suspicious/noArrayIndexKey: callouts are a static ordered list
          key={i}
          kind={c.kind}
          title={c.title ? <MarkupText text={c.title} plain /> : undefined}
          compact
          style={{ ['--i' as string]: i }}
        >
          <MarkupText text={c.body} />
        </Callout>
      ))}
    </div>
  );
}
