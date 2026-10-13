import { useRef } from 'react';
import { Build } from './Build';
import { Close } from './Close';
import { Hero } from './Hero';
import { HoverReadout } from './HoverReadout';
import styles from './home.module.css';
import { Intro } from './Intro';
import { useIntro } from './intro';
import { Labs } from './Labs';
import { Paths } from './Paths';
import { Pulse } from './Pulse';
import { StageHost } from './StageHost';
import { Story } from './Story';
import { useSceneSync } from './useSceneSync';
import { useStageMode } from './useStageMode';

/**
 * The front door. One long page on a sticky stage: the hero scene (WebGL, or the calm 2D bench) sits
 * behind every section and is steered through the scene bus alone. See docs/DESIGN.md section 5.2.
 */
export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const mode = useStageMode();
  const intro = useIntro();
  useSceneSync(root);

  return (
    <div ref={root} className={styles.home} data-mode={mode}>
      <StageHost mode={mode} />
      <Hero mode={mode} introDelay={intro.phase === 'playing' && !intro.revealed} />
      <Story />
      <Paths />
      <Labs />
      <Pulse />
      <Build />
      <Close />
      <HoverReadout />
      <Intro phase={intro.phase} />
    </div>
  );
}
