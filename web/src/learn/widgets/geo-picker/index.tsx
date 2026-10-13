/**
 * Widget `geo-picker` (docs/CONTENT.md section 5): a hex world where clicking continents, then
 * countries, builds a `geolocation` array in the real grammar (FACTS 3.5), with the eligible node count
 * from the live geo snapshot and warnings when the set is thin, pointless or contradictory.
 *
 * Props (`stage.props`):
 *   target     { allowContinents?: string[]; deny?: string[] } what to build. `EU` and `acEU` are the same
 *              allow; `RU`, `EU_RU` and `a!cEU_RU` are the same deny. Each side named must match exactly.
 *   show       ('counts')[] which readouts to show. Omitted means all of them.
 *   minEligible number, optional: the pool size below which the picker warns. Default 30.
 *   instances  number, optional: the instance count the registration check is shown for. Default 3. The
 *              check (FACTS 3.5) refuses only when 0 < candidates < instances; nodes whose location the
 *              network cannot resolve count as candidates, and a list that leaves none is accepted.
 *
 * Emits `widget-done` when `target` is met (compared as normalised token sets). With no `target` it is
 * done at two or more valid allow entries and no contradiction. Registers a solver for "Show me".
 *
 * Every map interaction has a DOM equivalent: the continent toggles, the country list, the typed entry.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { describeStatus, freshnessKind, useDataAge, useGeo } from '@/data';
import { countryName, REGION_NAMES, type Region } from '@/diorama/model';
import type { WidgetComponent } from '@/learn/stage-api';
import { copyText } from '@/lib/clipboard';
import { formatInt, formatShare } from '@/lib/format';
import { announce } from '@/system/announce';
import { toast } from '@/system/toasts';
import { Button, Chip, FreshnessChip, Glyph, Panel, SegmentedControl, Select, TextField } from '@/ui';
import styles from './GeoPicker.module.css';
import {
  analyzeTokens,
  canonicalToken,
  continentToken,
  countryToken,
  describeToken,
  eligibility,
  geolocationJson,
  type Mode,
  normalizeTokens,
  PICKER_REGIONS,
  type PickerTarget,
  poolHealth,
  RISKY_BELOW,
  regionOfCountry,
  registrationVerdict,
  satisfiesTarget,
  targetTokens,
  toggleContinent,
  toggleCountry,
  typedEntryProblem,
} from './tokens';
import { type CountryPin, countryPins, worldMap } from './world';

interface Props {
  target: PickerTarget | null;
  counts: boolean;
  minEligible: number;
  /** The instance count the registration check is shown for. */
  instances: number;
}

function strings(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
}

function readProps(raw: Record<string, unknown> | undefined): Props {
  const t = raw?.target;
  let target: PickerTarget | null = null;
  if (typeof t === 'object' && t !== null) {
    const rec = t as Record<string, unknown>;
    const allowContinents = strings(rec.allowContinents);
    const deny = strings(rec.deny);
    if (allowContinents || deny) target = { allowContinents, deny };
  }
  const show = strings(raw?.show);
  const min = typeof raw?.minEligible === 'number' && raw.minEligible > 0 ? raw.minEligible : RISKY_BELOW;
  const instances =
    typeof raw?.instances === 'number' && raw.instances >= 1 ? Math.min(100, Math.round(raw.instances)) : 3;
  return { target, counts: show ? show.includes('counts') : true, minEligible: min, instances };
}

const WARNING_ICON = { crit: 'status-crit', warn: 'status-warn', info: 'info' } as const;

interface Warning {
  id: string;
  tone: 'crit' | 'warn' | 'info';
  text: string;
}

