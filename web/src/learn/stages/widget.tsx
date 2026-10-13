/**
 * The `widget` stage: looks up `learn/widgets/<id>/index.tsx` by glob and renders it with the same props
 * the engine gave this stage. A widget that has not been built yet gets a friendly panel, not an error.
 * Owner: the lesson engine (the widgets themselves belong to their authors).
 */

import { type LazyExoticComponent, lazy, Suspense } from 'react';
import { BuildingPanel } from '../parts/BuildingPanel';
import { StageSkeleton } from '../parts/StageSkeleton';
import type { StageComponentProps, WidgetComponent } from '../stage-api';
import type { WidgetStage } from '../types';

// No type argument on the glob: Vitest's disk cache skips files that contain the literal `import.meta.glob(`.
const loaders = import.meta.glob('../widgets/*/index.tsx') as Record<
  string,
  () => Promise<{ default: WidgetComponent }>
>;

function idOf(path: string): string {
  const m = path.match(/widgets\/([^/]+)\/index\.tsx$/);
  return m?.[1] ?? path;
}

const byId = new Map(Object.entries(loaders).map(([p, l]) => [idOf(p), l]));
const lazies = new Map<string, LazyExoticComponent<WidgetComponent>>();

function widgetComponent(id: string): LazyExoticComponent<WidgetComponent> | null {
  const load = byId.get(id);
  if (!load) return null;
  let c = lazies.get(id);
  if (!c) {
    c = lazy(load);
    lazies.set(id, c);
  }
  return c;
}

export default function WidgetStageView(props: StageComponentProps<WidgetStage>) {
  const { stage, host, task } = props;
  const Widget = widgetComponent(stage.id);
  if (!Widget) {
    return <BuildingPanel what={`The widget "${stage.id}"`} stage={stage} host={host} task={task} />;
  }
  return (
    <Suspense fallback={<StageSkeleton label="Loading the widget" />}>
      <Widget {...props} />
    </Suspense>
  );
}
