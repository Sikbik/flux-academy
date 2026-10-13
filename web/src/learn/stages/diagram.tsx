/**
 * The `diagram` stage: draws one of the lesson diagrams (`learn/diagrams/<id>.tsx`) at one beat.
 *
 *   { kind: 'diagram', id: 'port-mapping', beat: 1, props: { port: 31001 } }
 *
 * The diagram is a pure function of `beat` and `props`; this adapter only finds it, frames it (a figure with
 * the real `FIG n.m` caption, a beat scrubber and a description) and feeds it live data where the figure has
 * a number that is live. The scrubber lets the learner look around the story; it never touches the step's
 * task, and the next lesson step moves the figure back to the beat it asks for.
 *
 * `props.fig` overrides the figure number. An unknown id or beat gives a calm panel, not an error, and the
 * lesson text still stands on its own. Owner: the diagrams owner.
 */

import { useMemo } from 'react';
import { useNetwork } from '@/data';
import { useReducedMotion } from '@/ui';
import { DiagramFigure } from '../diagrams/_kit/Figure';
import type { StageComponentProps } from '../stage-api';
import type { DiagramStage } from '../types';

type Props = Record<string, unknown> | undefined;

/** An authored figure number, when the lesson wants one (`FIG 12.2` in a reference page, say). */
function figureOf(props: Props): number | undefined {
  const f = props?.fig;
  return typeof f === 'number' && Number.isInteger(f) && f > 0 && f < 1000 ? f : undefined;
}

/** The props the diagram itself gets: the authored ones, without the adapter's own keys. */
function diagramProps(props: Props): Props {
  if (!props || !('fig' in props)) return props;
  const { fig: _fig, ...rest } = props;
  return rest;
}

interface InnerProps {
  stage: DiagramStage;
  props: Props;
  compact: boolean | undefined;
}

function Plain({ stage, props, compact }: InnerProps) {
  const reduced = useReducedMotion();
  return (
    <DiagramFigure
      id={stage.id}
      beat={stage.beat ?? 0}
      props={props}
      reducedMotion={reduced}
      compact={compact}
      framed={false}
      figure={figureOf(stage.props)}
    />
  );
}

/**
 * `tier-ladder` shows how many nodes each tier has. That number is live, so the figure gets the network
 * snapshot's counts and says where they came from (live, cached or the built-in sample). Authored props win.
 * The collateral and the payout stay the documented protocol constants, which the lesson text quotes too.
 */
function TierLadderLive({ stage, props, compact }: InnerProps) {
  const network = useNetwork();
  const merged = useMemo<Props>(() => {
    const nodes = network.data?.nodes;
    if (!nodes) return props;
    const basis =
      network.status === 'live'
        ? 'live'
        : network.status === 'cache' || network.status === 'offline'
          ? 'cache'
          : 'fallback';
    return { counts: nodes.tiers, basis, ...props };
  }, [network.data, network.status, props]);
  return <Plain stage={stage} props={merged} compact={compact} />;
}

export default function DiagramStageView({ stage, compact }: StageComponentProps<DiagramStage>) {
  const props = useMemo(() => diagramProps(stage.props), [stage.props]);
  if (stage.id === 'tier-ladder') return <TierLadderLive stage={stage} props={props} compact={compact} />;
  return <Plain stage={stage} props={props} compact={compact} />;
}
