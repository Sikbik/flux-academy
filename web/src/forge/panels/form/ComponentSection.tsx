/**
 * One component of the app: name, image, ports, environment, commands, storage and resources. It is the
 * body of an accordion item; the header (name, summary, issue count) is drawn by the form panel.
 */

import { derivedNames, LIMITS, parseRepotag } from '@shared/flux/spec';
import type { FluxComponentSpec } from '@shared/flux/types';
import { useMemo } from 'react';
import { Glyph, Tooltip } from '@/ui';
import { useForgeUi } from '../../context';
import controls from '../../controls/controls.module.css';
import { Field } from '../../controls/Field';
import { GRIDS, GridSlider } from '../../controls/GridSlider';
import { NumberInput, stateOf, TextAreaInput, TextInput } from '../../controls/inputs';
import { KeyValueList, StringList } from '../../controls/lists';
import { listAppend, listMove, listRemove, listSet, renameComponent, totals } from '../../model';
import { cores, disk, memory } from '../../model/format';
import { DataPicker } from './DataPicker';
import styles from './form.module.css';
import { PortsTable } from './PortsTable';

// ---------------------------------------------------------------------------
// The image, taken apart
// ---------------------------------------------------------------------------

export function RepotagAnatomy({ value }: { value: string }) {
  const parsed = useMemo(() => parseRepotag(value), [value]);
  if (!value.trim()) return null;
  const parts: { key: string; label: string; text: string; dim?: boolean }[] = [
    {
      key: 'registry',
      label: 'Registry',
      text: parsed.registry ?? 'Docker Hub',
      dim: parsed.registry === null,
    },
    ...(parsed.namespace ? [{ key: 'namespace', label: 'Namespace', text: parsed.namespace }] : []),
    { key: 'image', label: 'Image', text: parsed.repository || '?' },
    {
      key: 'tag',
      label: parsed.digest ? 'Digest' : 'Tag',
      text: parsed.digest ?? parsed.tag ?? 'none (latest)',
      dim: parsed.tag === null && parsed.digest === null,
    },
  ];
  return (
    <dl className={styles.anatomy} aria-label="The image, taken apart">
      {parts.map((p) => (
        <div
          key={p.key}
          className={styles.anatomyPart}
          data-part={p.key}
          data-dim={p.dim ? 'true' : undefined}
        >
          <dd>{p.text}</dd>
          <dt>{p.label}</dt>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

interface ResourceProps {
  index: number;
  field: 'cpu' | 'ram' | 'hdd';
  label: string;
  unit: string;
  stops: readonly number[];
  cap: number;
  step: number;
  decimals: number;
  min: number;
  format: (n: number) => string;
  topicLabel: string;
}

function Resource({ index, field, label, unit, stops, cap, step, decimals, min, format }: ResourceProps) {
  const ui = useForgeUi();
  const { spec } = ui.snap;
  const component = spec.compose[index] as FluxComponentSpec;
  const path = `compose[${index}].${field}`;
  const locked = !ui.canEdit(path);
  const all = totals(spec);
  const mine = component[field];
  const others = Math.max(0, all[field] - mine);
  const headroom = Math.max(0, Math.round((cap - others) * 100) / 100);
  const used = all[field];
  const over = used > cap + 1e-9;
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / cap) * 100))}%`;

  const set = (v: number) =>
    ui.edit(
      path,
      (s) => {
        const c = s.compose[index];
        if (!c || c[field] === v) return s;
        const compose = s.compose.slice();
        compose[index] = { ...c, [field]: v };
        return { ...s, compose };
      },
      { key: path, label: `Change ${label}` },
    );

  return (
    <Field path={path} label={label} locked={locked} value={format(mine)}>
      <div className={styles.sliderRow}>
        <GridSlider
          label={`${label} of ${component.name}`}
          value={mine}
          stops={stops}
          max={Math.max(headroom, mine)}
          disabled={locked || headroom < min}
          format={format}
          onChange={set}
        />
        <NumberInput
          label={`${label} of ${component.name}`}
          path={path}
          unit={unit}
          value={mine}
          min={min}
          max={cap}
          step={step}
          decimals={decimals}
          locked={locked}
          state={stateOf(ui.issues.worst(path))}
          onChange={set}
        />
      </div>
      <div
        className={styles.cap}
        data-over={over ? 'true' : undefined}
        role="img"
        aria-label={`${format(used)} of ${format(cap)} used by the whole app`}
      >
        <span className={styles.capMine} style={{ inlineSize: pct(Math.min(mine, cap)) }} />
        <span
          className={styles.capOthers}
          style={{ inlineSize: pct(Math.min(others, cap - Math.min(mine, cap))) }}
        />
        <span className={styles.capText}>
          {format(used)} of {format(cap)} across the app
        </span>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

export function ComponentSection({ index }: { index: number }) {
  const ui = useForgeUi();
  const { spec } = ui.snap;
  const c = spec.compose[index];
  const names = useMemo(() => derivedNames(spec), [spec]);
  if (!c) return null;
  const base = `compose[${index}]`;
  const host = names.components[index]?.containerName ?? '';
  const enterprise = Boolean(spec.enterprise);

  const patch = (
    path: string,
    fn: (c: FluxComponentSpec) => FluxComponentSpec,
    key: string | null,
    label: string,
  ) =>
    ui.edit(
      path,
      (s) => {
        const cur = s.compose[index];
        if (!cur) return s;
        const next = fn(cur);
        if (next === cur) return s;
        const compose = s.compose.slice();
        compose[index] = next;
        return { ...s, compose };
      },
      { key, label },
    );

  return (
    <div className={styles.section}>
      <Field
        path={`${base}.name`}
        label="Name"
        htmlFor={`forge-c${index}-name`}
        locked={!ui.canEdit(`${base}.name`)}
        hint={
          host ? (
            <>
              Other components reach it at <code>{host}</code>.
            </>
          ) : undefined
        }
      >
        <TextInput
          id={`forge-c${index}-name`}
          label={`Name of component ${index + 1}`}
          mono
          path={`${base}.name`}
          value={c.name}
          locked={!ui.canEdit(`${base}.name`)}
          state={stateOf(ui.issues.worst(`${base}.name`))}
          onChange={(v) => {
            let rewritten = 0;
            const ok = ui.edit(
              `${base}.name`,
              (s) => {
                const r = renameComponent(s, index, v);
                rewritten = r.rewritten;
                return r.spec;
              },
              { key: `${base}.name`, label: 'Rename a component' },
            );
            if (ok && rewritten > 0) {
              ui.say(
                `Updated ${rewritten} internal host ${rewritten === 1 ? 'name' : 'names'} to the new component name.`,
              );
            }
          }}
        />
      </Field>

      <Field
        path={`${base}.description`}
        label="Description"
        htmlFor={`forge-c${index}-desc`}
        locked={!ui.canEdit(`${base}.description`)}
      >
        <TextAreaInput
          id={`forge-c${index}-desc`}
          label={`Description of ${c.name}`}
          path={`${base}.description`}
          value={c.description}
          limit={LIMITS.descriptionMaxLength}
          maxRows={3}
          locked={!ui.canEdit(`${base}.description`)}
          state={stateOf(ui.issues.worst(`${base}.description`))}
          onChange={(v) =>
            patch(
              `${base}.description`,
              (x) => ({ ...x, description: v }),
              `${base}.description`,
              'Change a description',
            )
          }
        />
      </Field>

      <Field
        path={`${base}.repotag`}
        label="Image"
        htmlFor={`forge-c${index}-repotag`}
        locked={!ui.canEdit(`${base}.repotag`)}
      >
        <TextInput
          id={`forge-c${index}-repotag`}
          label={`Image of ${c.name}`}
          mono
          path={`${base}.repotag`}
          value={c.repotag}
          placeholder="nginx:1.27"
          locked={!ui.canEdit(`${base}.repotag`)}
          state={stateOf(ui.issues.worst(`${base}.repotag`))}
          onChange={(v) =>
            patch(
              `${base}.repotag`,
              (x) => ({ ...x, repotag: v.trim() }),
              `${base}.repotag`,
              'Change the image',
            )
          }
        />
        <RepotagAnatomy value={c.repotag} />
      </Field>

      {enterprise || c.repoauth ? (
        <Field
          path={`${base}.repoauth`}
          label="Registry login"
          htmlFor={`forge-c${index}-auth`}
          locked={!ui.canEdit(`${base}.repoauth`)}
          hint="For a private image, written user:token. Never put a real token in a spec you share."
        >
          <TextInput
            id={`forge-c${index}-auth`}
            label={`Registry login of ${c.name}`}
            mono
            path={`${base}.repoauth`}
            value={c.repoauth}
            placeholder="user:token"
            locked={!ui.canEdit(`${base}.repoauth`)}
            state={stateOf(ui.issues.worst(`${base}.repoauth`))}
            onChange={(v) =>
              patch(
                `${base}.repoauth`,
                (x) => ({ ...x, repoauth: v }),
                `${base}.repoauth`,
                'Change the registry login',
              )
            }
          />
        </Field>
      ) : null}

      <PortsTable index={index} component={c} />

      <Field
        path={`${base}.environmentParameters`}
        label="Environment"
        locked={!ui.canEdit(`${base}.environmentParameters`)}
      >
        <KeyValueList
          path={`${base}.environmentParameters`}
          items={c.environmentParameters}
          max={LIMITS.environment.maxCount}
          locked={!ui.canEdit(`${base}.environmentParameters`)}
          onSet={(i, v) =>
            ui.edit(
              `${base}.environmentParameters`,
              (s) => listSet(s, `${base}.environmentParameters`, i, v),
              {
                key: `${base}.environmentParameters[${i}]`,
                label: 'Change a variable',
              },
            )
          }
          onAdd={() =>
            ui.edit(
              `${base}.environmentParameters`,
              (s) =>
                listAppend(s, `${base}.environmentParameters`, 'NAME=value', LIMITS.environment.maxCount),
              { key: null, label: 'Add a variable' },
            )
          }
          onRemove={(i) =>
            ui.edit(
              `${base}.environmentParameters`,
              (s) => listRemove(s, `${base}.environmentParameters`, i),
              {
                key: null,
                label: 'Remove a variable',
              },
            )
          }
        />
      </Field>

      <Field path={`${base}.commands`} label="Commands" locked={!ui.canEdit(`${base}.commands`)}>
        <StringList
          path={`${base}.commands`}
          items={c.commands}
          noun="argument"
          max={LIMITS.commands.maxCount}
          placeholder="--flag"
          ordered
          locked={!ui.canEdit(`${base}.commands`)}
          emptyText="No commands. The image starts the way its author set it up."
          onSet={(i, v) =>
            ui.edit(`${base}.commands`, (s) => listSet(s, `${base}.commands`, i, v), {
              key: `${base}.commands[${i}]`,
              label: 'Change a command',
            })
          }
          onAdd={() =>
            ui.edit(
              `${base}.commands`,
              (s) => listAppend(s, `${base}.commands`, '', LIMITS.commands.maxCount),
              {
                key: null,
                label: 'Add a command',
              },
            )
          }
          onRemove={(i) =>
            ui.edit(`${base}.commands`, (s) => listRemove(s, `${base}.commands`, i), {
              key: null,
              label: 'Remove a command',
            })
          }
          onMove={(a, b) =>
            ui.edit(`${base}.commands`, (s) => listMove(s, `${base}.commands`, a, b), {
              key: null,
              label: 'Reorder commands',
            })
          }
        />
      </Field>

      <DataPicker index={index} component={c} />

      <div className={styles.resources}>
        <Resource
          index={index}
          field="cpu"
          label="CPU"
          topicLabel="CPU"
          unit="cores"
          stops={GRIDS.cpu}
          cap={LIMITS.totals.cpu}
          step={0.1}
          decimals={1}
          min={0.1}
          format={(n) => `${cores(n)} ${n === 1 ? 'core' : 'cores'}`}
        />
        <Resource
          index={index}
          field="ram"
          label="RAM"
          topicLabel="RAM"
          unit="MB"
          stops={GRIDS.ram}
          cap={LIMITS.totals.ram}
          step={100}
          decimals={0}
          min={100}
          format={memory}
        />
        <Resource
          index={index}
          field="hdd"
          label="Disk"
          topicLabel="Disk"
          unit="GB"
          stops={GRIDS.hdd}
          cap={LIMITS.totals.hdd}
          step={1}
          decimals={0}
          min={1}
          format={disk}
        />
      </div>
    </div>
  );
}

/** The small toolbar of a component: reorder, duplicate, remove. Lives inside the accordion body. */
export function ComponentTools({
  index,
  count,
  onMove,
  onDuplicate,
  onRemove,
  locked,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  locked: boolean;
}) {
  if (locked) return null;
  return (
    <div className={styles.tools} role="toolbar" aria-label={`Component ${index + 1} actions`}>
      <Tooltip content="Move up">
        <button
          type="button"
          className={controls.mini}
          aria-label="Move component up"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          <Glyph name="chevron-up" size={14} />
        </button>
      </Tooltip>
      <Tooltip content="Move down">
        <button
          type="button"
          className={controls.mini}
          aria-label="Move component down"
          disabled={index >= count - 1}
          onClick={() => onMove(index, index + 1)}
        >
          <Glyph name="chevron-down" size={14} />
        </button>
      </Tooltip>
      <Tooltip content="Duplicate">
        <button
          type="button"
          className={controls.mini}
          aria-label="Duplicate component"
          disabled={count >= LIMITS.component.max}
          onClick={() => onDuplicate(index)}
        >
          <Glyph name="copy" size={14} />
        </button>
      </Tooltip>
      <Tooltip content="Remove">
        <button
          type="button"
          className={controls.mini}
          data-tone="crit"
          aria-label="Remove component"
          disabled={count <= LIMITS.component.min}
          onClick={() => onRemove(index)}
        >
          <Glyph name="trash" size={14} />
        </button>
      </Tooltip>
    </div>
  );
}
