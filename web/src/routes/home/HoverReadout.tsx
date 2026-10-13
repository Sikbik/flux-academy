import { useSceneBus } from '@/scenes/bus';
import { Glyph } from '@/ui';
import styles from './readout.module.css';
import { isFlatRenderer } from './renderer';

const TIER = { cumulus: 'Cumulus', nimbus: 'Nimbus', stratus: 'Stratus' } as const;

let names: Intl.DisplayNames | null | undefined;

/** "NO" to "Norway", falling back to the code where the browser has no region names. */
function countryName(cc: string): string {
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      names = null;
    }
  }
  try {
    return names?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/**
 * The probe: a mono readout of what the pointer is over on the bench (tier, country, how many real nodes
 * the pillar stands for). The scene reports canvas pixels; the stage fills the viewport, so they are
 * viewport coordinates. The OS cursor is never touched.
 */
export function HoverReadout() {
  const hover = useSceneBus((s) => s.scene.hover);
  const flat = useSceneBus((s) => isFlatRenderer(s.scene.webgl, s.scene.reason));
  const insets = useSceneBus((s) => s.insets);
  if (!hover) return null;
  // The 2D bench is given the free area as its box, so its pixels start at that box's corner.
  const ox = flat ? insets.left * window.innerWidth : 0;
  const oy = flat ? insets.top * window.innerHeight : 0;
  const left = Math.min(ox + hover.x + 16, window.innerWidth - 220);
  const top = Math.min(oy + hover.y + 16, window.innerHeight - 70);
  return (
    <div className={styles.readout} style={{ left, top }} data-tier={hover.tier} aria-hidden="true">
      <Glyph name={`tier-${hover.tier}` as 'tier-cumulus'} size={14} />
      <span className={styles.line}>
        {TIER[hover.tier]}
        {hover.cc ? ` / ${countryName(hover.cc)}` : ''}
      </span>
      <span className={styles.sub}>
        {hover.nodes !== null ? `${hover.nodes} ${hover.nodes === 1 ? 'node' : 'nodes'}` : 'sample node'}
        {hover.hosting ? (hover.healthy ? ', hosting a copy' : ', hosting a copy, down') : ''}
      </span>
    </div>
  );
}
