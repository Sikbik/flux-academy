/** What every part of a topic page may ask for: the topic and its numbered sections. */

import { createContext, useContext } from 'react';
import type { TopicMeta } from '@/content/reference';
import type { NumberedSection } from './model';

export interface TopicContextValue {
  topic: TopicMeta;
  /** The sections of the topic by id, in page order, with their numbers. */
  sections: ReadonlyMap<string, NumberedSection>;
}

export const TopicContext = createContext<TopicContextValue | null>(null);

export function useTopic(): TopicContextValue {
  const value = useContext(TopicContext);
  if (!value) throw new Error('reference: a section was rendered outside a topic page');
  return value;
}
