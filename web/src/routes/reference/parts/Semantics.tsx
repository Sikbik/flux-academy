import type { ComponentProps } from 'react';

/*
 * Three elements that carry their roles on purpose. Each exists so the reason for the explicit role is
 * written down once instead of at every use.
 */

/**
 * A list that has `list-style: none`. Safari and VoiceOver drop the list role from such a list, so the
 * role is stated again. The same element, nothing else changes.
 */
export function Ul(props: ComponentProps<'ul'>) {
  // biome-ignore lint/a11y/noRedundantRoles: list-style: none drops list semantics in Safari and VoiceOver
  return <ul role="list" {...props} />;
}

/** The ordered form of {@link Ul}. */
export function Ol(props: ComponentProps<'ol'>) {
  // biome-ignore lint/a11y/noRedundantRoles: list-style: none drops list semantics in Safari and VoiceOver
  return <ol role="list" {...props} />;
}

/**
 * A named set of related controls or lines. It is a `div` with the group role instead of a `fieldset`,
 * because these sets are rows of chips and lines of code, not form groups, and a `fieldset` brings a
 * legend and its own layout rules.
 */
export function Group({
  label,
  ...rest
}: Omit<ComponentProps<'div'>, 'role' | 'aria-label'> & { label: string }) {
  // biome-ignore lint/a11y/useSemanticElements: a named row of arbitrary content, not a form group
  return <div role="group" aria-label={label} {...rest} />;
}
