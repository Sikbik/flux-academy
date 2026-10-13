// The Flux Academy entry point. The global stylesheet comes first so every component's CSS layers
// slot into the order declared there.
import '@/styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { startThemeSync } from '@/system/theme';

// Set the accent, motion and glass attributes before the first paint, not after the first effect.
startThemeSync();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
