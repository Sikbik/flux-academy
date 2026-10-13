/**
 * The verbs, right under the bench: take a node down, take a whole region down, bring everything back,
 * send one request. They are plain buttons, so everything the bench can be clicked to do is also done
 * from the keyboard (and from the instance list below).
 */
import type { Region } from '@/diorama/model';
import { Button, Select } from '@/ui';
import styles from './VerbsBar.module.css';

export interface VerbsBarProps {
  breakOptions: ReadonlyArray<{ value: Region; label: string }>;
  breakRegion: Region;
  onBreakRegion: (r: Region) => void;
  hasInstances: boolean;
  anyDown: boolean;
  onBreakNode: () => void;
  onBreakRegionNow: () => void;
  onReviveAll: () => void;
  onSend: () => void;
}

export function VerbsBar(p: VerbsBarProps) {
  return (
    <fieldset className={styles.root}>
      <legend className="sr-only">Break and repair</legend>
      <Button icon="node-off" variant="danger" onClick={p.onBreakNode} disabled={!p.hasInstances}>
        Break a node
      </Button>
      <div className={styles.region}>
        <Select
          label="Region to break"
          options={p.breakOptions}
          value={p.breakRegion}
          onValueChange={(v) => p.onBreakRegion(v as Region)}
        />
        <Button icon="region" variant="danger" onClick={p.onBreakRegionNow} disabled={!p.hasInstances}>
          Break region
        </Button>
      </div>
      <Button icon="node" onClick={p.onReviveAll} disabled={!p.anyDown}>
        Revive all
      </Button>
      <Button icon="packet" variant="secondary" onClick={p.onSend} disabled={!p.hasInstances}>
        Send a request
      </Button>
    </fieldset>
  );
}
