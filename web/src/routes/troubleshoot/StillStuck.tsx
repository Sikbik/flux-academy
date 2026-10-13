import { SITE } from '@shared/site';
import { Glyph, LinkButton, Panel } from '@/ui';
import styles from './parts.module.css';

/**
 * The end of every view: where to go when this page did not solve it, and what to bring. It names only
 * the two places the Academy's own site data lists, the Flux Discord and the official docs.
 */
export function StillStuck() {
  return (
    <section id="still-stuck" className={styles.stuck} aria-labelledby="ts-stuck">
      <Panel variant="slab" tone="neutral" padding="lg" size="md" marks={false} pattern="br">
        <h2 id="ts-stuck" className={styles.stuckTitle} tabIndex={-1}>
          Still stuck?
        </h2>
        <p className={styles.stuckLead}>
          Some problems need a person who can see your app. Ask where the Flux community and the people who
          wrote the docs are.
        </p>
        <div className={styles.stuckActions}>
          <LinkButton href={SITE.links.discord} newTab variant="primary" size="md" iconEnd="external">
            Ask on the Flux Discord
          </LinkButton>
          <LinkButton href={SITE.links.docs} newTab variant="secondary" size="md" iconEnd="external">
            Read the official docs
          </LinkButton>
        </div>
        <div className={styles.bring}>
          <h3 className={styles.bringTitle}>
            <Glyph name="list" size={14} />
            What to bring
          </h3>
          <ul className={styles.bringList}>
            <li>Your app name and what you were doing when it went wrong.</li>
            <li>The exact message, copied, not described.</li>
            <li>The time you paid, if it is about installing, and the result of the checks above.</li>
            <li>The spec, with any secret values removed.</li>
          </ul>
          <p className={styles.bringWarn}>
            Never paste a private key, a wallet seed, a repository token or an environment value that is a
            password.
          </p>
        </div>
      </Panel>
    </section>
  );
}
