import { createContext, useContext } from 'react';
import { FACTS_DATE, FLUXOS_VERSION, type Proof, proofLabel } from '@/content/troubleshoot';
import { MarkupText } from '@/learn/MarkupText';
import { Chip } from '@/ui';
import styles from './parts.module.css';

/**
 * The date the claims on this page were checked. A page of a stage that carries its own date (the Git and
 * agent stages, read from section 15 of the research notes) provides it; everywhere else it is `FACTS_DATE`.
 */
export const CheckedOnContext = createContext<string>(FACTS_DATE);

const STATUS = { verified: 'ok', docs: 'off', unverified: 'warn' } as const;

/** The short evidence chip: Source, Live, Source and live, Docs only or Unverified. */
export function ProofChip({ proof, size = 'sm' }: { proof: Proof; size?: 'sm' | 'md' }) {
  return (
    <Chip kind="status" status={STATUS[proof.status]} size={size}>
      {proofLabel(proof)}
    </Chip>
  );
}

/** Whose code a `source` claim was read in: FluxOS unless the proof says it was the agent server or the console. */
const CODE_NAME = {
  mcp: 'the source of the FluxCloud server package',
  console: 'the shipped code of the FluxCloud console',
} as const;

/**
 * The evidence line under a claim: the chip, how it was verified, the date it was checked (the research
 * note section sits in the date's tooltip, so contributors can trace it without it cluttering the page), and
 * (always visible) what is not known when the claim is unverified.
 */
export function ProofLine({ proof }: { proof: Proof }) {
  const checkedOn = useContext(CheckedOnContext);
  const code = proof.codebase ? CODE_NAME[proof.codebase] : `the FluxOS ${FLUXOS_VERSION} source`;
  const how =
    proof.status === 'verified'
      ? `Verified${proof.via?.includes('source') ? ` in ${code}` : ''}${proof.via?.includes('source') && proof.via.includes('live') ? ' and' : ''}${proof.via?.includes('live') ? ' on the live network' : ''}`
      : proof.status === 'docs'
        ? 'From the official docs, not checked against the source'
        : 'Not verified';
  return (
    <div className={styles.proof} data-status={proof.status}>
      <div className={styles.proofRow}>
        <ProofChip proof={proof} />
        <span className={styles.proofText}>
          {how}.{' '}
          <abbr
            title={`Every claim here points at a section of the Academy's research notes. This one: ${proof.facts}.`}
          >
            Checked {checkedOn}
          </abbr>
          .
        </span>
      </div>
      {proof.note ? (
        <p className={styles.proofNote}>
          <span className={styles.proofNoteLabel}>
            {proof.status === 'unverified' ? 'What we do not know' : 'Note'}
          </span>
          <MarkupText text={proof.note} />
        </p>
      ) : null}
    </div>
  );
}
