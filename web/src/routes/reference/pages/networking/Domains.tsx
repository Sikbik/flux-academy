import { LIMITS } from '@shared/flux';
import { anchor } from '@/content/reference';
import { NETWORK_EXAMPLE } from '@/content/reference/examples';
import {
  buildCustomDomainSteps,
  buildDnsNotes,
  buildLoadBalancingFacts,
  buildNonHttpFacts,
} from '@/content/reference/networking';
import { CodeBlock } from '@/ui';
import { FactList, Slab } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';
import { KeyFact, Md } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import styles from './networking.module.css';

const STEPS = buildCustomDomainSteps();

export function CustomDomains() {
  const suffix = LIMITS.appDomainSuffix;
  const web = NETWORK_EXAMPLE.compose[0];
  const domain = web?.domains.find((d) => d !== '') ?? 'shop.example.com';
  const record = `${domain}.    CNAME    ${NETWORK_EXAMPLE.name}.${suffix}.`;
  return (
    <Section id="custom-domains">
      <Slab>
        <ol className={styles.pathSteps}>
          {STEPS.map((s, i) => {
            const id = anchor.domainStep(s.id);
            return (
              <li key={s.id} id={id} className={styles.pathStep}>
                <span className={styles.pathNum} aria-hidden="true">
                  {i + 1}
                </span>
                <div className={styles.pathBody}>
                  <p className={styles.pathTitle}>
                    <span>{s.title}</span>
                    <CopyLink id={id} label={s.title} className={styles.pathLink} />
                  </p>
                  <p className={styles.pathText}>
                    <Md text={s.text} />
                  </p>
                  <ProvChips prov={s.prov} />
                </div>
              </li>
            );
          })}
        </ol>
      </Slab>
      <div className={styles.twoUp}>
        <CodeBlock
          lang="json"
          filename="Component"
          code={JSON.stringify(
            { ports: web?.ports, containerPorts: web?.containerPorts, domains: web?.domains },
            null,
            2,
          )}
        />
        <CodeBlock lang="text" filename="DNS record" code={record} wrap />
      </div>
      <KeyFact label="Check it">
        <p>
          The domain has to resolve to the load balancers before the certificate can be issued. Until then the
          domain manager skips it and tries again later, so a new record may take a while to start working.
        </p>
      </KeyFact>
      <FactList section="custom-domains" rows={buildDnsNotes()} />
      <LintChips
        codes={['DOMAIN_FORMAT', 'DOMAIN_IS_GENERATED', 'DOMAIN_APEX', 'DOMAIN_TOO_LONG']}
        label="Caught by"
      />
    </Section>
  );
}

export function LoadBalancing() {
  return (
    <Section id="load-balancing">
      <FactList section="load-balancing" rows={buildLoadBalancingFacts()} />
    </Section>
  );
}

export function NonHttp() {
  return (
    <Section id="non-http">
      <FactList section="non-http" rows={buildNonHttpFacts()} />
    </Section>
  );
}
