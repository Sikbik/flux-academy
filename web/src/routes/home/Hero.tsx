import { LESSONS, TRACKS } from '@shared/curriculum';
import { useNetwork } from '@/data';
import { formatInt } from '@/lib/format';
import { useSceneBus } from '@/scenes/bus';
import { Glyph, Odometer, Skeleton } from '@/ui';
import { AppLinkButton } from './AppLinkButton';
import { HERO } from './copy';
import styles from './hero.module.css';
import { LiteBench } from './LiteBench';
import { LiveStrip } from './LiveStrip';
import { approxDuration, totalMinutes } from './logic';
import { PrimaryAction } from './PrimaryAction';
import { StageCaption } from './StageCaption';
import { StageFigure } from './StageFigure';
import type { StageMode } from './useStageMode';

/**
 * The live node count in the headline: an odometer in 700 weight with the accent gradient. A number in a
 * headline has no freshness chip beside it, so it is shown only while the data is live or cached; a baked
 * sample or an offline snapshot says "thousands of" instead (the strip below carries the dated figure).
 */
function NodeCount({ armed }: { armed: boolean }) {
  const { data, status } = useNetwork();
  const total = data?.nodes.total ?? null;
  if (total === null) {
    return (
      <span className={styles.count} aria-hidden="true">
        <Skeleton shape="block" width="2.7em" height="0.74em" />
      </span>
    );
  }
  if (status !== 'live' && status !== 'cache') {
    return <span className={styles.light}>thousands of</span>;
  }
  return (
    <span className={styles.count}>
      {armed ? (
        <Odometer value={total} from={0} gradient duration={900} />
      ) : (
        <span className={styles.countStatic}>{formatInt(total)}</span>
      )}
    </span>
  );
}

function Actions() {
  return (
    <div className={styles.actions}>
      <PrimaryAction size="lg" />
      <AppLinkButton href="/labs/spec-forge" variant="secondary" size="lg">
        Open the Spec Forge
      </AppLinkButton>
    </div>
  );
}

/**
 * The first screen: what this is, the network's pulse and two clear paths. The scene sits behind this
 * layer (see StageHost); the right-hand frame is the free area it is framed in, a picture of an app placed
 * on the network with a caption under it. Copy and buttons are in the DOM and painted from the first
 * frame: the entrance only softens and resolves them.
 */
export function Hero({ mode, introDelay }: { mode: StageMode; introDelay: boolean }) {
  const armed = useSceneBus((s) => s.scene.ready) || mode === 'lite' || !introDelay;
  const minutes = totalMinutes();
  const summary = `${LESSONS.length} lessons, ${TRACKS.length} tracks, ${approxDuration(minutes)}`;

  return (
    <section
      id="top"
      className={styles.hero}
      data-scene="hero"
      data-intro={introDelay ? 'true' : undefined}
      aria-labelledby="home-title"
    >
      <div className={styles.grid}>
        <div className={styles.copy}>
          <p className={styles.eyebrow} style={{ '--i': 0 } as React.CSSProperties}>
            <span className={styles.bullet} aria-hidden="true" />
            <span className={styles.eyebrowLong}>{HERO.eyebrow}</span>
            <span className={styles.eyebrowShort}>{HERO.eyebrowShort}</span>
          </p>
          <h1 id="home-title" className={styles.title} style={{ '--i': 1 } as React.CSSProperties}>
            <span className={styles.light}>Learn to deploy on a network of</span> <NodeCount armed={armed} />{' '}
            <span className={styles.light}>independent machines.</span>
          </h1>
          <p className={styles.sub} style={{ '--i': 3 } as React.CSSProperties}>
            {HERO.subhead}
          </p>
          <div className={styles.rise} style={{ '--i': 4 } as React.CSSProperties}>
            <Actions />
          </div>
          <p className={styles.hint} style={{ '--i': 5 } as React.CSSProperties}>
            <Glyph name="layers" size={14} />
            <span>{summary}. No sign-up.</span>
          </p>
        </div>

        <figure
          className={styles.stage}
          data-frame="hero"
          aria-label="A simulated bench: three copies of an app placed on the network"
        >
          {mode === 'lite' ? <LiteBench /> : null}
          <StageFigure />
        </figure>

        <div className={styles.captionBox}>
          <StageCaption />
        </div>

        <div className={styles.strip}>
          <LiveStrip />
        </div>
      </div>
    </section>
  );
}
