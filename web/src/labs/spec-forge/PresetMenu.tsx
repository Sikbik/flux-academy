import { useMemo, useState } from 'react';
import { PRESETS, type PricingContext, presetSpec, priceSpec } from '@/forge/model';
import { Button, Popover } from '@/ui';
import styles from './lab.module.css';

export const BLANK = 'blank';

/**
 * "Start from": the example specs with what each costs at the current rates, and a blank spec that shows the
 * checker what an empty form is missing.
 */
export function PresetMenu({
  pricing,
  disabled,
  onPick,
  className,
}: {
  pricing: PricingContext;
  disabled?: boolean;
  onPick: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const prices = useMemo(
    () =>
      PRESETS.map((p) => {
        const spec = presetSpec(p.id);
        return spec ? priceSpec(spec, pricing).usdPerMonth : null;
      }),
    [pricing],
  );

  const choose = (id: string) => {
    setOpen(false);
    onPick(id);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      title="Start from an example"
      placement="bottom-start"
      width={400}
      content={
        <ul className={styles.presets}>
          {PRESETS.map((p, i) => {
            const price = prices[i];
            return (
              <li key={p.id}>
                <button type="button" className={styles.preset} onClick={() => choose(p.id)}>
                  <span className={styles.presetName}>{p.label}</span>
                  {price !== null && price !== undefined ? (
                    <span className={styles.presetPrice}>${price.toFixed(2)} a month</span>
                  ) : null}
                  <span className={styles.presetDesc}>{p.description}</span>
                </button>
              </li>
            );
          })}
          <li aria-hidden="true" className={styles.presetDivider} />
          <li>
            <button type="button" className={styles.preset} onClick={() => choose(BLANK)}>
              <span className={styles.presetName}>Blank spec</span>
              <span className={styles.presetDesc}>
                Only the defaults, with no name yet. The checker will tell you what is missing.
              </span>
            </button>
          </li>
        </ul>
      }
    >
      <Button
        className={className}
        variant="secondary"
        icon="layers"
        iconEnd="chevron-down"
        disabled={disabled}
      >
        Examples
      </Button>
    </Popover>
  );
}
