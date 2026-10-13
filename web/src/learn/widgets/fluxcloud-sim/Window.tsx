/**
 * The faux FluxCloud window: a title bar that says SIMULATION, the left menu of FACTS 9.3, and the screen.
 * Academy styling, not a copy of FluxCloud's branding. Only "My Applications" and "Register New App" lead
 * anywhere; the other menu entries are listed because they exist and marked as not simulated.
 */
import type { ReactNode } from 'react';
import { Button, Glyph, type GlyphName } from '@/ui';
import styles from './FluxcloudSim.module.css';
import type { Account } from './model';

export type MenuId = 'apps' | 'register';

interface MenuItem {
  id: string;
  label: string;
  glyph: GlyphName;
  live?: MenuId;
}

/** FACTS 9.3 "Left menu", exact labels in order (Administration is for operators and is left out). */
const MENU: readonly MenuItem[] = [
  { id: 'apps', label: 'My Applications', glyph: 'layers', live: 'apps' },
  { id: 'register', label: 'Register New App', glyph: 'plus', live: 'register' },
  { id: 'marketplace', label: 'App Marketplace', glyph: 'grid' },
  { id: 'games', label: 'Games', glyph: 'puzzle' },
  { id: 'wordpress', label: 'WordPress', glyph: 'external' },
  { id: 'drive', label: 'FluxDrive', glyph: 'folder' },
  { id: 'calc', label: 'Cost Calculator', glyph: 'price' },
  { id: 'network', label: 'Flux Network', glyph: 'globe' },
  { id: 'help', label: 'Help', glyph: 'help' },
];

interface WindowProps {
  /** Path in the address strip, for example `/apps/register/configure` (FACTS 9.1 routes). */
  path: string;
  current: MenuId;
  /** The entries that lead somewhere in this flow. Every other entry is listed and inert. */
  live: readonly MenuId[];
  onMenu: (id: MenuId) => void;
  account: Account;
  onAccount: (a: Account) => void;
  accountLocked?: boolean;
  children: ReactNode;
}

export function Window({
  path,
  current,
  live: liveIds,
  onMenu,
  account,
  onAccount,
  accountLocked,
  children,
}: WindowProps) {
  return (
    <section className={styles.win} aria-label="FluxCloud (simulation)">
      <header className={styles.winBar}>
        <span className={styles.winMark} aria-hidden="true">
          <Glyph name="flux" size={14} />
        </span>
        <strong className={styles.winTitle}>FluxCloud (simulation)</strong>
        <code className={styles.winPath} title="The route this screen has in FluxCloud">
          {path}
        </code>
        <div className={styles.account}>
          <span className={styles.accountLabel} aria-hidden="true">
            Signed in as
          </span>
          <fieldset className={styles.accountChoice}>
            <legend className="sr-only">Signed in as</legend>
            <Button
              size="sm"
              variant={account === 'sso' ? 'primary' : 'ghost'}
              aria-pressed={account === 'sso'}
              disabled={accountLocked}
              onClick={() => onAccount('sso')}
              {...(account === 'sso' ? { icon: 'check' as const } : {})}
            >
              SSO account
            </Button>
            <Button
              size="sm"
              variant={account === 'wallet' ? 'primary' : 'ghost'}
              aria-pressed={account === 'wallet'}
              disabled={accountLocked}
              onClick={() => onAccount('wallet')}
              {...(account === 'wallet' ? { icon: 'check' as const } : {})}
            >
              Wallet
            </Button>
          </fieldset>
        </div>
      </header>
      <div className={styles.winBody}>
        <nav className={styles.menu} aria-label="FluxCloud menu (simulation)">
          <ul>
            {MENU.map((m) => {
              const live = m.live && liveIds.includes(m.live) ? m.live : undefined;
              const isCurrent = m.live === current;
              return (
                <li key={m.id} data-live={m.live ? 'true' : 'false'}>
                  {live ? (
                    <button
                      type="button"
                      className={styles.menuItem}
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={() => onMenu(live)}
                    >
                      <Glyph name={m.glyph} size={16} />
                      <span>{m.label}</span>
                    </button>
                  ) : (
                    <span
                      className={styles.menuItem}
                      data-inert={isCurrent ? undefined : 'true'}
                      aria-current={isCurrent ? 'page' : undefined}
                      aria-disabled={isCurrent ? undefined : 'true'}
                      title={isCurrent ? undefined : 'Not part of this simulation'}
                    >
                      <Glyph name={m.glyph} size={16} />
                      <span>{m.label}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={styles.screen}>{children}</div>
      </div>
    </section>
  );
}
