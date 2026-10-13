/**
 * The four shards of the Flux symbol, verbatim from `web/public/brand/mark/flux-mark-white.svg` (the
 * Brand Book v2.0 artwork): never redrawn, recoloured or distorted. `intro.test.ts` re-reads the SVG and
 * fails if these drift.
 */
export const MARK_VIEWBOX = { w: 279.714, h: 322.975 } as const;
export const MARK_SHARDS: ReadonlyArray<{ d: string; transform: string }> = [
  {
    d: 'M175.03,202.425l-28.9,16.7L84.03,183.28l28.2-16.285.7-.414,1.077.622Z',
    transform: 'translate(-6.271 103.85)',
  },
  {
    d: 'M326.213,116.8v33.607L265.09,115.125l-16.576-9.572-16.576,9.572-77.7,44.858-16.576,9.572v19.787l-29.9-17.259-16.576-9.572-16.576,9.572L46.5,188.307V116.8L186.356,36.06Z',
    transform: 'translate(-46.5 -36.06)',
  },
  {
    d: 'M261.9,132.948v89.715l-77.7,44.858-.1-.062-77.594-44.8V132.948L184.2,88.07Z',
    transform: 'translate(17.819 19.693)',
  },
  {
    d: 'M135.884,141.366v51.591L91.192,218.774,46.5,192.957V141.366l44.692-25.8Z',
    transform: 'translate(-46.5 49.17)',
  },
];
