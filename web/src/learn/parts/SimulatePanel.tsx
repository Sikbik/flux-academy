/**
 * Development only. When a stage has not landed, this stands in for the events it would send, so a
 * lesson's task gating, feedback, "Show me" and checkpoint can be exercised end to end. It is never in a
 * production build (`import.meta.env.DEV`), and it registers a solver so "Show me" takes the same path
 * a real stage's does.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/ui';
import { specFacts } from '../engine';
import { applySolution, buildSpec } from '../specs';
import type { StageHost, TaskEvent } from '../stage-api';
import type { Stage, Task } from '../types';
import { useEngine } from '../useEngine';
import styles from './SimulatePanel.module.css';

export interface SimulatePanelProps {
  stage: Stage;
  host: StageHost;
  task?: Task;
}

export function SimulatePanel({ stage, host, task }: SimulatePanelProps) {
  const engine = useEngine();
  const kills = useRef(0);
  const requests = useRef(0);
  const [value, setValue] = useState(3);
  const [log, setLog] = useState<string[]>([]);

  const say = useCallback(
    (e: TaskEvent) => {
      setLog((l) => [
        ...l.slice(-3),
        e.type + ('value' in e ? ` ${e.value}` : 'count' in e ? ` ${e.count}` : ''),
      ]);
      host.emit(e);
    },
    [host],
  );

  const specEvent = useCallback(
    (solved: boolean): TaskEvent | null => {
      if (!engine || stage.kind !== 'spec') return null;
      const start = buildSpec(engine, stage.spec);
      const spec = solved && task?.kind === 'spec' ? applySolution(engine, start, task.solution) : start;
      const f = specFacts(engine, spec);
      return {
        type: 'spec',
        spec: f.spec,
        valid: f.lint?.valid ?? true,
        issueCodes: f.lint?.codes.slice() ?? [],
        usdPerMonth: f.usdPerMonth,
      };
    },
    [engine, stage, task],
  );

  // A solver, so "Show me" exercises the same path as a real stage.
  const solveRef = useRef<() => void>(() => {});
  solveRef.current = () => {
    if (!task) return;
    switch (task.kind) {
      case 'set-instances':
        say({ type: 'instances', value: task.exactly ?? task.min ?? 3 });
        break;
      case 'kill-nodes':
        kills.current = task.count;
        say({ type: 'node-killed', count: task.count });
        break;
      case 'send-requests':
        requests.current = task.count;
        say({ type: 'request-sent', count: task.count });
        break;
      case 'terminal':
        for (const g of task.goals) say({ type: 'terminal-goal', goalId: g });
        break;
      case 'widget':
        say({ type: 'widget-done' });
        break;
      case 'spec': {
        const e = specEvent(true);
        if (e) say(e);
        break;
      }
      default:
        break;
    }
  };
  useEffect(() => {
    host.registerSolver(() => solveRef.current());
    return () => host.registerSolver(null);
  }, [host]);

  if (!task || task.kind === 'read' || task.kind === 'confirm') return null;

  return (
    <fieldset className={styles.sim}>
      <legend className={styles.label}>Development: simulate this stage</legend>
      <div className={styles.row}>
        {task.kind === 'set-instances' ? (
          <>
            <label className={styles.field}>
              <span>Instances</span>
              <input
                type="number"
                min={1}
                max={100}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </label>
            <Button size="sm" onClick={() => say({ type: 'instances', value })}>
              Send
            </Button>
          </>
        ) : null}
        {task.kind === 'kill-nodes' ? (
          <Button
            size="sm"
            onClick={() => {
              kills.current += 1;
              say({ type: 'node-killed', count: kills.current });
            }}
          >
            Kill a node
          </Button>
        ) : null}
        {task.kind === 'send-requests' ? (
          <Button
            size="sm"
            onClick={() => {
              requests.current += 1;
              say({ type: 'request-sent', count: requests.current });
            }}
          >
            Send a request
          </Button>
        ) : null}
        {task.kind === 'terminal'
          ? task.goals.map((g) => (
              <Button key={g} size="sm" onClick={() => say({ type: 'terminal-goal', goalId: g })}>
                Complete {g}
              </Button>
            ))
          : null}
        {task.kind === 'widget' ? (
          <Button size="sm" onClick={() => say({ type: 'widget-done' })}>
            Widget done
          </Button>
        ) : null}
        {task.kind === 'spec' ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={!engine}
              onClick={() => {
                const e = specEvent(false);
                if (e) say(e);
              }}
            >
              Send the starting spec
            </Button>
            <Button
              size="sm"
              disabled={!engine}
              onClick={() => {
                const e = specEvent(true);
                if (e) say(e);
              }}
            >
              Send the solution
            </Button>
          </>
        ) : null}
      </div>
      {log.length > 0 ? <p className={styles.log}>Sent: {log.join(', ')}</p> : null}
    </fieldset>
  );
}
