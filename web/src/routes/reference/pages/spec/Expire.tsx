import { BLOCKS_PER_MONTH, blocksPerDay, expiryHeight, LIMITS, TARGET_BLOCK_SEC } from '@shared/flux';
import { useMemo, useState } from 'react';
import { anchor } from '@/content/reference';
import { num } from '@/content/reference/derive';
import { buildExpireFacts, buildExpireRows, exampleHeight } from '@/content/reference/spec';
import { type ExpireUnit, expireCalc } from '@/content/reference/tools';
import { Button, SegmentedControl, TextField } from '@/ui';
import { type Column, DataTable, FactList, Slab } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';
import { KeyFact } from '../../parts/Prose';
import styles from './spec.module.css';

const ROWS = buildExpireRows();
const UNITS: readonly { value: ExpireUnit; label: string; hint: string }[] = [
  { value: 'blocks', label: 'Blocks', hint: 'A whole number of blocks.' },
  { value: 'days', label: 'Days', hint: 'Days at the target block time.' },
  { value: 'months', label: 'Pricing months', hint: 'Months of the price table.' },
];

/** `expire`: the arithmetic of blocks, a converter that asks the linter, the usual lengths and the rules. */
export function Expire() {
  const facts = useMemo(() => buildExpireFacts(), []);
  const [unit, setUnit] = useState<ExpireUnit>('blocks');
  const [value, setValue] = useState(String(BLOCKS_PER_MONTH));
  const calc = useMemo(() => expireCalc(unit, value), [unit, value]);
  const height = exampleHeight();

  const columns: Column<(typeof ROWS)[number]>[] = [
    {
      id: 'length',
      label: 'Length',
      primary: true,
      render: (r) => (
        <span className={styles.formCell}>
          {r.label}
          <CopyLink id={anchor.expire(r.id)} label={r.label} />
        </span>
      ),
    },
    { id: 'blocks', label: 'expire', code: true, numeric: true, mono: true, render: (r) => num(r.blocks) },
    { id: 'about', label: 'About', render: (r) => r.about.replace(/^about /, '') },
    {
      id: 'discount',
      label: 'Discount',
      render: (r) => (r.discountPct > 0 ? `${r.discountPct} percent` : 'None'),
    },
    {
      id: 'use',
      label: 'Convert',
      bare: true,
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setUnit('blocks');
            setValue(String(r.blocks));
          }}
        >
          Use {num(r.blocks)}
        </Button>
      ),
    },
  ];

  return (
    <Section id="expire">
      <KeyFact label="The arithmetic">
        <p>
          A block takes about {TARGET_BLOCK_SEC} seconds, so a day is about {num(blocksPerDay())} blocks. The
          price table counts in months of {num(BLOCKS_PER_MONTH)} blocks. The app ends at the height of the
          message that registered or updated it, plus <code>expire</code>: at height {num(height)},{' '}
          <code>expire</code> of {num(BLOCKS_PER_MONTH)} ends at height{' '}
          {num(expiryHeight(height, BLOCKS_PER_MONTH))}.
        </p>
      </KeyFact>

      <div className={styles.tool}>
        <div className={styles.toolRow}>
          <SegmentedControl
            size="sm"
            aria-label="Unit of the subscription length"
            value={unit}
            onValueChange={(v) =>
              setUnit((UNITS.find((u) => u.value === v)?.value ?? 'blocks') as ExpireUnit)
            }
            options={UNITS.map((u) => ({ value: u.value, label: u.label }))}
          />
        </div>
        <div className={styles.toolGrid}>
          <TextField
            label={`Length in ${UNITS.find((u) => u.value === unit)?.label.toLowerCase()}`}
            hint={UNITS.find((u) => u.value === unit)?.hint}
            mono
            inputMode="decimal"
            value={value}
            onValueChange={setValue}
          />
          <Slab padded>
            {calc.valid && calc.blocks !== null ? (
              <dl className={styles.readout} aria-live="polite">
                <div>
                  <dt>expire</dt>
                  <dd>{num(calc.blocks)} blocks</dd>
                </div>
                <div>
                  <dt>About</dt>
                  <dd>{calc.about}</dd>
                </div>
                <div>
                  <dt>Pricing months</dt>
                  <dd>{Number((calc.months ?? 0).toFixed(2))}</dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd>{calc.discount ?? 'None'}</dd>
                </div>
                <div>
                  <dt>Ends at height</dt>
                  <dd>
                    {num(expiryHeight(height, calc.blocks))}{' '}
                    <span className={styles.dim}>if registered at {num(height)}</span>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className={styles.parseEmpty}>
                Type a number of {UNITS.find((u) => u.value === unit)?.label.toLowerCase()}.
              </p>
            )}
            {calc.valid && calc.codes.length > 0 ? (
              <LintChips codes={calc.codes} label="The linter says" />
            ) : calc.valid ? (
              <p className={styles.noteLead}>
                The linter has nothing to say about it: it is between {LIMITS.expire.min} and{' '}
                {num(LIMITS.expire.max)} blocks.
              </p>
            ) : null}
          </Slab>
        </div>
      </div>

      <DataTable
        caption="Common subscription lengths in blocks"
        columns={columns}
        rows={ROWS}
        rowId={(r) => anchor.expire(r.id)}
      />

      <FactList section="expire" rows={facts} />
    </Section>
  );
}
