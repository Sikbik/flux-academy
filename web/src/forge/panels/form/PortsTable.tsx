/**
 * The ports of one component as a table: public port, the container port it reaches, and an optional
 * custom domain. The three arrays of the spec stay the same length because a row is the unit: adding or
 * removing a row changes all three.
 *
 * Each row says what its port costs or why it is not allowed (banned, in use, USD 2 "restricted" port)
 * and what address the network generates for it.
 */

import { derivedNames, isBannedPort, isSurchargePort, LIMITS } from '@shared/flux/spec';
import type { FluxComponentSpec } from '@shared/flux/types';
import { useMemo } from 'react';
import { Chip, Glyph } from '@/ui';
import { useForgeUi } from '../../context';
import controls from '../../controls/controls.module.css';
import { Field } from '../../controls/Field';
import { NumberInput, TextInput } from '../../controls/inputs';
import {
  addPort,
  alignComponentPorts,
  portRowCount,
  portsMisaligned,
  removePort,
  setPortCell,
} from '../../model';
import styles from './form.module.css';

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function PortsTable({ index, component }: { index: number; component: FluxComponentSpec }) {
  const ui = useForgeUi();
  const { spec } = ui.snap;
  const base = `compose[${index}]`;
  const rows = portRowCount(component);
  const misaligned = portsMisaligned(component);
  const canEditPorts = ui.canEdit(`${base}.ports`);
  const canEditContainer = ui.canEdit(`${base}.containerPorts`);
  const canEditDomains = ui.canEdit(`${base}.domains`);
  const locked = !canEditPorts && !canEditContainer && !canEditDomains;
  const names = useMemo(() => derivedNames(spec), [spec]);

  const occurrences = useMemo(() => {
    const count = new Map<number, number>();
    for (const c of spec.compose) for (const p of c.ports) count.set(p, (count.get(p) ?? 0) + 1);
    return count;
  }, [spec.compose]);

  const canAdd = canEditPorts && rows < LIMITS.ports.perComponentMax;

  return (
    <Field
      path={`${base}.ports`}
      label="Ports"
      locked={locked}
      issuePath={base}
      topic="compose[].ports"
      value={`${rows} of ${LIMITS.ports.perComponentMax}`}
      hideIssues
    >
      {rows === 0 ? (
        <p className={controls.empty}>
          No public ports. Nothing outside the app can reach this component, which is right for a database
          that only its siblings use.
        </p>
      ) : (
        <div className={styles.ports}>
          <div className={styles.portHead} aria-hidden="true">
            <span>Public</span>
            <span />
            <span>Container</span>
            <span>Custom domain</span>
            <span />
          </div>
          {Array.from({ length: rows }, (_, row) => {
            const port = component.ports[row];
            const cport = component.containerPorts[row];
            const domain = component.domains[row] ?? '';
            const portPath = `${base}.ports[${row}]`;
            const cPath = `${base}.containerPorts[${row}]`;
            const dPath = `${base}.domains[${row}]`;
            const banned = typeof port === 'number' && isBannedPort(port);
            const dup = typeof port === 'number' && (occurrences.get(port) ?? 0) > 1;
            const fee = typeof port === 'number' && !banned && isSurchargePort(port);
            const address = names.ports.find((p) => p.component === component.name && p.port === port);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a row is its position in three parallel arrays
              <div className={styles.portRowWrap} key={row}>
                <div className={styles.portRow}>
                  <NumberInput
                    plain
                    label={`Public port, row ${row + 1}`}
                    path={portPath}
                    value={port ?? 0}
                    min={1}
                    max={65535}
                    locked={!canEditPorts}
                    state={
                      banned || dup
                        ? 'error'
                        : ui.issues.worst(portPath) === 'error'
                          ? 'error'
                          : fee
                            ? 'warning'
                            : null
                    }
                    onChange={(v) =>
                      ui.edit(portPath, (s) => setPortCell(s, index, row, 'ports', Math.round(v)), {
                        key: portPath,
                        label: 'Change a public port',
                      })
                    }
                  />
                  <span className={styles.arrow} aria-hidden="true">
                    <Glyph name="arrow-right" size={14} />
                  </span>
                  <NumberInput
                    plain
                    label={`Container port, row ${row + 1}`}
                    path={cPath}
                    value={cport ?? 0}
                    min={0}
                    max={65535}
                    locked={!canEditContainer}
                    state={ui.issues.worst(cPath) === 'error' ? 'error' : null}
                    onChange={(v) =>
                      ui.edit(cPath, (s) => setPortCell(s, index, row, 'containerPorts', Math.round(v)), {
                        key: cPath,
                        label: 'Change a container port',
                      })
                    }
                  />
                  <TextInput
                    mono
                    label={`Custom domain, row ${row + 1}`}
                    path={dPath}
                    value={domain}
                    placeholder="app.example.com"
                    locked={!canEditDomains}
                    state={
                      ui.issues.worst(dPath) === 'error'
                        ? 'error'
                        : ui.issues.worst(dPath) === 'warning'
                          ? 'warning'
                          : null
                    }
                    onChange={(v) =>
                      ui.edit(dPath, (s) => setPortCell(s, index, row, 'domains', v), {
                        key: dPath,
                        label: 'Change a custom domain',
                      })
                    }
                  />
                  {canEditPorts ? (
                    <button
                      type="button"
                      className={controls.mini}
                      data-tone="crit"
                      aria-label={`Remove port row ${row + 1}`}
                      onClick={() =>
                        ui.edit(`${base}.ports`, (s) => removePort(s, index, row), {
                          key: null,
                          label: 'Remove a port',
                        })
                      }
                    >
                      <Glyph name="trash" size={14} />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
                <div className={styles.portMeta}>
                  {banned ? (
                    <Chip size="sm" kind="status" status="crit">
                      Banned port
                    </Chip>
                  ) : dup ? (
                    <Chip size="sm" kind="status" status="crit">
                      Used twice
                    </Chip>
                  ) : fee ? (
                    <Chip size="sm" kind="status" status="warn">
                      Restricted port, +{money(ui.params.port)} to the bundle
                    </Chip>
                  ) : null}
                  {address ? <code className={styles.address}>{address.generatedDomain}</code> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {misaligned ? (
        <p className={styles.note}>
          The ports, container ports and domains lists have different lengths.{' '}
          {canEditPorts ? (
            <button
              type="button"
              className={controls.linkBtn}
              onClick={() =>
                ui.edit(`${base}.ports`, (s) => alignComponentPorts(s, index), {
                  key: null,
                  label: 'Align the port lists',
                })
              }
            >
              Make them the same length
            </button>
          ) : null}
        </p>
      ) : null}
      <div className={controls.rowMeta}>
        <button
          type="button"
          className={controls.addBtn}
          disabled={!canAdd}
          onClick={() =>
            ui.edit(`${base}.ports`, (s) => addPort(s, index), { key: null, label: 'Add a port' })
          }
        >
          <Glyph name="plus" size={14} />
          Add port
        </button>
        <span className={controls.hint}>Every port is open for TCP and UDP.</span>
      </div>
      <PortIssues base={base} />
    </Field>
  );
}

/** Issues on any of the three port arrays, drawn once under the table. */
function PortIssues({ base }: { base: string }) {
  const ui = useForgeUi();
  const issues = ui.issues
    .within(base)
    .filter((i) => /\.(ports|containerPorts|domains)(\[|$)/.test(i.at) && i.severity !== 'info');
  if (issues.length === 0) return null;
  return (
    <ul className={controls.issues}>
      {issues.slice(0, 3).map((i) => (
        <li key={i.key} className={controls.issue} data-severity={i.severity}>
          <Glyph name={i.severity === 'error' ? 'status-crit' : 'status-warn'} size={14} />
          <span className={controls.issueText}>
            {i.message}
            <span className={controls.issueActions}>
              <button type="button" className={controls.linkBtn} onClick={() => ui.showInJson(i.at)}>
                Show in JSON
              </button>
            </span>
          </span>
        </li>
      ))}
      {issues.length > 3 ? (
        <li className={controls.issue} data-severity="info">
          <Glyph name="info" size={14} />
          <span className={controls.issueText}>{issues.length - 3} more in the Issues panel.</span>
        </li>
      ) : null}
    </ul>
  );
}
