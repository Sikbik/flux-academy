import { LIMITS, parseGeolocationEntry } from '@shared/flux';
import { useMemo, useState } from 'react';
import { anchor } from '@/content/reference';
import { describeGeoEntry, formatGeoEntry, geoRoundTrips } from '@/content/reference/derive';
import { GEO_SETS } from '@/content/reference/examples';
import { buildGeoForms, buildGeoPitfalls } from '@/content/reference/spec';
import { continentName, geoVerdict } from '@/content/reference/tools';
import { Chip, Select, StatusDot, TextArea, TextField } from '@/ui';
import { type Column, DataTable, Slab } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { KeyFact, Md, P } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Group, Ul } from '../../parts/Semantics';
import styles from './spec.module.css';

const FORMS = buildGeoForms();
const PITFALLS = buildGeoPitfalls();

/** What the parser makes of an entry, in a few words. */
function readEntry(raw: string): string {
  const e = parseGeolocationEntry(raw);
  if (e.kind === 'unknown') return 'not understood';
  const parts = [e.continent, e.country, e.region].filter((p): p is string => !!p);
  return `${e.kind}${parts.length > 0 ? `: ${parts.join(' / ')}` : ''}`;
}

export function Geolocation() {
  return (
    <>
      <Section id="geolocation">
        <KeyFact label="The rule">
          <p>
            An empty list means no restriction. Otherwise a node qualifies when{' '}
            <strong>no deny entry matches it</strong> and, if there is any allow entry,{' '}
            <strong>at least one allow entry does</strong>. Up to {LIMITS.geolocation.maxCount} entries of up
            to {LIMITS.geolocation.maxLength} characters each.
          </p>
        </KeyFact>

        <Slab>
          <Ul className={styles.pitfalls}>
            {PITFALLS.map((p) => {
              const id = anchor.geoPitfall(p.id);
              return (
                <li key={p.id} id={id} className={styles.pitfall}>
                  <div className={styles.pitfallHead}>
                    <code className={styles.pitfallEntry}>{p.entry}</code>
                    <CopyLink id={id} label={p.entry} />
                  </div>
                  <P text={p.text} className={styles.pitfallText} />
                  <ProvChips prov={p.prov} />
                </li>
              );
            })}
          </Ul>
        </Slab>
      </Section>

      <Section id="geolocation-forms">
        <FormsTable />
      </Section>

      <Section id="geolocation-try">
        <GeoTry />
      </Section>
    </>
  );
}

function FormsTable() {
  const columns: Column<(typeof FORMS)[number]>[] = [
    {
      id: 'form',
      label: 'Form',
      primary: true,
      mono: true,
      render: (f) => (
        <span className={styles.formCell}>
          <code>{f.pattern}</code>
          <CopyLink id={anchor.geoForm(f.id)} label={f.pattern} />
        </span>
      ),
    },
    { id: 'example', label: 'Example', mono: true, render: (f) => <code>{f.example}</code> },
    {
      id: 'parsed',
      label: 'The parser reads it as',
      mono: true,
      render: (f) => <span className={styles.parsed}>{readEntry(f.example)}</span>,
    },
    {
      id: 'meaning',
      label: 'Meaning',
      render: (f) => (
        <>
          <p>
            <Md text={f.meaning} />
          </p>
          {f.note ? (
            <p className={styles.cellNote}>
              <Md text={f.note} />
            </p>
          ) : null}
        </>
      ),
    },
    {
      id: 'roundtrip',
      label: 'Writes back',
      render: (f) =>
        geoRoundTrips(f.example) ? (
          <span className={styles.ok}>
            <StatusDot status="ok" />
            <span>
              Same entry
              <span className="sr-only">: it parses and writes back unchanged</span>
            </span>
          </span>
        ) : (
          <span className={styles.warn}>
            <StatusDot status="warn" />
            <span>Differs</span>
          </span>
        ),
    },
  ];
  return (
    <>
      <DataTable
        caption="Accepted forms of a geolocation entry"
        columns={columns}
        rows={FORMS}
        rowId={(f) => anchor.geoForm(f.id)}
      />
      <p className={styles.tableNote}>
        Continent codes are {LIMITS.geolocation.continents.join(', ')}. The examples are parsed and written
        back by the engine when the page is drawn.
      </p>
    </>
  );
}

