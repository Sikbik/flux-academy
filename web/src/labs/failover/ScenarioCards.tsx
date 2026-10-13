/**
 * The scenario menu: four set-ups, each with the one sentence it teaches and a "Try it" button that
 * configures the bench (instances, allowed regions), clears the counters and starts traffic. The chosen
 * scenario expands to show what to do next.
 */
import { Button, Chip } from '@/ui';
import styles from './ScenarioCards.module.css';
import { SCENARIOS, type Scenario, type ScenarioId } from './scenarios';

export interface DrawTally {
  /** Times instances were placed since the scenario started. */
  draws: number;
  /** Draws where every instance landed on one continent. */
  oneContinent: number;
  /** The latest draw in words. */
  last: string;
}

export interface ScenarioCardsProps {
  active: ScenarioId | null;
  tally: DrawTally;
  onTry: (scenario: Scenario) => void;
}

export function ScenarioCards({ active, tally, onTry }: ScenarioCardsProps) {
  return (
    <section className={styles.root} aria-labelledby="failover-scenarios">
      <h2 id="failover-scenarios" className="sr-only">
        Scenarios
      </h2>
      <ul className={styles.cards}>
        {SCENARIOS.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id} className={styles.item}>
              <article className={styles.card} data-active={on ? '' : undefined}>
                <h3 className={styles.name}>{s.title}</h3>
                <p className={styles.teaches}>{s.teaches}</p>
                {on ? (
                  <div className={styles.more}>
                    <ol className={styles.steps}>
                      {s.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    {s.id === 'two-continents' && tally.draws > 0 ? (
                      <p className={styles.tally}>
                        <strong>
                          {tally.oneContinent} of {tally.draws}
                        </strong>{' '}
                        {tally.draws === 1 ? 'draw' : 'draws'} put every instance on one continent. This draw:{' '}
                        {tally.last}.
                      </p>
                    ) : null}
                    {s.evidence ? <p className={styles.evidence}>{s.evidence}</p> : null}
                  </div>
                ) : null}
                <div className={styles.foot}>
                  <Chip size="sm" tone={on ? 'accent' : 'neutral'}>
                    {s.tag}
                  </Chip>
                  <Button
                    size="sm"
                    variant={on ? 'secondary' : 'primary'}
                    icon={on ? 'restart' : 'play'}
                    onClick={() => onTry(s)}
                  >
                    {on ? 'Start again' : 'Try it'}
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
