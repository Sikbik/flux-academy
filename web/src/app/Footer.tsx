import { SITE } from '@shared/site';
import { Link } from 'react-router';
import { Glyph } from '@/ui';
import badge from './assets/running-on-flux.png';
import styles from './Footer.module.css';

const LEARN_LINKS = [
  { to: '/learn', label: 'Course map' },
  { to: '/labs', label: 'Labs' },
  { to: '/reference', label: 'Reference' },
  { to: '/glossary', label: 'Glossary' },
  { to: '/troubleshoot', label: 'Troubleshoot' },
  { to: '/profile', label: 'Your progress' },
] as const;

const FLUX_LINKS = [
  { href: SITE.links.docs, label: 'docs.runonflux.com' },
  { href: SITE.links.cloud, label: 'cloud.runonflux.com' },
  { href: SITE.links.flux, label: 'runonflux.com' },
  { href: SITE.links.discord, label: 'Discord' },
] as const;

function External({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
      {children}
      <Glyph name="arrow-up-right" size={12} className={styles.ext} />
      <span className="sr-only">. Opens in a new tab</span>
    </a>
  );
}

/** The shell footer (docs/DESIGN.md section 5.1). */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.ticks} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link to="/" className={styles.lockup} aria-label="Flux Academy, home">
            <img
              src="/brand/round/flux-round-blue-white.svg"
              alt=""
              width={28}
              height={28}
              loading="lazy"
              decoding="async"
            />
            <span>
              <b>Flux</b> <span>Academy</span>
            </span>
          </Link>
          <p className={styles.tagline}>{SITE.tagline}</p>
          <a
            href={SITE.links.flux}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.badge}
            aria-label="Running on Flux. Opens runonflux.com in a new tab"
          >
            <img src={badge} alt="Running on Flux" width={286} height={72} loading="lazy" decoding="async" />
          </a>
        </div>

        <nav className={styles.col} aria-label="Learn and explore">
          <h2 className={styles.heading}>Explore</h2>
          <ul className={styles.list}>
            {LEARN_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className={styles.link}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className={styles.col} aria-label="Flux">
          <h2 className={styles.heading}>On Flux</h2>
          <ul className={styles.list}>
            {FLUX_LINKS.map((l) => (
              <li key={l.href}>
                <External href={l.href}>{l.label}</External>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.col}>
          <h2 className={styles.heading}>About the numbers</h2>
          <p className={styles.note}>
            Network data from the Flux public API. The FLUX price comes from the rate service FluxOS uses, so
            a node's own calculator can show a slightly older rate; the 24 h change and market cap come from
            CoinGecko. Numbers say how fresh they are, and when the API cannot be reached the page shows a
            built-in sample, labelled as one.
          </p>
        </div>
      </div>

      <div className={styles.base}>
        <button
          type="button"
          className={styles.top}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to the top"
        >
          <Glyph name="arrow-up" size={16} />
        </button>
      </div>
    </footer>
  );
}
