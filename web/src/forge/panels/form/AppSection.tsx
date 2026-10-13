/**
 * The app level of the form: identity, how many copies, how long, add-ons, contacts and where it may run.
 * Every control edits the spec through `ui.edit` with the exact JSON paths it touches, so a lesson can lock
 * one field and leave its neighbours alone.
 */

import { BLOCKS_PER_MONTH, durationDiscount, humanBlocks } from '@shared/flux/blocks';
import { checkOwner, LIMITS } from '@shared/flux/spec';
import { useMemo } from 'react';
import { Chip, Switch } from '@/ui';
import { useForgeUi } from '../../context';
import { Choice } from '../../controls/Choice';
import { Field } from '../../controls/Field';
import { GRIDS, GridSlider } from '../../controls/GridSlider';
import { NumberInput, stateOf, TextAreaInput, TextInput } from '../../controls/inputs';
import { StringList } from '../../controls/lists';
import {
  ENTERPRISE_PLACEHOLDER,
  isEnterprisePlaceholder,
  listAppend,
  listMove,
  listRemove,
  listSet,
  monthsOf,
  PERIODS,
  periodOf,
  renameApp,
  setEnterprise,
  setExpireMonths,
  setStaticIp,
} from '../../model';
import { instances as instancesLabel } from '../../model/format';
import styles from './form.module.css';
import { GeoEditor } from './GeoEditor';

const PERIOD_SHORT: Record<string, string> = {
  '1w': '1 wk',
  '2w': '2 wk',
  '1m': '1 mo',
  '3m': '3 mo',
  '6m': '6 mo',
  '12m': '1 yr',
};

