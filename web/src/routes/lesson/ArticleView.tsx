/**
 * The article view (`?view=article`): the whole lesson on one page, in reading order, with every stage
 * shown as a static figure. It is also what a printout and a reader without the interactive stages get
 * (docs/DESIGN.md sections 5.4 and 11): the lesson is fully readable without a single stage running.
 *
 * Nothing here records progress. Answers to the checkpoint are shown, since this is a reading copy.
 */

import { type LessonMeta, labById, trackById } from '@shared/curriculum';
import { Link, useSearchParams } from 'react-router';
import { useDocumentMeta } from '@/app/meta';
import { describeCheck } from '@/learn/checks';
import { getTerm } from '@/learn/glossary';
import { estimateTruth } from '@/learn/grade';
import { MarkupText } from '@/learn/MarkupText';
import { CodeView } from '@/learn/parts/CodeView';
import type { Challenge, DioramaStage, Lesson, Stage, TerminalScript } from '@/learn/types';
import { useEngine } from '@/learn/useEngine';
import { Chip, Glyph } from '@/ui';
import styles from './ArticleView.module.css';
import { Callouts } from './Callouts';
import { formatTruth, isPriced } from './challenges/Estimate';

const SCENE_TEXT: Record<DioramaStage['scene'], string> = {
  tiers: 'The three node tiers on a map of the network, each node coloured by its tier.',
  placement: 'Instances being placed on distinct nodes across regions.',
  failover: 'Instances on nodes you can kill and revive, with requests finding a node that is still up.',
  traffic: 'A user, a domain, a proxy and instances, with the ports and domains labelled.',
  sync: 'A volume with a primary and standbys: kill the primary and a standby is promoted.',
  deploy: 'The whole deployment pipeline as an animation, from the spec to a live app.',
  network: 'The real, live network, with a country hover and a tier filter.',
};

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function goalExamples(script: TerminalScript): string[] {
  const out: string[] = [];
  for (const g of script.goals) {
    const cmd = script.commands.find((c) => c.goal === g.id && c.example);
    out.push(cmd?.example ?? '');
  }
  return out;
}

function StaticStage({ stage }: { stage: Stage }) {
  switch (stage.kind) {
    case 'code':
      return <CodeView files={stage.files} label="Source files" />;
    case 'compare':
      return (
        <div className={styles.compare}>
          {[stage.left, stage.right].map((side, i) => (
            <section
              // biome-ignore lint/suspicious/noArrayIndexKey: exactly two sides
              key={i}
              className={styles.side}
              data-tone={side.tone ?? 'neutral'}
            >
              <h4>
                <MarkupText text={side.label} plain />
              </h4>
              {side.code ? (
                <CodeView
                  bare
                  files={[{ name: 'snippet', lang: (side.lang as 'text') ?? 'text', code: side.code }]}
                />
              ) : null}
              {side.body ? (
                <p>
                  <MarkupText text={side.body} />
                </p>
              ) : null}
            </section>
          ))}
        </div>
      );
    case 'spec':
      return (
        <CodeView
          files={[{ name: 'app-spec.json', lang: 'json', code: json(stage.spec) }]}
          label="The spec shown in the editor, starting values"
        />
      );
    case 'terminal':
      return (
        <div className={styles.note}>
          <p className={styles.noteHead}>
            <Glyph name="terminal" size={16} /> Terminal (simulation)
          </p>
          <ol>
            {stage.script.goals.map((g, i) => {
              const example = goalExamples(stage.script)[i];
              return (
                <li key={g.id}>
                  <MarkupText text={g.label} />
                  {example ? <code className={styles.cmd}>{example}</code> : null}
                </li>
              );
            })}
          </ol>
        </div>
      );
    case 'diorama':
      return (
        <div className={styles.note}>
          <p className={styles.noteHead}>
            <Glyph name="globe" size={16} /> Diorama: {stage.scene}
          </p>
          <p>{SCENE_TEXT[stage.scene]}</p>
          {stage.controls && stage.controls.length > 0 ? <p>Controls: {stage.controls.join(', ')}.</p> : null}
        </div>
      );
    case 'diagram':
      return (
        <div className={styles.note}>
          <p className={styles.noteHead}>
            <Glyph name="layers" size={16} /> Diagram: {stage.id.replace(/-/g, ' ')}
            {stage.beat !== undefined ? `, beat ${stage.beat + 1}` : ''}
          </p>
          <p>An animated diagram. Open the interactive lesson to see it move.</p>
        </div>
      );
    case 'widget':
      return (
        <div className={styles.note}>
          <p className={styles.noteHead}>
            <Glyph name="sliders" size={16} /> Interactive: {stage.id.replace(/-/g, ' ')}
          </p>
          <p>This exercise runs in the interactive lesson.</p>
        </div>
      );
  }
}

