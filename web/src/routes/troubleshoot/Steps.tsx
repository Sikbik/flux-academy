/**
 * The "how to check" and "how to fix" lists of a cause. A check is something to look at, a command to
 * run, a public API address to open, or a lab to try; a fix is some words, maybe a snippet to paste and
 * maybe a lab with the corrected spec loaded. `{app}` and `{domain}` in any of them are filled from what
 * the visitor typed.
 */

import { AppLinkButton } from '@/app/AppLinkButton';
import {
  type Check,
  ENDPOINTS_VERIFIED,
  endpointById,
  exampleHref,
  type Fix,
  type SpecExample,
} from '@/content/troubleshoot';
import { MarkupText } from '@/learn/MarkupText';
import { Chip, CodeBlock, Glyph, type GlyphName, LinkButton } from '@/ui';
import { fill } from './model';
import { useNames } from './names';
import { ProofLine } from './ProofChip';
import styles from './parts.module.css';

const LAB_GLYPH: Record<string, GlyphName> = {
  'spec-forge': 'lab-forge',
  network: 'lab-network',
  failover: 'lab-failover',
  terminal: 'lab-terminal',
  explorer: 'lab-explorer',
  'agent-desk': 'lab-agent-desk',
};

const LAB_NAME: Record<string, string> = {
  'spec-forge': 'Spec Forge',
  network: 'Network Lab',
  failover: 'Failover Lab',
  terminal: 'Terminal',
  explorer: 'App Explorer',
  'agent-desk': 'Agent Desk',
};

export function labHref(lab: string, spec?: SpecExample): string {
  if (spec) {
    const href = exampleHref(spec);
    if (href && lab === 'spec-forge') return href;
  }
  return `/labs/${lab}`;
}

const PLACEHOLDER = /\{(app|domain)\}/;

/** A reminder under a command or snippet that still has a name to fill in. */
function FillHint({ text }: { text: string }) {
  if (!PLACEHOLDER.test(text)) return null;
  const which = text.includes('{app}') ? '{app} with your app name' : '{domain} with your domain';
  return <p className={styles.needName}>Replace {which}, or fill it in above.</p>;
}

function Expect({ text }: { text: string }) {
  const names = useNames();
  return (
    <p className={styles.expect}>
      <span className={styles.expectLabel}>What to look for</span>
      <MarkupText text={fill(text, names)} />
    </p>
  );
}

function CheckRow({ check }: { check: Check }) {
  const names = useNames();
  switch (check.kind) {
    case 'look':
      return (
        <div className={styles.step}>
          <p className={styles.stepKind}>
            <Glyph name="eye" size={14} />
            Look
          </p>
          <p className={styles.stepText}>
            <MarkupText text={fill(check.text, names)} />
          </p>
        </div>
      );

    case 'command':
      return (
        <div className={styles.step}>
          <p className={styles.stepKind}>
            <Glyph name="terminal" size={14} />
            Run on your machine
          </p>
          <p className={styles.stepText}>{fill(check.label, names)}</p>
          <CodeBlock
            code={fill(check.command, names)}
            lang="sh"
            title="Terminal"
            lineNumbers={false}
            label={check.label}
            className={styles.code}
          />
          <FillHint text={fill(check.command, names)} />
          {check.expect ? <Expect text={check.expect} /> : null}
        </div>
      );

    case 'api': {
      const endpoint = endpointById(check.endpoint);
      if (!endpoint) return null;
      const url = fill(endpoint.url, names);
      const filled = !url.includes('{app}');
      return (
        <div className={styles.step}>
          <p className={styles.stepKind}>
            <Glyph name="globe" size={14} />
            Open this address
          </p>
          <p className={styles.stepText}>{check.label ?? endpoint.title}</p>
          <CodeBlock
            code={url}
            lang="text"
            lineNumbers={false}
            label={endpoint.title}
            className={styles.code}
          />
          <div className={styles.stepActions}>
            {filled ? (
              <LinkButton href={url} newTab variant="secondary" size="sm" iconEnd="external">
                Open the response
              </LinkButton>
            ) : (
              <p className={styles.needName}>Add your app name above to fill in this address.</p>
            )}
            <Chip size="sm" icon="shield">
              Public, read only, checked {ENDPOINTS_VERIFIED}
            </Chip>
          </div>
          {endpoint.caveat ? (
            <p className={styles.needName}>
              <MarkupText text={endpoint.caveat} />
            </p>
          ) : null}
          <Expect text={check.expect} />
        </div>
      );
    }

    case 'lab': {
      const href = labHref(check.lab, check.spec);
      return (
        <div className={styles.step}>
          <p className={styles.stepKind}>
            <Glyph name={LAB_GLYPH[check.lab] ?? 'layers'} size={14} />
            Try it in the {LAB_NAME[check.lab] ?? 'lab'}
          </p>
          <p className={styles.stepText}>{fill(check.label, names)}</p>
          <div className={styles.stepActions}>
            <AppLinkButton href={href} variant="secondary" size="sm" iconEnd="arrow-right">
              {check.spec ? 'Open it with an example loaded' : `Open the ${LAB_NAME[check.lab] ?? 'lab'}`}
            </AppLinkButton>
          </div>
          {check.expect ? <Expect text={check.expect} /> : null}
        </div>
      );
    }
  }
}

export function CheckList({ checks }: { checks: readonly Check[] }) {
  return (
    <ol className={styles.steps}>
      {checks.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered list from static data
        <li key={i} className={styles.stepItem}>
          <CheckRow check={c} />
        </li>
      ))}
    </ol>
  );
}

function FixRow({ fix }: { fix: Fix }) {
  const names = useNames();
  return (
    <div className={styles.step}>
      <p className={styles.stepText}>
        <MarkupText text={fill(fix.text, names)} />
      </p>
      {fix.snippet ? (
        <CodeBlock
          code={fill(fix.snippet.code, names)}
          lang={fix.snippet.lang}
          title={fix.snippet.label}
          lineNumbers={fix.snippet.code.includes('\n')}
          className={styles.code}
        />
      ) : null}
      {fix.snippet ? <FillHint text={fill(fix.snippet.code, names)} /> : null}
      {fix.lab ? (
        <div className={styles.stepActions}>
          <AppLinkButton
            href={labHref(fix.lab.lab, fix.lab.spec)}
            variant="secondary"
            size="sm"
            iconEnd="arrow-right"
          >
            {fix.lab.label}
          </AppLinkButton>
        </div>
      ) : null}
      {fix.proof ? <ProofLine proof={fix.proof} /> : null}
    </div>
  );
}

export function FixList({ fixes }: { fixes: readonly Fix[] }) {
  return (
    <ol className={styles.steps}>
      {fixes.map((f, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered list from static data
        <li key={i} className={styles.stepItem}>
          <FixRow fix={f} />
        </li>
      ))}
    </ol>
  );
}
