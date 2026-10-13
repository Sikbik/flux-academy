/**
 * One looked-up app, laid out the way the network reports it: whether it is fully placed, what each
 * component asks for, and where each instance runs (country, tier, masked address, when its node last
 * announced it). Enterprise apps are shown as counts only, with the reason. The call behind the page is
 * its own card, because seeing the real public request is the point.
 */
import type { ExploreApp, ExploreInstance, Meta } from '@shared/api';
import { LOCATION_TTL_MIN } from '@shared/flux/timing';
import { formatDecimal, formatInt } from '@/lib/format';
import { Chip, FreshnessChip } from '@/ui';
import { CallCard } from './CallCard';
import { maskIp, runningStatus, sinceText, summarizePlacement } from './model';
import styles from './ResultView.module.css';

export interface ResultViewProps {
  app: ExploreApp;
  meta: Meta;
  /** `Date.now()` when the answer arrived, for "5 min ago". */
  at: number;
  /** The built-in made-up app, not the network. */
  sample: boolean;
}

/** Roughly how long the subscription has left, at the 30 second block target. */
function daysLeft(blocks: number | null): string | null {
  if (blocks === null || !Number.isFinite(blocks) || blocks < 0) return null;
  const days = (blocks * 30) / 86_400;
  if (days < 1) return 'less than a day';
  return `about ${formatDecimal(days, days < 10 ? 1 : 0)} days`;
}

function ramText(mb: number): string {
  return mb >= 1000 ? `${formatDecimal(mb / 1000, mb % 1000 === 0 ? 0 : 1)} GB` : `${formatInt(mb)} MB`;
}

/** A key for each instance row: its address, with a suffix only if the network ever repeats one. */
function rowKeys(instances: readonly ExploreInstance[]): string[] {
  const seen = new Map<string, number>();
  return instances.map((i) => {
    const n = seen.get(i.ip) ?? 0;
    seen.set(i.ip, n + 1);
    return n === 0 ? i.ip : `${i.ip}#${n}`;
  });
}

function InstanceRow({ i, n, at }: { i: ExploreInstance; n: number; at: number }) {
  return (
    <tr>
      <th scope="row" data-label="Instance">
        {n}
      </th>
      <td data-label="Country">
        <span>
          <span className={styles.country}>{i.country ?? 'Unknown'}</span>
          {i.cc ? <span className={styles.cc}>{i.cc.toUpperCase()}</span> : null}
        </span>
      </td>
      <td data-label="Tier">
        {i.tier ? (
          <Chip tier={i.tier} size="sm">
            {i.tier}
          </Chip>
        ) : (
          <span className={styles.dim}>unknown</span>
        )}
      </td>
      <td data-label="Address">
        <code className={styles.ip}>{maskIp(i.ip)}</code>
      </td>
      <td data-label="Last announced" title={i.broadcastedAt ?? undefined}>
        {sinceText(i.broadcastedAt, at)}
      </td>
    </tr>
  );
}

