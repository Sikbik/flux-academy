/**
 * Your instances as a list: where each one runs, whether its node is up and what the load balancer
 * currently believes about it. This is also the keyboard and screen reader way to take a node down or
 * bring it back, so nothing that can be done by clicking a pillar on the bench needs a pointer.
 */
import { Button, Chip } from '@/ui';
import styles from './InstanceList.module.css';
import type { InstanceView, OfflineView, View } from './view';

export interface InstanceListProps {
  view: View;
  onBreak: (nodeId: string) => void;
  onRevive: (nodeId: string) => void;
}

function Row({
  i,
  onBreak,
  onRevive,
}: {
  i: InstanceView;
  onBreak: (nodeId: string) => void;
  onRevive: (nodeId: string) => void;
}) {
  return (
    <li className={styles.row} data-tone={i.tone}>
      <span className={styles.slot} aria-hidden="true">
        {i.slot + 1}
      </span>
      <div className={styles.where}>
        <span className={styles.name}>
          Instance {i.slot + 1}
          {i.placed ? (
            <>
              {' on '}
              <code>{i.ip}</code>
            </>
          ) : null}
        </span>
        <span className={styles.place}>{i.placed ? i.place : 'No eligible node'}</span>
      </div>
      <div className={styles.state}>
        {i.tier ? (
          <Chip tier={i.tier} size="sm">
            {i.tier}
          </Chip>
        ) : null}
        <Chip kind="status" status={i.tone} size="sm">
          {i.word}
        </Chip>
      </div>
      <div className={styles.act}>
        {i.placed ? (
          i.up ? (
            <Button
              size="sm"
              variant="ghost"
              icon="node-off"
              onClick={() => onBreak(i.nodeId)}
              aria-label={`Break the node of instance ${i.slot + 1}`}
            >
              Break
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              icon="node"
              onClick={() => onRevive(i.nodeId)}
              aria-label={`Revive the node of instance ${i.slot + 1}`}
            >
              Revive
            </Button>
          )
        ) : null}
      </div>
      <p className={styles.hint}>{i.hint}</p>
    </li>
  );
}

function OfflineRow({ o, onRevive }: { o: OfflineView; onRevive: (nodeId: string) => void }) {
  return (
    <li className={styles.offline}>
      <span>
        <code>{o.ip}</code> <span className={styles.place}>{o.place}</span>
      </span>
      <Button size="sm" variant="ghost" icon="node" onClick={() => onRevive(o.nodeId)}>
        Revive
      </Button>
    </li>
  );
}

export function InstanceList({ view, onBreak, onRevive }: InstanceListProps) {
  const spare = view.offline.filter((o) => !o.holdsInstance);
  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h2 className={styles.title}>Instances</h2>
        <p className={styles.count}>
          {view.total === 0
            ? 'None running'
            : `${view.healthy} of ${view.total} answering, ${view.offline.length} node${view.offline.length === 1 ? '' : 's'} offline`}
        </p>
      </div>

      {view.instances.length === 0 ? (
        <p className={styles.empty}>No instances yet. Move the instances slider up.</p>
      ) : (
        <ul className={styles.list}>
          {view.instances.map((i) => (
            <Row key={i.slot} i={i} onBreak={onBreak} onRevive={onRevive} />
          ))}
        </ul>
      )}

      {spare.length > 0 ? (
        <div className={styles.spare}>
          <h3 className={styles.subtitle}>Other nodes that are offline</h3>
          <ul className={styles.spareList}>
            {spare.slice(0, 8).map((o) => (
              <OfflineRow key={o.nodeId} o={o} onRevive={onRevive} />
            ))}
          </ul>
          {spare.length > 8 ? (
            <p className={styles.more}>and {spare.length - 8} more. Revive all brings them back.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
