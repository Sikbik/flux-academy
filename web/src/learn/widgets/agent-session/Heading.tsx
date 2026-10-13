import type { HTMLAttributes, Ref } from 'react';

/** A heading at a level chosen by the host page, so the outline stays in order wherever the session sits. */
export function Heading({
  level,
  ref,
  ...rest
}: { level: number; ref?: Ref<HTMLHeadingElement> } & HTMLAttributes<HTMLHeadingElement>) {
  const Tag = `h${Math.min(6, Math.max(2, Math.round(level)))}` as 'h2';
  return <Tag ref={ref} {...rest} />;
}
