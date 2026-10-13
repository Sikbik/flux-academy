import { Reveal } from '@/ui';
import { AppLinkButton } from './AppLinkButton';
import styles from './close.module.css';
import { CLOSE } from './copy';
import { PrimaryAction } from './PrimaryAction';

/**
 * The close: one sentence and one button. The footer is the shell's.
 */
export function Close() {
  return (
    <section id="start" className={styles.close} data-scene="close" aria-labelledby="close-line">
      <Reveal className={styles.inner}>
        <h2 id="close-line" className={styles.line}>
          {CLOSE.line}
        </h2>
        <div className={styles.actions}>
          <PrimaryAction size="lg" />
          <AppLinkButton href="/learn" variant="ghost" size="lg">
            See the course map
          </AppLinkButton>
        </div>
      </Reveal>
    </section>
  );
}
