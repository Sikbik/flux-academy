import { LABS, type LabMeta } from '@shared/curriculum';
import { type CSSProperties, useId } from 'react';
import { Link } from 'react-router';
import { ART, type ArtId, labArt } from '@/content/art';
import { useNetworkSelect, useSectionAge } from '@/data';
import { freshnessKind } from '@/data/chips';
import { formatInt } from '@/lib/format';
import { Chip, FreshnessChip, Glyph, Panel } from '@/ui';
import { LAB_TAGS, labsCopy, SIMULATION_TAG } from './copy';
import styles from './labs.module.css';
import { asOfLine, bentoCells } from './logic';
import { SectionHead } from './SectionHead';
import section from './section.module.css';

function LabArt({ id }: { id: ArtId }) {
  const a = ART[id];
  const style = { '--cx': (a.box[0] + a.box[2]) / 2, '--cy': (a.box[1] + a.box[3]) / 2 } as CSSProperties;
  return (
    <span className={styles.art} style={style} aria-hidden="true">
      <picture>
        {a.avif ? <source srcSet={a.avif} type="image/avif" /> : null}
        <img
          src={a.src}
          alt=""
          width={a.width}
          height={a.height}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </picture>
    </span>
  );
}

/** The one real number the network card can show without being asked. */
function NetworkPreview() {
  const nodes = useNetworkSelect((n) => n.nodes.total);
  const countries = useNetworkSelect((n) => n.nodes.countries);
  const sec = useSectionAge('nodes');
  const asOf = asOfLine(sec.status, sec.asOf);
  if (nodes === null) return null;
  return (
    <span className={styles.preview}>
      <span className={styles.previewNum}>{formatInt(nodes)}</span>
      <span className={styles.previewText}>
        nodes{countries ? `, ${formatInt(countries)} countries` : ''}
        {asOf ? <span className={styles.asOf}>{asOf}</span> : null}
      </span>
      <FreshnessChip kind={freshnessKind(sec.status)} ageMs={sec.ageMs} hideAge={sec.status === 'fallback'} />
    </span>
  );
}

/** `wide` is a two cell card (picture beside the words); `flip` puts its picture on the right. */
function LabCard({ lab, wide, flip }: { lab: LabMeta; wide: boolean; flip: boolean }) {
  const uid = useId();
  const art = labArt(lab.id);
  const tags = LAB_TAGS[lab.id] ?? [];
  return (
    <li
      className={styles.item}
      data-wide={wide ? 'true' : undefined}
      data-flip={wide && flip ? 'true' : undefined}
      data-lab={lab.id}
    >
      <Panel
        as={Link}
        to={`/labs/${lab.id}`}
        interactive
        tilt={wide ? 2.5 : 4}
        container
        padding="lg"
        pattern={wide ? (flip ? 'br' : 'tl') : 'br'}
        variant="glass"
        className={styles.card}
        contentClassName={styles.inner}
        aria-labelledby={`${uid}-name`}
        aria-describedby={`${uid}-desc`}
      >
        {art ? <LabArt id={art} /> : null}
        <span className={styles.body}>
          <span id={`${uid}-name`} className={styles.name}>
            {lab.title}
          </span>
          <span id={`${uid}-desc`} className={styles.summary}>
            {lab.summary}
          </span>
          {lab.id === 'network' ? <NetworkPreview /> : null}
          <span className={styles.foot}>
            <span className={styles.tags}>
              {tags.map((t) => (
                <Chip key={t} kind="label" size="sm" tone={t === SIMULATION_TAG ? 'neutral' : 'accent'}>
                  {t}
                </Chip>
              ))}
            </span>
            <span className={styles.cta}>
              {lab.cta}
              <Glyph name="arrow-right" size={16} />
            </span>
          </span>
        </span>
      </Panel>
    </li>
  );
}

/**
 * The labs, each a doorway to a tool that works on its own. The first and the last are wide (see `bentoCells`
 * and labs.module.css): the Spec Forge, the lab the most lessons use, and the lab that was added last.
 */
export function Labs() {
  const copy = labsCopy(LABS);
  const cells = bentoCells(LABS.length);
  return (
    <section id="labs" className={section.section} data-scene="labs" aria-labelledby="labs-title">
      <div className={section.inner}>
        <SectionHead id="labs-title" number="04" label="The labs" title={copy.title} lead={copy.lead} />
        <ul className={styles.bento} aria-label={copy.listLabel}>
          {LABS.map((lab, i) => (
            <LabCard key={lab.id} lab={lab} wide={cells[i]?.wide ?? false} flip={cells[i]?.flip ?? false} />
          ))}
        </ul>
      </div>
    </section>
  );
}