const CONTINENT_OPTIONS = LIMITS.geolocation.continents.map((c) => ({
  value: c,
  label: `${continentName(c)} (${c})`,
}));

function GeoTry() {
  const [text, setText] = useState(GEO_SETS[0]?.entries.join('\n') ?? '');
  const [continent, setContinent] = useState('EU');
  const [country, setCountry] = useState('DE');
  const [region, setRegion] = useState('');

  const entries = useMemo(
    () =>
      text
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [text],
  );
  const parsed = useMemo(() => entries.map((raw) => parseGeolocationEntry(raw)), [entries]);
  const verdict = useMemo(
    () =>
      geoVerdict(entries, {
        continent,
        country: country.trim().toUpperCase(),
        region: region.trim() || undefined,
      }),
    [entries, continent, country, region],
  );
  const where = `${country.trim().toUpperCase() || 'no country'} (${continentName(continent)})`;

  return (
    <div className={styles.tool}>
      <Group className={styles.toolRow} label="Example lists">
        {GEO_SETS.map((s) => (
          <Chip
            key={s.id}
            kind="filter"
            size="sm"
            selected={text.trim() === s.entries.join('\n')}
            onClick={() => setText(s.entries.join('\n'))}
          >
            {s.label}
          </Chip>
        ))}
      </Group>

      <div className={styles.toolGrid}>
        <div className={styles.toolCol}>
          <TextArea
            label="geolocation entries"
            hint="One per line, or separated by commas."
            mono
            rows={4}
            value={text}
            onValueChange={setText}
            spellCheck={false}
          />
          <Slab>
            <Ul className={styles.parseList} aria-label="How each entry reads">
              {parsed.length === 0 ? (
                <li className={styles.parseEmpty}>No entries. An empty list means no restriction.</li>
              ) : (
                parsed.map((p, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: entries may repeat, the order is the identity
                    key={i}
                    className={styles.parseItem}
                    data-bad={p.kind === 'unknown' ? 'true' : undefined}
                  >
                    <code className={styles.parseRaw}>{p.raw}</code>
                    <span className={styles.parseText}>
                      {p.kind === 'unknown'
                        ? 'Not an entry the network is documented to understand. What it does with it is not documented: assume it matches nothing.'
                        : describeGeoEntry(p)}
                      {p.problems.map((m) => (
                        <span key={m} className={styles.parseProblem}>
                          {' '}
                          {m}
                        </span>
                      ))}
                      {p.kind !== 'unknown' && formatGeoEntry(p) !== p.raw ? (
                        <span className={styles.parseProblem}>
                          {' '}
                          It is written back as {formatGeoEntry(p)}.
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))
              )}
            </Ul>
          </Slab>
        </div>

        <div className={styles.toolCol}>
          <p className={styles.detailLabel}>Would a node here qualify?</p>
          <div className={styles.placeGrid}>
            <Select
              label="Continent"
              options={CONTINENT_OPTIONS}
              value={continent}
              onValueChange={setContinent}
            />
            <TextField
              label="Country code"
              hint="Two letters, such as DE."
              mono
              maxLength={2}
              value={country}
              onValueChange={setCountry}
            />
            <TextField
              label="Region code"
              hint="Optional, such as BY."
              mono
              value={region}
              onValueChange={setRegion}
            />
          </div>
          <Slab padded>
            <div className={styles.verdict} role="status" data-ok={verdict.qualifies ? 'true' : 'false'}>
              <p className={styles.verdictHead}>
                <StatusDot status={verdict.qualifies ? 'ok' : 'crit'} />
                <span>
                  A node in {where}: <strong>{verdict.qualifies ? 'qualifies' : 'does not qualify'}</strong>
                </span>
              </p>
              <Ul className={styles.reasons}>
                {verdict.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
                {verdict.skipped.map((s) => (
                  <li key={s.entry}>
                    <code>{s.entry}</code> is not evaluated here. {s.why}
                  </li>
                ))}
              </Ul>
            </div>
          </Slab>
        </div>
      </div>
    </div>
  );
}
