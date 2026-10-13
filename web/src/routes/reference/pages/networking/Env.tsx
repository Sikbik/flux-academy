import { buildEnvironmentFacts, buildNetworkTrouble } from '@/content/reference/networking';
import { FactList, TroubleList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';

export function Environment() {
  return (
    <Section id="environment">
      <FactList section="environment" rows={buildEnvironmentFacts()} />
      <LintChips
        codes={['ENV_SECRET_PUBLIC', 'ENV_FORMAT', 'ENV_RESERVED_NAME', 'STORAGE_LINK_INVALID']}
        label="Caught by"
      />
    </Section>
  );
}

export function NetworkingTrouble() {
  return (
    <Section id="networking-trouble">
      <TroubleList section="networking-trouble" rows={buildNetworkTrouble()} />
    </Section>
  );
}
