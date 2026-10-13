/**
 * Freshness chip and sentence for one live resource. Each is its own component so the one second ticker
 * re-renders a chip, never the lab around it.
 */
import { describeStatus, freshnessKind, type ResourceKey, useDataAge, useDataStore } from '@/data';
import { FreshnessChip } from '@/ui';

export function DataChip({ resource }: { resource: ResourceKey }) {
  const status = useDataStore((s) => s[resource].status);
  const connection = useDataStore((s) => s.connection);
  const age = useDataAge(resource);
  return <FreshnessChip kind={freshnessKind(status)} ageMs={age} polling={connection === 'polling'} />;
}

/** The one sentence that explains a number that is not live, or nothing while it is. */
export function DataNote({
  resource,
  label,
  as: Tag = 'li',
  className,
}: {
  resource: ResourceKey;
  label: string;
  as?: 'li' | 'p';
  className?: string;
}) {
  const status = useDataStore((s) => s[resource].status);
  const meta = useDataStore((s) => s[resource].meta);
  const connection = useDataStore((s) => s.connection);
  if (status === 'live' || status === 'loading') return null;
  const chip = describeStatus(status, { meta, connection });
  return (
    <Tag className={className}>
      {label}: {chip.sentence}
    </Tag>
  );
}