export function AppSection() {
  const ui = useForgeUi();
  const { spec } = ui.snap;
  const enterprise = Boolean(spec.enterprise);
  const placeholder = isEnterprisePlaceholder(spec.enterprise);

  const ownerCheck = useMemo(() => checkOwner(spec.owner), [spec.owner]);
  const lowerName = spec.name.toLowerCase();
  const period = periodOf(spec);
  const months = monthsOf(spec);
  const discount = durationDiscount(months);

  const periodOptions = useMemo(
    () => [
      ...PERIODS.map((p) => ({ value: p.id, label: PERIOD_SHORT[p.id] ?? p.label })),
      ...(period ? [] : [{ value: 'custom', label: 'Custom' }]),
    ],
    [period],
  );

  return (
    <div className={styles.section}>
      {/* ---- identity ----------------------------------------------------------------- */}
      <Field
        path="name"
        label="App name"
        htmlFor="forge-app-name"
        locked={!ui.canEdit('name')}
        value={
          <span className={styles.chars}>
            {spec.name.length}/{LIMITS.name.maxLength}
          </span>
        }
        hint={
          <>
            Your free address:{' '}
            <code>
              {lowerName || 'name'}.{LIMITS.appDomainSuffix}
            </code>
          </>
        }
      >
        <TextInput
          id="forge-app-name"
          label="App name"
          mono
          path="name"
          value={spec.name}
          locked={!ui.canEdit('name')}
          state={stateOf(ui.issues.worst('name'))}
          placeholder="my-app"
          onChange={(v) => {
            let rewritten = 0;
            const ok = ui.edit(
              'name',
              (s) => {
                const r = renameApp(s, v);
                rewritten = r.rewritten;
                return r.spec;
              },
              { key: 'name', label: 'Rename the app' },
            );
            if (ok && rewritten > 0) {
              ui.say(
                `Updated ${rewritten} internal host ${rewritten === 1 ? 'name' : 'names'} to match the new app name.`,
              );
            }
          }}
        />
      </Field>

      <Field
        path="description"
        label="Description"
        htmlFor="forge-app-desc"
        locked={!ui.canEdit('description')}
      >
        <TextAreaInput
          id="forge-app-desc"
          label="Description"
          path="description"
          value={spec.description}
          limit={LIMITS.descriptionMaxLength}
          locked={!ui.canEdit('description')}
          state={stateOf(ui.issues.worst('description'))}
          onChange={(v) => ui.edit('description', (s) => ({ ...s, description: v }), { key: 'description' })}
        />
      </Field>

      <Field
        path="owner"
        label="Owner"
        htmlFor="forge-app-owner"
        locked={!ui.canEdit('owner')}
        value={
          ownerCheck === 'ok' ? (
            <Chip size="sm" kind="status" status="ok">
              Valid ID
            </Chip>
          ) : undefined
        }
        hint="The Flux ID that signs the registration. FluxCloud uses your own when you deploy."
      >
        <TextInput
          id="forge-app-owner"
          label="Owner"
          mono
          path="owner"
          value={spec.owner}
          locked={!ui.canEdit('owner')}
          state={stateOf(ui.issues.worst('owner'))}
          onChange={(v) => ui.edit('owner', (s) => ({ ...s, owner: v.trim() }), { key: 'owner' })}
        />
      </Field>

      {/* ---- instances ---------------------------------------------------------------- */}
      <Field
        path="instances"
        label="Instances"
        locked={!ui.canEdit('instances')}
        value={instancesLabel(spec.instances)}
        hint="In practice each copy runs on a different node, so one node going down takes one copy with it, not the whole app."
      >
        <div className={styles.sliderRow}>
          <GridSlider
            label="Instances"
            value={spec.instances}
            stops={GRIDS.instances}
            disabled={!ui.canEdit('instances')}
            format={(v) => String(v)}
            onChange={(v) =>
              ui.edit('instances', (s) => ({ ...s, instances: v }), {
                key: 'instances',
                label: 'Set instances',
              })
            }
          />
          <NumberInput
            label="Instances"
            path="instances"
            value={spec.instances}
            min={LIMITS.instances.min}
            max={LIMITS.instances.max}
            locked={!ui.canEdit('instances')}
            state={stateOf(ui.issues.worst('instances'))}
            onChange={(v) =>
              ui.edit('instances', (s) => ({ ...s, instances: Math.max(0, Math.round(v)) }), {
                key: 'instances',
                label: 'Set instances',
              })
            }
          />
        </div>
      </Field>

      {/* ---- subscription ------------------------------------------------------------- */}
      <Field
        path="expire"
        label="Subscription"
        locked={!ui.canEdit('expire')}
        value={
          months >= 0.95 ? `${Number(months.toFixed(1))} mo` : `${spec.expire.toLocaleString('en-US')} blocks`
        }
        hint={
          <>
            {humanBlocks(spec.expire)}.{' '}
            {discount
              ? `A subscription this long takes ${discount.label} off the whole price.`
              : 'Three months or more takes 3 percent off, six months 6 percent, nine months or more 12 percent, before the total is rounded up to .49 or .99.'}
          </>
        }
      >
        <Choice
          label="Subscription length"
          value={period ? period.id : 'custom'}
          options={periodOptions}
          disabled={!ui.canEdit('expire')}
          onValueChange={(id) => {
            const p = PERIODS.find((x) => x.id === id);
            if (!p || !ui.canEdit('expire')) return;
            ui.edit('expire', (s) => setExpireMonths(s, p.blocks / BLOCKS_PER_MONTH), {
              key: null,
              label: 'Set the subscription length',
            });
          }}
        />
        <NumberInput
          label="Subscription blocks"
          path="expire"
          unit="blocks"
          value={spec.expire}
          min={LIMITS.expire.min}
          max={LIMITS.expire.max}
          step={BLOCKS_PER_MONTH / 4}
          locked={!ui.canEdit('expire')}
          state={stateOf(ui.issues.worst('expire'))}
          onChange={(v) =>
            ui.edit('expire', (s) => ({ ...s, expire: Math.max(0, Math.round(v)) }), {
              key: 'expire',
              label: 'Set the subscription length',
            })
          }
        />
      </Field>

      {/* ---- add-ons ------------------------------------------------------------------ */}
      <div className={styles.pair}>
        <Field path="staticip" label="Static IP" locked={!ui.canEdit('staticip')}>
          <Switch
            size="sm"
            checked={spec.staticip}
            disabled={!ui.canEdit('staticip')}
            aria-label="Static IP"
            onCheckedChange={(on) =>
              ui.edit('staticip', (s) => setStaticIp(s, on), { key: null, label: 'Toggle static IP' })
            }
          >
            {spec.staticip ? 'On' : 'Off'}
          </Switch>
        </Field>
        <Field path="enterprise" label="Enterprise" locked={!ui.canEdit('enterprise')}>
          <Switch
            size="sm"
            checked={enterprise}
            disabled={!ui.canEdit('enterprise')}
            aria-label="Enterprise"
            onCheckedChange={(on) =>
              ui.edit('enterprise', (s) => setEnterprise(s, on), { key: null, label: 'Toggle enterprise' })
            }
          >
            {enterprise ? 'On' : 'Off'}
          </Switch>
        </Field>
      </div>
      {placeholder ? (
        <p className={styles.note}>
          Enterprise shows as <code>{ENTERPRISE_PLACEHOLDER}</code> here. Only FluxCloud can create the real
          encrypted value, so "Deploy on FluxCloud" leaves it out and you switch Enterprise on there.
        </p>
      ) : null}

      {/* ---- contacts ----------------------------------------------------------------- */}
      <Field path="contacts" label="Contacts" locked={!ui.canEdit('contacts')} hideIssues={false}>
        <StringList
          path="contacts"
          items={spec.contacts}
          noun="contact"
          max={LIMITS.contacts.maxCount}
          mono={false}
          placeholder="you@example.com"
          locked={!ui.canEdit('contacts')}
          emptyText="No contacts. FluxCloud asks for one email, which it says is for deployment and expiration notifications."
          onSet={(i, v) =>
            ui.edit('contacts', (s) => listSet(s, 'contacts', i, v), { key: `contacts[${i}]` })
          }
          onAdd={() =>
            ui.edit('contacts', (s) => listAppend(s, 'contacts', '', LIMITS.contacts.maxCount), {
              key: null,
              label: 'Add a contact',
            })
          }
          onRemove={(i) =>
            ui.edit('contacts', (s) => listRemove(s, 'contacts', i), { key: null, label: 'Remove a contact' })
          }
        />
      </Field>

      {/* ---- where it may run --------------------------------------------------------- */}
      <GeoEditor />

      {/* ---- pinned nodes ------------------------------------------------------------- */}
      {enterprise || spec.nodes.length > 0 ? (
        <Field path="nodes" label="Pinned nodes" locked={!ui.canEdit('nodes')}>
          <StringList
            path="nodes"
            items={spec.nodes}
            noun="node"
            max={LIMITS.nodes.maxCount}
            placeholder="txhash:0"
            locked={!ui.canEdit('nodes')}
            ordered
            emptyText="No pinned nodes. Each node decides for itself whether to take a copy."
            onSet={(i, v) => ui.edit('nodes', (s) => listSet(s, 'nodes', i, v), { key: `nodes[${i}]` })}
            onAdd={() =>
              ui.edit('nodes', (s) => listAppend(s, 'nodes', '', LIMITS.nodes.maxCount), {
                key: null,
                label: 'Add a node',
              })
            }
            onRemove={(i) =>
              ui.edit('nodes', (s) => listRemove(s, 'nodes', i), { key: null, label: 'Remove a node' })
            }
            onMove={(a, b) =>
              ui.edit('nodes', (s) => listMove(s, 'nodes', a, b), { key: null, label: 'Reorder nodes' })
            }
          />
        </Field>
      ) : null}
    </div>
  );
}
