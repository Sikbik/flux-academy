import { type ComponentType, useEffect, useMemo, useState } from 'react';
import styles from './kit.module.css';
import { Group, type KitSectionMeta } from './parts';

/**
 * The design-system gallery: every token and primitive in every state on one page. Sections
 * are files in `./sections/*.tsx`, found by glob (add a file to add a section). Each exports
 * `meta: KitSectionMeta` and a default component.
 *
 * Standalone: `vite` then open `/kit.html`. In the app it mounts at `/kit` (development).
 * Query: `?only=<id>` shows one section, `?accent=` and `?motion=` set the page state.
 */

interface SectionModule {
  meta: KitSectionMeta;
  default: ComponentType;
}

const modules = import.meta.glob<SectionModule>('./sections/*.tsx', { eager: true });

const SECTIONS = Object.values(modules)
  .filter((m) => m.meta && m.default)
  .sort((a, b) => a.meta.order - b.meta.order);

const ACCENTS = [
  ['flux', '#2b61d1'],
  ['cumulus', '#36d3ff'],
  ['nimbus', '#c77dff'],
  ['stratus', '#ffc857'],
] as const;

function readOnly(): string | null {
  return new URLSearchParams(window.location.search).get('only');
}

export default function Kit() {
  const [accent, setAccent] = useState(() => document.documentElement.dataset.accent ?? 'flux');
  // Like the shell: an explicit attribute wins, otherwise the OS preference decides.
  const [motion, setMotion] = useState<'full' | 'reduced'>(() => {
    const set = document.documentElement.dataset.motion;
    if (set === 'reduced' || set === 'full') return set;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
  });
  const only = useMemo(readOnly, []);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);

  useEffect(() => {
    document.title = 'Kit | Flux Academy';
  }, []);

  const shown = only ? SECTIONS.filter((s) => s.meta.id === only) : SECTIONS;

  return (
    <div className={styles.kit}>
      <header className={styles.bar}>
        <div className={`container ${styles.barInner}`} data-size="wide">
          <span className={styles.brand}>
            Flux Academy <small>design system</small>
          </span>
          <div className={styles.toggles}>
            <fieldset className={styles.swatches}>
              <legend className="sr-only">Accent</legend>
              {ACCENTS.map(([name, hex]) => (
                <button
                  key={name}
                  type="button"
                  className={styles.swatch}
                  style={{ '--sw': hex } as React.CSSProperties}
                  aria-pressed={accent === name}
                  aria-label={`Accent ${name}`}
                  onClick={() => setAccent(name)}
                />
              ))}
            </fieldset>
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={motion === 'reduced'}
              onClick={() => setMotion((m) => (m === 'reduced' ? 'full' : 'reduced'))}
            >
              Reduce motion
            </button>
          </div>
          <nav aria-label="Kit sections">
            <ul className={styles.jump}>
              {SECTIONS.map(({ meta }) => (
                <li key={meta.id}>
                  <a href={`#${meta.id}`}>{meta.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="container" data-size="wide">
        {shown.length === 0 ? (
          <Group id="empty" title={only ? `No section called ${only}` : 'No sections yet'}>
            <p>
              {only
                ? `Known ids: ${SECTIONS.map((s) => s.meta.id).join(', ')}.`
                : 'Add a file to src/ui/kit/sections.'}
            </p>
          </Group>
        ) : (
          shown.map(({ meta, default: Section }) => <Section key={meta.id} />)
        )}
      </main>
    </div>
  );
}
