/**
 * A deliberately small renderer for the explanation under a command: `code`, **bold** and *italic*.
 * The lesson markup has more (term cards, links); a host that wants them passes `renderMarkup` to
 * the terminal. This one has no dependencies, so the terminal works anywhere, and it degrades the
 * richer tokens to their text instead of showing braces.
 */

import { Fragment, type ReactNode } from 'react';

const TOKEN =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\{\{kbd:[^}\n]+\}\}|\{\{[a-z]+:[^}\n]+\}\}|\[[^\]\n]+\]\([^)\n]+\))/g;

export function renderInline(text: string): ReactNode {
  const parts = text.split(TOKEN);
  return parts.map((part, i) => {
    const key = i;
    if (part === '') return null;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('{{kbd:')) return <kbd key={key}>{part.slice(6, -2)}</kbd>;
    if (part.startsWith('{{')) {
      const id = part.slice(2, -2).split(':').slice(1).join(':');
      return <Fragment key={key}>{id.replace(/-/g, ' ')}</Fragment>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) return <Fragment key={key}>{link[1]}</Fragment>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}
