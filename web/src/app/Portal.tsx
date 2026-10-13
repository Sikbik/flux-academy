/**
 * Portals into the shared overlay root (`#overlay-root`), the same structure the design system's modal
 * stack expects: modal surfaces live OUTSIDE `#root`, so making the page `inert` behind a modal never
 * takes the modal with it. Layers are created on first use with their z-index token.
 */

import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type OverlayLayer = 'overlay' | 'modal' | 'palette' | 'ambient' | 'toast' | 'tooltip';

const Z: Record<OverlayLayer, string> = {
  overlay: 'var(--z-overlay)',
  ambient: 'var(--z-ambient)',
  modal: 'var(--z-modal)',
  palette: 'var(--z-palette)',
  toast: 'var(--z-toast)',
  tooltip: 'var(--z-tooltip)',
};

function host(): HTMLElement {
  let el = document.getElementById('overlay-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'overlay-root';
    document.body.appendChild(el);
  }
  return el;
}

/** The container element for a layer, created on first use. */
export function getOverlayLayer(name: OverlayLayer): HTMLElement {
  const root = host();
  let layer = root.querySelector<HTMLElement>(`:scope > [data-layer="${name}"]`);
  if (!layer) {
    layer = document.createElement('div');
    layer.dataset.layer = name;
    layer.style.position = 'relative';
    layer.style.zIndex = Z[name];
    root.appendChild(layer);
  }
  return layer;
}

/** Renders children into an overlay layer. Renders nothing on the server or before mount. */
export function Portal({ layer = 'modal', children }: { layer?: OverlayLayer; children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(getOverlayLayer(layer));
  }, [layer]);
  return target ? createPortal(children, target) : null;
}
