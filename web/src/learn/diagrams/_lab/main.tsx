// Dev-only entry for the diagram lab: `vite` then open /diagram-lab.html.
// Query: ?only=<id>  ?w=<px>  ?beat=<n>  ?sheet=1  ?reduced=1  ?accent=flux|cumulus|nimbus|stratus
import { createRoot } from 'react-dom/client';
import '../../../styles/index.css';
import Lab from './Lab';

const params = new URLSearchParams(window.location.search);
const accent = params.get('accent');
if (accent && ['flux', 'cumulus', 'nimbus', 'stratus'].includes(accent)) {
  document.documentElement.dataset.accent = accent;
}
if (params.get('reduced') === '1') document.documentElement.dataset.motion = 'reduced';

const root = document.getElementById('root');
if (root) createRoot(root).render(<Lab />);
