import { useDataAge, useGeo } from '@/data';
import { freshnessKind } from '@/data/chips';
import { useSceneBus } from '@/scenes/bus';
import { Chip, FreshnessChip } from '@/ui';
import { HERO } from './copy';
import styles from './hero.module.css';

/** Which locations the bench is lit with: real ones (live or cached geo data) or the built-in sample. */
function LocationsChip() {
  const dataMode = useSceneBus((s) => s.scene.dataMode);
  const geo = useGeo();
  const age = useDataAge('geo');
  if (dataMode === 'live') {
    return <FreshnessChip kind={freshnessKind(geo.status) === 'live' ? 'live' : 'cached'} ageMs={age} />;
  }
  return (
    <Chip kind="status" status="off" size="sm">
      Sample map
    </Chip>
  );
}

/**
 * What the hero scene is, said once under it: a simulation of an app placed on the network, lit with real
 * locations when the live data is there. The scene is a picture here, not a control; the instance slider
 * and the break button live in the Failover Lab, where there is room to explain them.
 */
export function StageCaption() {
  const dataMode = useSceneBus((s) => s.scene.dataMode);
  return (
    <p className={styles.caption}>
      {dataMode === 'live' ? HERO.caption : HERO.captionSample}
      <span className={styles.captionChips}>
        <FreshnessChip kind="simulation" />
        <LocationsChip />
      </span>
    </p>
  );
}
