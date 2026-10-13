/**
 * The set-up: how many instances, where they may run, how much traffic. The allowed regions are written
 * the way a Flux spec writes them (`acEU`), so the grammar of the `geolocation` field is the thing the
 * learner sees change as they click.
 */
import { REGION_NAMES, REGIONS, type Region } from '@/diorama/model';
import { Button, Chip, Slider } from '@/ui';
import styles from './ConfigPanel.module.css';
import { geolocationOf, MAX_INSTANCES, MAX_RATE, MIN_INSTANCES } from './scenarios';

export interface ConfigPanelProps {
  count: number;
  onCount: (n: number) => void;
  onCountCommit: (n: number) => void;
  regions: readonly Region[];
  onToggleRegion: (r: Region) => void;
  rate: number;
  onRate: (n: number) => void;
  onReshuffle: () => void;
  onStartOver: () => void;
}

export function ConfigPanel(p: ConfigPanelProps) {
  const geo = geolocationOf(p.regions);
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Set-up</h2>

      <Slider
        label="Instances"
        min={MIN_INSTANCES}
        max={MAX_INSTANCES}
        step={1}
        value={p.count}
        onValueChange={p.onCount}
        onValueCommit={p.onCountCommit}
        marks
        format={(n) => `${n} ${n === 1 ? 'instance' : 'instances'}`}
      />

      <fieldset className={styles.regions}>
        <legend className={styles.legend}>Where instances may run</legend>
        <div className={styles.chips}>
          {REGIONS.map((r) => (
            <Chip
              key={r}
              kind="filter"
              size="sm"
              selected={p.regions.includes(r)}
              onClick={() => p.onToggleRegion(r)}
            >
              {REGION_NAMES[r]}
            </Chip>
          ))}
        </div>
        <p className={styles.geo}>
          <code>geolocation: {JSON.stringify(geo)}</code>
          <span>{geo.length === 0 ? 'Anywhere on the network.' : 'Only these continents.'}</span>
        </p>
      </fieldset>

      <Slider
        label="Requests"
        min={0}
        max={MAX_RATE}
        step={1}
        value={p.rate}
        onValueChange={p.onRate}
        format={(n) => (n === 0 ? 'None' : `${n} per second`)}
      />

      <div className={styles.row}>
        <Button icon="refresh" variant="secondary" size="sm" onClick={p.onReshuffle}>
          Reshuffle
        </Button>
        <Button icon="reset" variant="ghost" size="sm" onClick={p.onStartOver}>
          Start over
        </Button>
      </div>
    </div>
  );
}
