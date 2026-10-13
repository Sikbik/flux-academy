// Standalone entry for the design-system gallery: `vite` then open /kit.html.
// Query: ?accent=flux|cumulus|nimbus|stratus  ?motion=reduced|full  ?only=<section id>
import { createRoot } from 'react-dom/client';
import '../../styles/index.css';
import Kit from './Kit';

const params = new URLSearchParams(window.location.search);
const accent = params.get('accent');
if (accent && ['flux', 'cumulus', 'nimbus', 'stratus'].includes(accent)) {
  document.documentElement.dataset.accent = accent;
}
const motion = params.get('motion');
if (motion === 'reduced' || motion === 'full') document.documentElement.dataset.motion = motion;

const root = document.getElementById('root');
if (root) createRoot(root).render(<Kit />);
