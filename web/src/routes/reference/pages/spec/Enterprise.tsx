import { useMemo } from 'react';
import { buildEnterpriseFacts } from '@/content/reference/spec';
import { FactList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';

const CODES = [
  'ENTERPRISE_AMD64',
  'ENTERPRISE_OPAQUE',
  'REPOAUTH_NEEDS_ENTERPRISE',
  'NODES_NEED_ENTERPRISE',
  'NODES_OWNER_PRIVILEGE',
  'DATACENTER_PRIVILEGE',
] as const;

/** `enterprise`, `nodes` and `datacenter`: what they are, who may use them and what they cost. */
export function Enterprise() {
  const rows = useMemo(() => buildEnterpriseFacts(), []);
  return (
    <Section id="nodes-and-enterprise">
      <FactList section="nodes-and-enterprise" rows={rows} />
      <LintChips codes={CODES} label="Caught by" />
    </Section>
  );
}
