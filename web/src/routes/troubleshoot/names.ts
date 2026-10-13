import { createContext, useContext } from 'react';
import { type Names, NO_NAMES } from './model';

/** The visitor's own app name and domain, already cleaned, for filling `{app}` and `{domain}`. */
export const NamesContext = createContext<Names>(NO_NAMES);

export function useNames(): Names {
  return useContext(NamesContext);
}
