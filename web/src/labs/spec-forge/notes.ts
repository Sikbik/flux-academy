/**
 * The Teach me notes of the Spec Forge: what the lab is, then three sentences about the spec on screen.
 * Markup strings (the lab frame renders them with the shared inline markup).
 *
 * Every number comes from the engine's own quote and tier table, and every claim is one the lessons make
 * too (docs/research/FACTS.md). The per-tier disk figures are deliberately not printed here: the validator
 * and the running nodes disagree by a few GB and the help popovers say which is which.
 */

import { LIMITS } from '@shared/flux/spec';
import { tiersThatFit } from '@shared/flux/tiers';
import { FDM_EJECT_SEC, G_STANDBY_WAIT_MIN_PER_POSITION, replacementWaitMin } from '@shared/flux/timing';
import type { FluxAppSpec, Quote } from '@shared/flux/types';
import { totals } from '@/forge/model';

const TIER_NAME = { cumulus: 'Cumulus', nimbus: 'Nimbus', stratus: 'Stratus' } as const;

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const LABEL_NOTES: readonly string[] = [
  'A Flux app spec is plain JSON: a few app level fields and a list of **components**, each one a container. The form, the JSON and the price are three views of the same spec, so an edit in one shows in the others at once.',
  'Every field has a help button that says what it is, what the limit is and the mistake people make most. **Issues** lists everything the checker found, with the reason and, where there is one, a fix you can apply.',
  'An **error** means the network would refuse the spec. A **warning** means it is accepted but is probably not what you meant. A **note** is a fact worth knowing, such as the {{term:port-fee}} for a port below 1024.',
  "The price is worked out here from Flux's published rates and labelled **Computed**. **Verify with Flux** asks Flux's own calculator through the Academy server, and the label becomes **Official** when it agrees.",
  'The map is a simulation of where instances could land for your location rules. On the real network there is no scheduler and each node that qualifies decides for itself, so treat the picture as one possible outcome. A list that leaves some nodes but fewer than your instances is refused at registration; a list that leaves none is accepted and nothing is promised to run.',
  'Nothing is deployed from here. **Deploy on FluxCloud** copies the JSON and opens FluxCloud, where you sign the registration and pay.',
];

/** Sentences about the spec on screen. Empty parts are left out. */
export function specNotes(spec: FluxAppSpec, quote: Quote): string[] {
  const out: string[] = [];
  const t = totals(spec);
  const components = spec.compose.length;
  const flux =
    quote.fluxPerMonth !== null ? `, or about ${quote.fluxPerMonth.toFixed(2)} FLUX if you pay in FLUX` : '';
  let price = `**This spec.** ${plural(spec.instances, 'instance')} of ${plural(components, 'component')} cost $${quote.usdPerMonth.toFixed(2)} a month${flux}.`;
  const discount = quote.lines.find((l) => l.id === 'hw-discount');
  if (discount?.note) price += ` The small app discount is applied. ${discount.note}`;
  if (quote.minimumApplied)
    price += ' The 0.99 minimum applies, so making a very small app smaller does not make it cheaper.';
  out.push(price);

  const fits = tiersThatFit(t);
  const smallest = fits[0];
  out.push(
    smallest
      ? `Its totals of ${t.cpu} ${t.cpu === 1 ? 'core' : 'cores'}, ${t.ram} MB of RAM and ${t.hdd} GB of disk fit on a ${TIER_NAME[smallest]} node${fits.length > 1 ? ' or larger' : ''}.`
      : `Its totals are larger than any single node tier has room for. The network allows at most ${LIMITS.totals.cpu} cores, ${LIMITS.totals.ram.toLocaleString('en-US')} MB of RAM and ${LIMITS.totals.hdd} GB of disk for one app, so registration would refuse it. Split it into smaller apps or lower the resources.`,
  );

  if (spec.instances <= 1) {
    out.push(
      `With one instance there is one copy on one node. If that node goes down the app is offline until another node picks it up, which can take about two hours (${replacementWaitMin(false)} minutes plus the image pull).`,
    );
  } else if (spec.instances === 2) {
    out.push(
      `With two instances one node can go down while the other keeps answering. The load balancer stops using a dead node in about ${FDM_EJECT_SEC} seconds.`,
    );
  } else {
    out.push(
      `With ${spec.instances} instances on different nodes the load balancer drops a failed one in about ${FDM_EJECT_SEC} seconds, and the others keep answering while the network finds a replacement.`,
    );
  }

  if (spec.compose.some((c) => c.containerData.includes('g:'))) {
    out.push(
      `**A g: volume.** One component keeps a primary and standbys, so the load balancer sends every port of the app to the primary node only. When that node fails, moving to a standby takes minutes, not seconds (about ${G_STANDBY_WAIT_MIN_PER_POSITION} minutes per place in line), and only the g: component is started and stopped by the election.`,
    );
  }
  return out;
}

export function teachNotes(spec: FluxAppSpec, quote: Quote): readonly string[] {
  return [...specNotes(spec, quote), ...LABEL_NOTES];
}

export const ABOUT_NOTES: readonly string[] = [
  'Build a Flux app spec with a form, in JSON, or both at once, and see what it would cost before you deploy anything.',
  "The checker is the same one the lessons use. The price follows Flux's published formula, and you can ask Flux's own calculator to confirm it.",
];
