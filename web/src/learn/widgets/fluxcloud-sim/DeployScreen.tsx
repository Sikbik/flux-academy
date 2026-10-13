/**
 * "Registration Successful!" then "Deployment Successful!" (FACTS 9.4.4 row 8) as a watchable timeline of
 * what the network does after payment (FACTS 6.1). Simulated time runs about twenty times faster than the
 * real thing; the clock shows the simulated time, and there is a pause, a step and a skip.
 *
 * "Deployment Successful!" appears when FluxCloud's watcher first lists ONE running copy (FACTS 6.6), so the
 * timeline keeps going after it until every copy and domain is up. With no copy at all the watcher gives up
 * after 30 minutes.
 */
import { FDM_FETCH_SEC, UI_WATCHER_MIN, UI_WATCHER_POLL_SEC } from '@shared/flux';
import { useEffect, useMemo, useRef } from 'react';
import { Button, Glyph, type GlyphName, Progress } from '@/ui';
import { useSimEnv } from './context';
import styles from './FluxcloudSim.module.css';
import type { DeployClock } from './flow';
import { PageTitle } from './Parts';
import { clock, eventsUntil, runningAt, type Timeline, type TimelineKind } from './timeline';

/** Simulated seconds per real second at the default speed. */
export const SPEED = 20;
const TICK_MS = 100;

const GLYPH: Record<TimelineKind, GlyphName> = {
  paid: 'price',
  block: 'block',
  listed: 'list',
  chosen: 'node',
  installing: 'container',
  running: 'status-ok',
  domain: 'globe',
  done: 'check',
};

interface DeployScreenProps {
  timeline: Timeline;
  deploy: DeployClock;
  onTick: (dt: number) => void;
  onSeek: (t: number) => void;
  onPlaying: (on: boolean) => void;
  onSkip: () => void;
  onManage: () => void;
  appName: string;
}