function ArticleChallenge({ challenge, index }: { challenge: Challenge; index: number }) {
  const engine = useEngine();
  // Worked out on the baked rate card, as the player grades it, and said to be: a price is "at the rates read
  // on" a date, the way the lesson text quotes it.
  const truth = challenge.kind === 'estimate' && engine ? estimateTruth(challenge, engine) : null;
  const rates =
    challenge.kind === 'estimate' && engine && isPriced(challenge)
      ? `, at the rates read on ${engine.baked.capturedAt}`
      : '';
  return (
    <section className={styles.challenge} aria-labelledby={`ch-${challenge.id}`}>
      <h3 id={`ch-${challenge.id}`} className={styles.h3}>
        <span className={styles.num}>{index + 1}</span>
        <MarkupText text={challenge.prompt} plain />
      </h3>

      {challenge.kind === 'choice' || challenge.kind === 'multi' ? (
        <ul className={styles.options}>
          {challenge.options.map((o) => {
            const right =
              challenge.kind === 'choice' ? o.id === challenge.answer : challenge.answers.includes(o.id);
            return (
              <li key={o.id} data-right={right ? 'true' : undefined}>
                <Glyph name={right ? 'check' : 'close'} size={14} />
                <span>
                  <MarkupText text={o.label} />
                  <span className="sr-only">{right ? '. Correct' : '. Not correct'}</span>
                  {o.why && !right ? (
                    <em className={styles.why}>
                      {' '}
                      <MarkupText text={o.why} />
                    </em>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {challenge.kind === 'order' ? (
        <ol className={styles.options}>
          {challenge.items.map((it) => (
            <li key={it.id}>
              <MarkupText text={it.label} />
            </li>
          ))}
        </ol>
      ) : null}

      {challenge.kind === 'match' ? (
        <ul className={styles.options}>
          {challenge.pairs.map((p) => (
            <li key={p.id}>
              <span>
                <MarkupText text={p.left} plain /> goes with <MarkupText text={p.right} plain />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {challenge.kind === 'spec-fix' ? (
        <>
          <CodeView
            files={[{ name: 'spec-with-problems.json', lang: 'json', code: json(challenge.spec) }]}
            label="The spec to fix"
          />
          <p className={styles.small}>It passes when: {describeCheck(challenge.check)}</p>
        </>
      ) : null}

      {challenge.kind === 'spec-build' ? (
        <>
          <ul className={styles.options}>
            {challenge.requirements.map((r) => (
              <li key={r.id}>
                <Glyph name="check" size={14} />
                <MarkupText text={r.label} />
              </li>
            ))}
          </ul>
          <CodeView
            files={[{ name: 'starting-spec.json', lang: 'json', code: json(challenge.spec) }]}
            label="The starting spec"
          />
        </>
      ) : null}

      {challenge.kind === 'terminal' ? (
        <ol className={styles.options}>
          {challenge.goals.map((g) => {
            const goal = challenge.script.goals.find((x) => x.id === g);
            const example = challenge.script.commands.find((c) => c.goal === g && c.example)?.example;
            return (
              <li key={g}>
                <span>
                  <MarkupText text={goal?.label ?? g} />
                  {example ? <code className={styles.cmd}>{example}</code> : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {challenge.kind === 'estimate' ? (
        <>
          {challenge.spec ? (
            <CodeView
              files={[{ name: 'app-spec.json', lang: 'json', code: json(challenge.spec) }]}
              label="The spec to price"
            />
          ) : null}
          <p className={styles.small}>
            {truth !== null
              ? `Answer: ${formatTruth(challenge, truth)}${rates}.`
              : 'The answer is worked out in the interactive lesson.'}
          </p>
        </>
      ) : null}

      <p className={styles.explain}>
        <strong>Why: </strong>
        <MarkupText text={challenge.explain} />
      </p>
    </section>
  );
}

export interface ArticleViewProps {
  lesson: Lesson;
  meta: LessonMeta;
  fixture: boolean;
}

export function ArticleView({ lesson, meta }: ArticleViewProps) {
  useDocumentMeta({ title: `${meta.title}, article view`, description: meta.summary });
  const [params] = useSearchParams();
  const step = params.get('step');
  const track = trackById(meta.track);
  const labs = meta.labs.map((id) => labById(id)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  const terms = lesson.terms.map((id) => getTerm(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const interactive = { pathname: `/learn/${lesson.id}`, search: step ? `?step=${step}` : '' };

  return (
    <article className={styles.article}>
      <header className={styles.head}>
        <p className={styles.bar}>
          <Link className={styles.back} to="/learn">
            <Glyph name="arrow-left" size={14} />
            Course map
          </Link>
          <Link className={styles.interactive} to={interactive}>
            Open the interactive lesson
            <Glyph name="arrow-right" size={14} />
          </Link>
        </p>
        <p className={styles.eyebrow}>
          <Chip tier={meta.track} size="sm">
            {track.name}
          </Chip>
          <span>{meta.module}</span>
          <span>{meta.minutes} min</span>
          <span>Article view</span>
        </p>
        <h1 className={styles.h1}>{meta.title}</h1>
        <p className={styles.hook}>
          <MarkupText text={lesson.hook} />
        </p>
        <h2 className={styles.h2small}>You will be able to</h2>
        <ul className={styles.objectives}>
          {lesson.objectives.map((o) => (
            <li key={o}>
              <MarkupText text={o} />
            </li>
          ))}
        </ul>
      </header>

      {lesson.steps.map((s, i) => (
        <section key={s.id} id={s.id} className={styles.step} aria-labelledby={`h-${s.id}`}>
          <h2 id={`h-${s.id}`} className={styles.h2}>
            <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
            <MarkupText text={s.title} plain />
          </h2>
          {s.body.map((p) => (
            <p key={p} className={styles.p}>
              <MarkupText text={p} />
            </p>
          ))}
          {s.callouts && s.callouts.length > 0 ? <Callouts callouts={s.callouts} /> : null}
          {s.stage ? (
            <figure className={styles.figure}>
              <StaticStage stage={s.stage} />
            </figure>
          ) : null}
          {s.task && s.task.kind !== 'read' ? (
            <p className={styles.task}>
              <strong>Try it: </strong>
              <MarkupText text={s.task.prompt} />
            </p>
          ) : null}
        </section>
      ))}

      {lesson.checkpoint.length > 0 ? (
        <section className={styles.checkpoint} aria-labelledby="h-checkpoint">
          <h2 id="h-checkpoint" className={styles.h2}>
            Checkpoint
          </h2>
          {lesson.checkpoint.map((c, i) => (
            <ArticleChallenge key={c.id} challenge={c} index={i} />
          ))}
        </section>
      ) : null}

      <section className={styles.step} aria-labelledby="h-recap">
        <h2 id="h-recap" className={styles.h2}>
          What to keep
        </h2>
        <ul className={styles.objectives}>
          {lesson.recap.map((r) => (
            <li key={r}>
              <MarkupText text={r} />
            </li>
          ))}
        </ul>
      </section>

      {terms.length > 0 ? (
        <section className={styles.step} aria-labelledby="h-terms">
          <h2 id="h-terms" className={styles.h2}>
            Terms in this lesson
          </h2>
          <dl className={styles.terms}>
            {terms.map((t) => (
              <div key={t.id}>
                <dt>{t.term}</dt>
                <dd>
                  <MarkupText text={t.short} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {lesson.further.length > 0 || labs.length > 0 ? (
        <section className={styles.step} aria-labelledby="h-further">
          <h2 id="h-further" className={styles.h2}>
            Go further
          </h2>
          <ul className={styles.objectives}>
            {labs.map((l) => (
              <li key={l.id}>
                <Link to={`/labs/${l.id}`}>{l.title}</Link> (lab)
              </li>
            ))}
            {lesson.further.map((f) => (
              <li key={f.url}>
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  {f.label}
                  <span className="sr-only">. Opens in a new tab</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
