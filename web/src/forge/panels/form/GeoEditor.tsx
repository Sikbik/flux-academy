/**
 * Geolocation: six continent chips that cycle "anywhere, allowed, denied", the raw tokens (the form of
 * FACTS 3.5: `acEU`, `acEU_DE`, `a!cNA_US`) as removable pills, and a field to add a country or region.
 * The live count of nodes that qualify comes from the network's own geo snapshot.
 */

import { LIMITS, parseGeolocationEntry } from '@shared/flux/spec';
import { useMemo, useState } from 'react';
import { useGeo } from '@/data';
import { Chip, Glyph } from '@/ui';
import { useForgeUi } from '../../context';
import controls from '../../controls/controls.module.css';
import { Field } from '../../controls/Field';
import { TextInput } from '../../controls/inputs';
import {
  addGeoEntry,
  CONTINENTS,
  type ContinentMode,
  continentMode,
  eligibleNodes,
  listRemove,
  setContinentMode,
} from '../../model';
import styles from './form.module.css';

const NEXT: Record<ContinentMode, ContinentMode> = { off: 'allow', allow: 'deny', deny: 'off' };
const MODE_WORD: Record<ContinentMode, string> = { off: 'anywhere', allow: 'allowed', deny: 'denied' };

export function GeoEditor() {
  const ui = useForgeUi();
  const { spec } = ui.snap;
  const geo = useGeo();
  const [draft, setDraft] = useState('');
  const locked = !ui.canEdit('geolocation');

  const eligibility = useMemo(() => {
    const data = geo.data;
    if (!data || data.countries.length === 0) return null;
    return eligibleNodes(spec.geolocation, data.countries);
  }, [geo.data, spec.geolocation]);

  const problems = useMemo(() => (draft.trim() ? parseGeolocationEntry(draft.trim()).problems : []), [draft]);

  const add = () => {
    const entry = draft.trim();
    if (!entry) return;
    const ok = ui.edit('geolocation', (s) => addGeoEntry(s, entry), { key: null, label: 'Add a location' });
    if (ok) setDraft('');
  };

  const readout = eligibility
    ? `${eligibility.approximate ? '~' : ''}${eligibility.nodes.toLocaleString('en-US')} of ${eligibility.total.toLocaleString('en-US')} nodes`
    : undefined;

  return (
    <Field
      path="geolocation"
      label="Where it may run"
      locked={locked}
      value={readout}
      hint={
        spec.geolocation.length === 0 ? (
          'No limits: any node can host a copy. Allowing fewer places leaves fewer nodes to choose from.'
        ) : eligibility && eligibility.nodes === 0 ? (
          'No node matches these rules. The network still accepts a list that leaves none, and nothing is promised to run.'
        ) : eligibility && eligibility.nodes < spec.instances ? (
          `Only ${eligibility.approximate ? 'about ' : ''}${eligibility.nodes.toLocaleString('en-US')} nodes with a known location match, fewer than your ${spec.instances} instances. The network refuses a list that leaves some nodes but fewer than the instances. Nodes whose location it could not resolve count as candidates too.`
        ) : (
          <>
            A node must match an allow entry (when there are any) and no deny entry.
            {eligibility?.approximate ? ' Region entries are counted at country level here.' : ''}
          </>
        )
      }
    >
      <fieldset className={styles.chips}>
        <legend className="sr-only">Continents</legend>
        {CONTINENTS.filter((c) => c.code !== 'AN').map((c) => {
          const mode = continentMode(spec, c.code);
          return (
            <Chip
              key={c.code}
              size="sm"
              kind={mode === 'deny' ? 'status' : 'filter'}
              status={mode === 'deny' ? 'crit' : undefined}
              selected={mode === 'allow'}
              disabled={locked}
              aria-label={`${c.name}: ${MODE_WORD[mode]}. Press to ${
                mode === 'off' ? 'allow it' : mode === 'allow' ? 'deny it' : 'clear it'
              }.`}
              onClick={() =>
                ui.edit('geolocation', (s) => setContinentMode(s, c.code, NEXT[mode]), {
                  key: null,
                  label: `${c.name}: ${MODE_WORD[NEXT[mode]]}`,
                })
              }
            >
              {c.name}
              <span className="sr-only"> ({MODE_WORD[mode]})</span>
            </Chip>
          );
        })}
      </fieldset>

      {spec.geolocation.length > 0 ? (
        <ul className={styles.tokens} aria-label="Location rules">
          {spec.geolocation.map((raw, i) => {
            const parsed = parseGeolocationEntry(raw);
            const bad = parsed.problems.length > 0;
            const deny = raw.startsWith('a!c');
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: entries are plain strings that may repeat while editing
              <li key={i} className={styles.token} data-kind={bad ? 'bad' : deny ? 'deny' : 'allow'}>
                <Glyph name={bad ? 'status-warn' : deny ? 'cross' : 'check'} size={12} />
                <code>{raw || '(empty)'}</code>
                {locked ? null : (
                  <button
                    type="button"
                    aria-label={`Remove ${raw || 'empty entry'}`}
                    onClick={() =>
                      ui.edit('geolocation', (s) => listRemove(s, 'geolocation', i), {
                        key: null,
                        label: 'Remove a location',
                      })
                    }
                  >
                    <Glyph name="close" size={12} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {locked ? null : (
        <div className={controls.row}>
          <TextInput
            label="Add a country or region rule"
            mono
            value={draft}
            placeholder="acEU_DE"
            state={problems.length > 0 ? 'warning' : null}
            onChange={setDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            className={controls.addBtn}
            disabled={!draft.trim() || spec.geolocation.length >= LIMITS.geolocation.maxCount}
            onClick={add}
          >
            <Glyph name="plus" size={14} />
            Add
          </button>
        </div>
      )}
      {!locked && problems.length > 0 ? <p className={styles.note}>{problems[0]}.</p> : null}
      {!locked && draft.trim() === '' ? (
        <p className={controls.hint}>
          Try <code>acEU_DE</code> (allow Germany) or <code>a!cNA_US</code> (deny the US).
        </p>
      ) : null}
    </Field>
  );
}
