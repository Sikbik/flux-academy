/**
 * The `compare` stage: two panels side by side for before and after, good and bad, or option A and B.
 * Tone is always paired with a word and a glyph (never colour alone). Owner: the lesson engine.
 */

import type { CodeLang } from '@/ui';
import { Glyph, type GlyphName } from '@/ui';
import { MarkupText } from '../MarkupText';
import { CodeView } from '../parts/CodeView';
import type { StageComponentProps } from '../stage-api';
import type { CompareStage } from '../types';
import styles from './compare.module.css';

type Side = CompareStage['left'];

const TONE: Record<NonNullable<Side['tone']>, { word: string; glyph: GlyphName }> = {
  good: { word: 'Works', glyph: 'status-ok' },
  bad: { word: 'Avoid', glyph: 'status-crit' },
  neutral: { word: 'Option', glyph: 'status-off' },
};

const LANGS = new Set(['dockerfile', 'json', 'js', 'ts', 'yaml', 'sh', 'text']);

function asLang(lang: string | undefined): CodeLang {
  return lang && LANGS.has(lang) ? (lang as CodeLang) : 'text';
}

function Panel({ side, name }: { side: Side; name: string }) {
  const tone = side.tone ?? 'neutral';
  const t = TONE[tone];
  return (
    <section className={styles.panel} data-tone={tone} aria-label={`${name} option`}>
      <header className={styles.head}>
        <span className={styles.badge}>
          <Glyph name={t.glyph} size={14} />
          {t.word}
        </span>
        <h3 className={styles.label}>
          <MarkupText text={side.label} plain />
        </h3>
      </header>
      {side.code ? (
        <CodeView
          bare
          wrap
          className={styles.code}
          label={`${name} code`}
          files={[{ name: 'snippet', lang: asLang(side.lang), code: side.code }]}
        />
      ) : null}
      {side.body ? (
        <p className={styles.body}>
          <MarkupText text={side.body} />
        </p>
      ) : null}
    </section>
  );
}

export default function CompareStageView({ stage }: StageComponentProps<CompareStage>) {
  return (
    <div className={styles.compare}>
      <div className={styles.grid}>
        <Panel side={stage.left} name="First" />
        <Panel side={stage.right} name="Second" />
      </div>
    </div>
  );
}
