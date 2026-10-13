import { useNetwork } from '@/data';
import { formatInt } from '@/lib/format';
import { useSceneBus } from '@/scenes/bus';
import { Annotated, DimensionLine, FigCaption } from '@/ui';
import styles from './stageFigure.module.css';

/**
 * The blueprint layer of the hero stage: dimension lines measuring the bench, as in the look target, and
 * the figure caption. It is laid over the free area the scene is framed in; nothing here depends on where
 * the scene draws its objects. Decorative (the caption under the frame carries the meaning).
 */
export function StageFigure() {
  const placed = useSceneBus((s) => s.scene.instancesPlaced);
  const instances = useSceneBus((s) => s.deploy.instances);
  const network = useNetwork();
  const n = network.data?.nodes.total ?? null;
  const live = network.status === 'live' || network.status === 'cache';
  const shown = placed > 0 ? placed : instances;
  const word = shown === 1 ? 'one instance' : `${shown} instances`;
  const label = n !== null ? `${formatInt(n)} NODES${live ? '' : ', LAST KNOWN'}` : 'THE NETWORK';

  return (
    <>
      <Annotated className={styles.layer}>
        {({ width, height }) => (
          <>
            <DimensionLine
              from={{ x: 16, y: height - 40 }}
              to={{ x: width - 16, y: height - 40 }}
              label={label}
              side="bottom"
              offset={20}
              caps="both"
              box={{ width, height }}
              delay={900}
            />
            <DimensionLine
              from={{ x: 40, y: 56 }}
              to={{ x: 40, y: height - 56 }}
              label="3 TIERS"
              side="left"
              offset={24}
              caps="both"
              box={{ width, height }}
              delay={1100}
            />
          </>
        )}
      </Annotated>
      <FigCaption className={styles.caption} num="0.1" title={`Placement of ${word}`} />
    </>
  );
}