export function DeployScreen({
  timeline,
  deploy,
  onTick,
  onSeek,
  onPlaying,
  onSkip,
  onManage,
  appName,
}: DeployScreenProps) {
  const { reducedMotion, announce } = useSimEnv();
  const ended = deploy.length > 0 && deploy.t >= deploy.length;
  const watcherDone = deploy.length > 0 && deploy.t >= (deploy.successAt ?? deploy.length);
  const finished = watcherDone && timeline.outcome === 'success';
  const timedOut = watcherDone && timeline.outcome === 'timed-out';
  const speed = Math.max(SPEED, timeline.length / 18);

  // The simulated clock.
  const tickRef = useRef(onTick);
  tickRef.current = onTick;
  useEffect(() => {
    if (!deploy.playing || reducedMotion) return;
    const id = window.setInterval(() => tickRef.current((TICK_MS / 1000) * speed), TICK_MS);
    return () => window.clearInterval(id);
  }, [deploy.playing, reducedMotion, speed]);

  const shown = useMemo(() => eventsUntil(timeline, deploy.t), [timeline, deploy.t]);
  const running = runningAt(timeline, deploy.t);
  const total = timeline.nodes.length;
  const next = timeline.events.find((e) => e.at > deploy.t);

  // Tell assistive tech about each new event, politely.
  const said = useRef(0);
  useEffect(() => {
    if (shown.length <= said.current) return;
    const fresh = shown.slice(said.current);
    said.current = shown.length;
    const last = fresh[fresh.length - 1];
    if (last) announce(`${clock(last.at)}: ${last.title}.`);
  }, [shown, announce]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <PageTitle screenKey="deploy">
            {finished ? 'Deployment Successful!' : 'Registration Successful!'}
          </PageTitle>
          <p className={styles.pageSub}>
            {timedOut
              ? 'Payment monitoring timed out. Please check your application status.'
              : finished
                ? ended
                  ? `${appName} is running, in this simulation.`
                  : 'FluxCloud lists one running copy, which is all its watcher checks. The other copies and the domains are still coming up.'
                : 'The payment is in. Nodes now find the app and install it on their own.'}
          </p>
        </div>
        {finished || timedOut ? (
          <Button variant="primary" icon="arrow-right" onClick={onManage}>
            Manage Application
          </Button>
        ) : null}
      </div>

      <div className={styles.clockBar}>
        <div className={styles.clockFace} aria-hidden="true">
          <span className={styles.clockNum}>{clock(deploy.t)}</span>
          <span className={styles.clockLabel}>simulated time since payment</span>
        </div>
        <div className={styles.clockMain}>
          <Progress
            variant="bar"
            label="Deployment progress"
            value={deploy.length === 0 ? 0 : deploy.t / deploy.length}
            valueText={`${running} of ${total} copies running`}
            showValue={false}
            tone={ended && finished ? 'ok' : undefined}
          />
          <p className={styles.fineprint}>
            {ended
              ? `Deployment time: Up to 45 min after payment. That line is a fixed label on the screen, not a timer. This run took about ${clock(deploy.length)} of simulated time.`
              : reducedMotion
                ? 'Deployment time: Up to 45 min after payment. That line is a fixed label, not a timer. Motion is reduced, so the timeline does not play by itself: step through it with Next event.'
                : `Deployment time: Up to 45 min after payment. That line is a fixed label, not a timer. Here the run is about ${Math.round(speed)} times faster than real time.`}
          </p>
          <p className={styles.fineprint}>
            FluxCloud watches for {UI_WATCHER_MIN} minutes and checks every {UI_WATCHER_POLL_SEC} seconds. If
            no copy shows up by then it says "Payment monitoring timed out. Please check your application
            status." and stops watching, and the deployment carries on.
          </p>
        </div>
        <div className={styles.clockButtons}>
          {ended ? null : (
            <>
              {!reducedMotion ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={deploy.playing ? 'pause' : 'play'}
                  onClick={() => onPlaying(!deploy.playing)}
                >
                  {deploy.playing ? 'Pause' : 'Play'}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                icon="arrow-right"
                disabled={!next}
                onClick={() => next && onSeek(next.at)}
              >
                Next event
              </Button>
              <Button size="sm" variant="ghost" onClick={onSkip}>
                Skip to the end
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={styles.deployGrid}>
        <section className={styles.deployCol} aria-label="Timeline">
          <h4 className={styles.cardTitle}>What happened</h4>
          <ol className={styles.timeline}>
            {shown.map((e) => (
              <li key={e.id} className={styles.event} data-kind={e.kind}>
                <span className={styles.eventMark} aria-hidden="true">
                  <Glyph name={GLYPH[e.kind]} size={14} />
                </span>
                <div>
                  <p className={styles.eventHead}>
                    <span className={styles.eventTime}>{clock(e.at)}</span>
                    <strong>{e.title}</strong>
                  </p>
                  <p className={styles.eventText}>{e.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          {ended ? null : (
            <p className={styles.waiting}>
              <span className={styles.spinner} aria-hidden="true" />
              {next ? `Waiting for the next step: ${next.title.toLowerCase()}` : 'Finishing'}
            </p>
          )}
        </section>

        <section className={styles.deployCol} aria-label="Copies and domains">
          <h4 className={styles.cardTitle}>Copies</h4>
          <ul className={styles.copies}>
            {timeline.nodes.slice(0, 12).map((n, i) => {
              const chosen = timeline.events.find((e) => e.id === `chosen-${i + 1}`);
              const up = timeline.events.find((e) => e.id === `running-${i + 1}`);
              const state =
                up && up.at <= deploy.t
                  ? 'running'
                  : chosen && chosen.at <= deploy.t
                    ? 'installing'
                    : 'waiting';
              return (
                <li key={n.ip} className={styles.copy} data-state={state}>
                  <span className={styles.copyNum}>{i + 1}</span>
                  <span className={styles.copyMain}>
                    {state === 'waiting' ? (
                      <span className={styles.copyWait}>Waiting for a node to choose it</span>
                    ) : (
                      <>
                        <code className={styles.code}>{n.ip}</code>
                        <span className={styles.copyWhere}>
                          {n.countryName}, {n.continentName}
                        </span>
                      </>
                    )}
                  </span>
                  <span className={styles.copyState}>
                    {state === 'running' ? 'running' : state === 'installing' ? 'installing' : 'waiting'}
                  </span>
                </li>
              );
            })}
          </ul>
          {timeline.nodes.length > 12 ? (
            <p className={styles.fineprint}>and {timeline.nodes.length - 12} more copies.</p>
          ) : null}
          {timeline.nodes.length === 0 ? (
            <p className={styles.fieldError}>
              No sample location is allowed by the location rules, so this sample network places nothing. A
              real registration with such a list can still be accepted, and then nothing is promised to run.
            </p>
          ) : null}

          <h4 className={styles.cardTitle}>Domains</h4>
          <ul className={styles.domains}>
            {timeline.domains.map((d, i) => {
              const ev = timeline.events.find((e) => e.id === `domain-${i + 1}`);
              const live = ev ? ev.at <= deploy.t : false;
              return (
                <li key={d.host} className={styles.domain} data-live={live ? 'true' : 'false'}>
                  <code className={styles.code}>{d.host}</code>
                  <span className={styles.domainState}>{live ? 'live' : 'not yet'}</span>
                </li>
              );
            })}
          </ul>
          <p className={styles.fineprint}>
            The Flux Domain Manager reads the location list about every {FDM_FETCH_SEC} seconds, and one pass
            can take minutes on a busy server. The time from payment to a working address was not measured, so
            the simulator uses about a minute and a half after the first copy runs.
          </p>
        </section>
      </div>
    </div>
  );
}