export function ResultSummary({ app, meta, sample }: Omit<ResultViewProps, 'at'>) {
  const status = runningStatus(app);
  const left = daysLeft(app.blocksRemaining);
  const placement = summarizePlacement(app.instances);

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <h2 className={styles.name}>{app.name}</h2>
          {app.description ? <p className={styles.desc}>{app.description}</p> : null}
        </div>
        <div className={styles.chips}>
          {sample ? (
            <Chip kind="status" status="off" size="sm">
              Sample, not a real app
            </Chip>
          ) : (
            <FreshnessChip source={meta.source} ageMs={Math.max(0, meta.ageMs)} />
          )}
          <Chip
            kind="status"
            status={status.tone === 'crit' ? 'crit' : status.tone === 'warn' ? 'warn' : 'ok'}
          >
            {status.word}
          </Chip>
        </div>
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>Running now</dt>
          <dd>
            {formatInt(app.instancesRunning)} of {formatInt(app.instancesWanted)}
          </dd>
        </div>
        <div>
          <dt>Spec version</dt>
          <dd>{app.version}</dd>
        </div>
        {left ? (
          <div>
            <dt>Subscription left</dt>
            <dd title="Blocks remaining times 30 seconds">{left}</dd>
          </div>
        ) : null}
        {app.height !== null ? (
          <div>
            <dt>Registered at block</dt>
            <dd>{formatInt(app.height)}</dd>
          </div>
        ) : null}
      </dl>
      <p className={styles.sentence}>{status.sentence}</p>

      {placement.countries.length > 0 ? (
        <ul className={styles.summary} aria-label="Instances by country">
          {placement.countries.map((c) => (
            <li key={c.cc}>
              <strong>{c.name}</strong> {c.instances}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ResultDetails({ app, at, sample }: Omit<ResultViewProps, 'meta'>) {
  const keys = rowKeys(app.instances);
  const shown =
    app.instances.length > 0 ? 'how many instances run and where' : 'how many instances are running';
  return (
    <div className={styles.details}>
      {app.enterprise ? (
        <section className={styles.notice} aria-labelledby="explorer-enterprise">
          <h3 id="explorer-enterprise">Enterprise app: what it runs is private</h3>
          <p>
            Its components and contacts are encrypted on the chain, and only nodes running ArcaneOS can
            decrypt them. So this page can show {shown}, not what they run. An enterprise app trades being
            readable by everyone for privacy.
          </p>
        </section>
      ) : (
        <section className={styles.block} aria-labelledby="explorer-components">
          <h3 id="explorer-components" className={styles.h3}>
            Components
          </h3>
          {app.components.length === 0 ? (
            <p className={styles.dim}>The network returned no components for this app.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="sr-only">What each component of {app.name} asks for</caption>
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col">Image</th>
                    <th scope="col">CPU</th>
                    <th scope="col">RAM</th>
                    <th scope="col">Disk</th>
                    <th scope="col">Ports</th>
                  </tr>
                </thead>
                <tbody>
                  {app.components.map((c) => (
                    <tr key={c.name}>
                      <th scope="row">{c.name}</th>
                      <td data-label="Image">
                        <code className={styles.image}>{c.repotag}</code>
                      </td>
                      <td data-label="CPU">{formatDecimal(c.cpu, 1)} cores</td>
                      <td data-label="RAM">{ramText(c.ram)}</td>
                      <td data-label="Disk">{formatInt(c.hdd)} GB</td>
                      <td data-label="Ports">{c.ports.length > 0 ? c.ports.join(', ') : 'none'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {app.instances.length > 0 ? (
        <section className={styles.block} aria-labelledby="explorer-instances">
          <h3 id="explorer-instances" className={styles.h3}>
            Where it runs
          </h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">The nodes that announce {app.name}</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Country</th>
                  <th scope="col">Tier</th>
                  <th scope="col">Address</th>
                  <th scope="col">Last announced</th>
                </tr>
              </thead>
              <tbody>
                {app.instances.map((i, k) => (
                  <InstanceRow key={keys[k] ?? i.ip} i={i} n={k + 1} at={at} />
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.fine}>
            Addresses are cut to their first two numbers. They are public on the network, but this page is for
            learning where apps run, not for finding a server. A node repeats its announcement about every
            hour and the record lapses after {LOCATION_TTL_MIN} minutes, so "last announced" is a heartbeat,
            not the time the app was installed.
          </p>
        </section>
      ) : app.enterprise ? null : (
        <section className={styles.notice}>
          <h3>No instance is announcing right now</h3>
          <p>
            That can mean the app is still being installed, that its nodes went offline and a replacement has
            not started, or that the subscription ran out.
          </p>
        </section>
      )}

      <CallCard name={app.name} docs={app.docs} sample={sample} />
    </div>
  );
}
