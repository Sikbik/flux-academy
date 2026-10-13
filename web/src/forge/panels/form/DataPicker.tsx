/**
 * Storage: where the container keeps data and what happens to it when a node is lost. The three honest
 * choices are a plain volume (one node), `r:` (a copy on every instance, all of them write) and `g:` (a copy
 * on every instance, one primary runs). The meaning of each is stated under the picker, in the words of
 * FACTS section 7.2, so the choice is made with the consequence in view.
 *
 * `s:` and flag combinations are shown as what they are, "not documented", and never offered as a choice.
 */

import { LIMITS } from '@shared/flux/spec';
import type { FluxComponentSpec } from '@shared/flux/types';
import { useForgeUi } from '../../context';
import { Choice } from '../../controls/Choice';
import controls from '../../controls/controls.module.css';
import { Field } from '../../controls/Field';
import { TextInput } from '../../controls/inputs';
import { type DataPrefix, readContainerData, writeContainerData } from '../../model';
import styles from './form.module.css';

const MEANING: Record<DataPrefix, { title: string; body: string }> = {
  '': {
    title: 'A volume on one node',
    body: 'It survives restarts and soft redeploys. It is lost when the node fails, on a hard redeploy and when the subscription ends, and with several instances each copy keeps its own data. A local backup sits inside the same volume, so it is lost with it.',
  },
  r: {
    title: 'A copy on every instance, all of them write',
    body: 'Syncthing keeps the copies in step, eventually, so two instances writing at once can conflict. It needs two or more instances to have anything to copy to.',
  },
  g: {
    title: 'A copy on every instance, one primary runs',
    body: 'Only the elected primary runs this container and the others hold a synced copy. If it fails, a standby is elected after a delay of minutes, and the newest writes may be missing. The load balancer sends every port of the app to the primary node. One writer is the usual guidance for a database (design advice, not a documented rule).',
  },
  s: {
    title: 'Synced, and Flux does not document the details',
    body: 'The s: flag syncs the volume between instances. What it guarantees beyond that is not documented, so r: and g: are the choices to build on.',
  },
};

export function DataPicker({ index, component }: { index: number; component: FluxComponentSpec }) {
  const ui = useForgeUi();
  const path = `${'compose'}[${index}].containerData`;
  const locked = !ui.canEdit(path);
  const mount = readContainerData(component.containerData);
  const meaning = MEANING[mount.prefix];

  const options = [
    { value: '', label: 'Local' },
    { value: 'r', label: 'r: Replicated' },
    { value: 'g', label: 'g: Primary + standby' },
    ...(mount.prefix === 's' ? [{ value: 's', label: 's: Synced' }] : []),
  ];

  const write = (next: { prefix?: DataPrefix; path?: string }, label: string, key: string | null) => {
    ui.edit(
      path,
      (s) => {
        const c = s.compose[index];
        if (!c) return s;
        const m = readContainerData(c.containerData);
        const value = writeContainerData({
          prefix: next.prefix ?? m.prefix,
          path: next.path ?? m.path,
          extra: m.extra,
        });
        if (value === c.containerData) return s;
        const compose = s.compose.slice();
        compose[index] = { ...c, containerData: value };
        return { ...s, compose };
      },
      { key, label },
    );
  };

  return (
    <Field
      path={path}
      label="Storage"
      locked={locked}
      htmlFor={`forge-data-${index}`}
      value={
        <small>
          {component.containerData.length}/{LIMITS.containerData.maxLength}
        </small>
      }
    >
      {mount.understood ? (
        <>
          <Choice
            label={`Storage type of ${component.name}`}
            value={mount.prefix}
            options={options}
            disabled={locked}
            onValueChange={(v) => {
              if (locked) return;
              write({ prefix: v as DataPrefix }, 'Change the storage type', null);
            }}
          />
          <TextInput
            id={`forge-data-${index}`}
            label={`Data folder of ${component.name}`}
            mono
            path={path}
            value={mount.path}
            placeholder="/data"
            locked={locked}
            state={
              ui.issues.worst(path) === 'error'
                ? 'error'
                : ui.issues.worst(path) === 'warning'
                  ? 'warning'
                  : null
            }
            onChange={(v) => write({ path: v }, 'Change the data folder', path)}
          />
          {mount.extra ? (
            <p className={styles.note}>
              Also mounted: <code>{mount.extra}</code>. Edit the extra mounts in the JSON panel.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <TextInput
            id={`forge-data-${index}`}
            label={`containerData of ${component.name}`}
            mono
            path={path}
            value={component.containerData}
            locked={locked}
            state={ui.issues.worst(path) === 'error' ? 'error' : null}
            onChange={(v) =>
              ui.edit(
                path,
                (s) => {
                  const c = s.compose[index];
                  if (!c || c.containerData === v) return s;
                  const compose = s.compose.slice();
                  compose[index] = { ...c, containerData: v };
                  return { ...s, compose };
                },
                { key: path, label: 'Change the storage' },
              )
            }
          />
          <p className={styles.note}>
            This definition has flags or parts the picker does not model, so it is shown as written.
          </p>
        </>
      )}
      {mount.understood ? (
        <div className={styles.meaning} data-prefix={mount.prefix || 'plain'}>
          <strong>{meaning.title}</strong>
          <span>{meaning.body}</span>
        </div>
      ) : null}
      {mount.understood && mount.path === '/tmp' ? (
        <p className={controls.hint}>
          <code>/tmp</code> is how a spec says "no data to keep".
        </p>
      ) : null}
    </Field>
  );
}