const GeoPicker: WidgetComponent = ({ stage, host, stepKey }) => {
  const props = useMemo(() => readProps(stage.props), [stage.props]);
  const geo = useGeo();
  const age = useDataAge('geo');
  const [tokens, setTokens] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('allow');
  const [hover, setHover] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const map = useMemo(() => worldMap(), []);
  const data = geo.data;
  const pins = useMemo(() => countryPins(data, map), [data, map]);
  const countries = data?.countries ?? [];
  const totalNodes = data?.total ?? 0;

  const nameOf = useMemo(() => {
    const byCode = new Map(countries.map((c) => [c.code.toUpperCase(), c.name]));
    return {
      continent: (r: string) => REGION_NAMES[r as Region] ?? r,
      country: (cc: string) => byCode.get(cc.toUpperCase()) ?? countryName(cc),
    };
  }, [countries]);

  // Per-continent node totals, from the countries the snapshot names.
  const continentNodes = useMemo(() => {
    const sums: Record<Region, number> = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0 };
    for (const c of countries) {
      const r = regionOfCountry(c.code);
      if (r) sums[r] += c.nodes;
    }
    return sums;
  }, [countries]);

  const analysis = useMemo(() => analyzeTokens(tokens), [tokens]);
  const elig = useMemo(() => eligibility(tokens, countries, totalNodes), [tokens, countries, totalNodes]);
  const health = poolHealth(tokens, elig.eligible, props.minEligible);

  // A new step starts untouched.
  const lastStep = useRef(stepKey);
  useEffect(() => {
    if (lastStep.current !== stepKey) {
      lastStep.current = stepKey;
      setTouched(false);
    }
  }, [stepKey]);

  const edit = (next: { tokens: string[]; message: string }) => {
    setTokens(next.tokens);
    setTouched(true);
    announce(next.message);
  };

  const onContinent = (r: Region) => edit(toggleContinent(tokens, r, mode, nameOf));
  const onCountry = (cc: string) => edit(toggleCountry(tokens, cc, mode, nameOf));

  const remove = (token: string) => {
    edit({
      tokens: normalizeTokens(tokens.filter((t) => canonicalToken(t) !== canonicalToken(token))),
      message: `${token} removed.`,
    });
  };

  const addTyped = () => {
    const raw = canonicalToken(typed);
    if (!raw) return;
    const problem = typedEntryProblem(raw);
    if (problem) {
      setTypedError(problem);
      return;
    }
    setTypedError(null);
    setTyped('');
    edit({ tokens: normalizeTokens([...tokens, raw]), message: `${raw} added.` });
  };

  // ---- completion ------------------------------------------------------------------------------
  const met = props.target
    ? satisfiesTarget(tokens, props.target)
    : analysis.allow.length >= 2 && analysis.contradictions.length === 0 && analysis.invalid.length === 0;
  const reported = useRef(false);
  useEffect(() => {
    if (!met) {
      reported.current = false;
      return;
    }
    if (!touched || reported.current) return;
    reported.current = true;
    host.emit({ type: 'widget-done' });
  }, [met, touched, host]);

  const solverTarget = useRef(props.target);
  solverTarget.current = props.target;
  useEffect(() => {
    host.registerSolver(() => {
      const t = solverTarget.current;
      if (t) {
        const want = targetTokens(t);
        setTokens(normalizeTokens([...(want.allow ?? []), ...(want.deny ?? [])]));
      } else {
        setTokens(['acEU', 'acNA']);
      }
      setTouched(true);
    });
    return () => host.registerSolver(null);
  }, [host]);

  // ---- warnings --------------------------------------------------------------------------------
  const warnings: Warning[] = [];
  for (const i of analysis.invalid) {
    warnings.push({
      id: `invalid-${i.token}`,
      tone: 'crit',
      text: `${i.token}: ${i.problems[0] ?? 'the network ignores this entry'}.`,
    });
  }
  for (const c of analysis.contradictions) {
    warnings.push({
      id: `contra-${c.allow}-${c.by}`,
      tone: 'crit',
      text: `${c.by} cancels ${c.allow}. A node must pass every deny entry, so deny always wins and no node located there can match.`,
    });
  }
  const verdict = tokens.length > 0 ? registrationVerdict(elig.candidates, props.instances) : 'accepted';
  if (analysis.everythingCancelled) {
    warnings.push({
      id: 'cancelled',
      tone: 'crit',
      text: 'Every allow entry is cancelled, so no node can match. The network does not catch this at registration: the list is accepted, and nothing is promised to run.',
    });
  } else if (health === 'empty' && analysis.invalid.length === 0) {
    warnings.push({
      id: 'empty',
      tone: 'crit',
      text: 'No known node matches these entries. The network does not refuse a list that leaves no candidate: it is accepted, and nothing is promised to run.',
    });
  } else if (health === 'tiny') {
    warnings.push({
      id: 'tiny',
      tone: 'warn',
      text: `Only ${formatInt(elig.eligible)} nodes match. Three instances need three different free nodes, and nodes come and go.`,
    });
  } else if (health === 'thin') {
    warnings.push({
      id: 'thin',
      tone: 'warn',
      text: `Fewer than ${props.minEligible} nodes match (${formatInt(elig.eligible)}). A thin pool leaves little room when a node is full or offline.`,
    });
  }
  if (verdict === 'refused') {
    warnings.push({
      id: 'refused',
      tone: 'crit',
      text: `Registration would be refused: ${props.instances} instances requested but only ${formatInt(elig.candidates)} eligible nodes exist for this geolocation. Widen the allowed locations or lower the instance count.`,
    });
  }
  for (const r of analysis.redundant) {
    warnings.push({
      id: `redundant-${r.token}`,
      tone: 'info',
      text: `${r.token} adds nothing: ${r.coveredBy} already includes it.`,
    });
  }
  for (const d of analysis.idleDenies) {
    warnings.push({
      id: `idle-${d}`,
      tone: 'info',
      text: `${d} excludes nothing, because no allow entry reaches it.`,
    });
  }

  // ---- map state -------------------------------------------------------------------------------
  const continentState = (r: Region): 'allow' | 'deny' | 'none' => {
    if (tokens.some((t) => canonicalToken(t) === continentToken(r, 'allow'))) return 'allow';
    if (tokens.some((t) => canonicalToken(t) === continentToken(r, 'deny'))) return 'deny';
    return 'none';
  };

  const countryState = (cc: string): 'allow' | 'deny' | 'none' => {
    const rg = regionOfCountry(cc);
    if (!rg) return 'none';
    if (tokens.some((t) => canonicalToken(t) === countryToken(rg, cc, 'deny'))) return 'deny';
    if (tokens.some((t) => canonicalToken(t) === countryToken(rg, cc, 'allow'))) return 'allow';
    return 'none';
  };

  const selectOptions = useMemo(
    () =>
      [...countries]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({
          value: c.code.toUpperCase(),
          label: `${c.name} (${formatInt(c.nodes)} nodes)`,
        })),
    [countries],
  );

  const hoverLabel = (() => {
    if (!hover) return null;
    if (hover.startsWith('region:')) {
      const r = hover.slice(7) as Region;
      return `${REGION_NAMES[r]}: ${formatInt(continentNodes[r])} nodes. Click to ${mode} it.`;
    }
    const cc = hover.slice(8);
    const pin = pins.find((p) => p.code === cc);
    return `${nameOf.country(cc)}: ${formatInt(pin?.nodes ?? 0)} nodes. Click to ${mode} it.`;
  })();

  const tokenWords = (t: string): string => {
    const i = describeToken(t);
    const verb = i.mode === 'deny' ? 'Deny' : 'Allow';
    if (i.level === 'all') return 'Allow every location';
    if (i.level === 'continent') return `${verb} ${nameOf.continent(i.continent ?? '')}`;
    if (i.level === 'country') return `${verb} ${nameOf.country(i.country ?? '')}`;
    return `${verb} (region pin or legacy form)`;
  };

  const pinRadius = (p: CountryPin) =>
    Math.min(2.8, Math.max(1.15, 0.5 + 0.62 * Math.log10(Math.max(1, p.nodes) + 1)));
  const live = geo.status === 'live' || geo.status === 'cache';
  const chip = describeStatus(geo.status, { meta: geo.meta, ageMs: age });

  return (
    <Panel variant="glass" padding="md" container className={styles.root} contentClassName={styles.content}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Geolocation builder</p>
        <div className={styles.headTools}>
          <SegmentedControl
            aria-label="What a click does"
            size="sm"
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            options={[
              { value: 'allow', label: 'Allow' },
              { value: 'deny', label: 'Deny' },
            ]}
          />
        </div>
      </div>

      <p className={styles.help}>
        {mode === 'allow'
          ? 'Click a continent to allow it, then click a country pin to allow just that country.'
          : 'Deny mode: click a continent or a country to keep nodes out. A deny always wins over an allow.'}
      </p>

      <div className={styles.mapBox}>
        <svg className={styles.map} viewBox={map.viewBox} aria-hidden="true" data-mode={mode}>
          <defs>
            <pattern
              id="geo-picker-hatch"
              width="1.6"
              height="1.6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="1.6" height="1.6" fill="rgb(var(--status-crit-rgb) / 0.2)" />
              <rect width="0.55" height="1.6" fill="rgb(var(--status-crit-rgb) / 0.75)" />
            </pattern>
          </defs>
          {PICKER_REGIONS.map((r) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; the continent buttons below are the keyboard path
            <path
              key={r}
              d={map.paths[r]}
              className={styles.land}
              data-state={continentState(r)}
              data-hover={hover === `region:${r}` ? 'true' : undefined}
              fill={continentState(r) === 'deny' ? 'url(#geo-picker-hatch)' : undefined}
              onPointerEnter={() => setHover(`region:${r}`)}
              onPointerLeave={() => setHover((h) => (h === `region:${r}` ? null : h))}
              onClick={() => onContinent(r)}
            />
          ))}
          {pins.map((p) => {
            const state = countryState(p.code);
            const reach = elig.allowed[p.code];
            const dim = tokens.length > 0 && reach === 0;
            const r = pinRadius(p);
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; the country list below is the keyboard path
              <g
                key={p.code}
                transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
                className={styles.pin}
                data-state={state}
                data-dim={dim ? 'true' : undefined}
                data-hover={hover === `country:${p.code}` ? 'true' : undefined}
                onPointerEnter={() => setHover(`country:${p.code}`)}
                onPointerLeave={() => setHover((h) => (h === `country:${p.code}` ? null : h))}
                onClick={(e) => {
                  e.stopPropagation();
                  onCountry(p.code);
                }}
              >
                <circle r={r + 1.2} className={styles.pinHit} />
                <circle r={r} className={styles.pinDot} />
                {state === 'deny' ? (
                  <path
                    d={`M${-r * 0.6} ${-r * 0.6}L${r * 0.6} ${r * 0.6}M${r * 0.6} ${-r * 0.6}L${-r * 0.6} ${r * 0.6}`}
                    className={styles.pinCross}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
        <p className={styles.readout} aria-hidden="true">
          {hoverLabel ?? 'Pins are countries that run Flux nodes. Bigger pin, more nodes.'}
        </p>
      </div>

      <fieldset className={styles.continents}>
        <legend className="sr-only">Continents</legend>
        {PICKER_REGIONS.map((r) => {
          const state = continentState(r);
          return (
            <button
              key={r}
              type="button"
              className={styles.continent}
              aria-pressed={state !== 'none'}
              data-state={state}
              onClick={() => onContinent(r)}
            >
              <span className={styles.continentName}>{REGION_NAMES[r]}</span>
              <span className={styles.continentMeta}>
                {state === 'allow'
                  ? 'Allowed'
                  : state === 'deny'
                    ? 'Denied'
                    : `${formatInt(continentNodes[r])} nodes`}
              </span>
            </button>
          );
        })}
      </fieldset>

      <div className={styles.addRow}>
        <Select
          label="Add a country"
          options={selectOptions}
          placeholder={mode === 'allow' ? 'Allow a country' : 'Deny a country'}
          value=""
          onValueChange={(cc) => {
            if (cc) onCountry(cc);
          }}
          className={styles.selectField}
        />
        <TextField
          label="Or type an entry"
          mono
          placeholder="acEU_DE"
          value={typed}
          onValueChange={(v) => {
            setTyped(v);
            if (typedError) setTypedError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTyped();
            }
          }}
          error={typedError ?? undefined}
          suffix={
            <Button size="sm" variant="ghost" onClick={addTyped} aria-label="Add the typed entry">
              Add
            </Button>
          }
          className={styles.typedField}
        />
      </div>

      <div className={styles.tokens}>
        <h3 className={styles.sectionTitle}>Your geolocation</h3>
        {analysis.tokens.length === 0 ? (
          <p className={styles.emptyTokens}>
            <code>[]</code> means no restriction: every node is eligible.
          </p>
        ) : (
          <ul className={styles.tokenList} aria-label="Geolocation entries">
            {analysis.tokens.map((t) => {
              const info = describeToken(t);
              return (
                <li key={t} data-mode={info.mode} data-bad={info.problems.length > 0 ? 'true' : undefined}>
                  <code>{t}</code>
                  <span className={styles.words}>{tokenWords(t)}</span>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => remove(t)}
                    aria-label={`Remove ${t}`}
                  >
                    <Glyph name="close" size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className={styles.json}>
          <code>{geolocationJson(tokens)}</code>
          <Button
            size="sm"
            variant="ghost"
            icon="copy"
            onClick={async () => {
              const ok = await copyText(geolocationJson(tokens));
              toast(ok ? 'Copied the geolocation field.' : 'Could not copy. Select the text and copy it.');
            }}
          >
            Copy
          </Button>
        </div>
      </div>

      {props.counts ? (
        <div className={styles.counts}>
          <dl className={styles.stats}>
            <div className={styles.stat} data-health={health}>
              <dt>Nodes that match</dt>
              <dd>
                <span className={styles.big}>{formatInt(elig.eligible)}</span>
              </dd>
              <dd className={styles.sub}>
                {tokens.length === 0
                  ? 'No restriction: every node, located or not.'
                  : `of ${formatInt(elig.of)} nodes on the network`}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Share of the network</dt>
              <dd>
                <span className={styles.big}>
                  {formatShare(elig.share, elig.share > 0 && elig.share < 0.1 ? 1 : 0)}
                </span>
              </dd>
              <dd className={styles.sub}>
                {elig.unresolved > 0
                  ? `${formatInt(elig.unresolved)} nodes have no location this table can resolve. The network counts them as candidates for every rule, so registration does too. `
                  : ''}
                A region entry matches only nodes whose region is known.
              </dd>
            </div>
          </dl>
          <p className={styles.fresh}>
            <FreshnessChip kind={freshnessKind(geo.status)} ageMs={age} />
            <span>
              {live ? 'Counts come from the live node locations.' : `${chip.sentence} Counts are not live.`}
            </span>
          </p>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <ul className={styles.warnings} aria-label="Things to check">
          {warnings.map((w) => (
            <li key={w.id} data-tone={w.tone}>
              <Glyph name={WARNING_ICON[w.tone]} size={16} />
              <span>{w.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {props.target ? (
        <p className={styles.goal} data-met={met ? 'true' : 'false'}>
          <Chip kind="status" status={met ? 'ok' : 'pending'} size="sm">
            {met ? 'Matches the brief' : 'Not there yet'}
          </Chip>
          <span>
            {met
              ? 'This set matches what the task asks for.'
              : 'Build the set the task describes. Entries are compared exactly, in any order.'}
          </span>
        </p>
      ) : null}
    </Panel>
  );
};

export default GeoPicker;
