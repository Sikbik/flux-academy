import { useState } from 'react';
import { Glyph, TextField } from '@/ui';
import type { NeededNames } from './model';
import styles from './parts.module.css';

export interface YourAppProps {
  needs: NeededNames;
  app: string;
  domain: string;
  onApp: (v: string) => void;
  onDomain: (v: string) => void;
}

/**
 * Two optional fields that fill the visitor's own app name and domain into the commands and addresses of
 * the problem on screen. Closed until asked for (the answer comes first); open from the start when a name
 * is already known. Nothing is sent anywhere: the values stay in this tab.
 */
export function YourApp({ needs, app, domain, onApp, onDomain }: YourAppProps) {
  const filled = app !== '' || domain !== '';
  const [open, setOpen] = useState(filled);
  const what = needs.app && needs.domain ? 'app name and domain' : needs.domain ? 'domain' : 'app name';
  return (
    <details className={styles.yourApp} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={styles.yourAppSummary}>
        <Glyph name="edit" size={14} />
        <span>Fill in your {what}</span>
        <span className={styles.yourAppState}>
          {filled ? [app, domain].filter(Boolean).join(', ') : 'optional'}
        </span>
      </summary>
      <div className={styles.yourAppBody}>
        <div className={styles.yourAppFields}>
          {needs.app ? (
            <TextField
              label="Your app name"
              value={app}
              onValueChange={onApp}
              placeholder="for example myapp"
              mono
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={63}
            />
          ) : null}
          {needs.domain ? (
            <TextField
              label="Your domain"
              value={domain}
              onValueChange={onDomain}
              placeholder="for example app.example.com"
              mono
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={253}
            />
          ) : null}
        </div>
        <p className={styles.yourAppNote}>
          This completes the commands and addresses below. It stays in this tab and is not sent anywhere.
        </p>
      </div>
    </details>
  );
}
