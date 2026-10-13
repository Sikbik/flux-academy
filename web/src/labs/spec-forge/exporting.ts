/**
 * What leaves the forge: the text for Deploy on FluxCloud, and the spec behind a share link.
 *
 * Both start from the spec as the editor holds it. Two things are adjusted on the way out, and the caller is
 * told so it can say it:
 *
 *   enterprise   The forge marks an enterprise spec with a placeholder (FluxCloud makes the real encrypted
 *                value itself). A copy for FluxCloud leaves the field empty, so the placeholder is never
 *                mistaken for a value.
 *   repoauth     Registry credentials never go into a link: a link ends up in chat, history and logs.
 */

import type { FluxAppSpec } from '@shared/flux/types';
import { isEnterprisePlaceholder, specToText } from '@/forge/model';

export interface DeployCopy {
  text: string;
  /** The spec was marked enterprise, so the copy has `enterprise` empty. */
  enterpriseLeftEmpty: boolean;
}

export function deployCopy(spec: FluxAppSpec): DeployCopy {
  const placeholder = isEnterprisePlaceholder(spec.enterprise);
  const out = placeholder ? { ...spec, enterprise: '' } : spec;
  return { text: specToText(out), enterpriseLeftEmpty: placeholder };
}

export interface ShareCopy {
  spec: FluxAppSpec;
  /** Number of components whose `repoauth` was left out. */
  credentialsLeftOut: number;
}

export function shareCopy(spec: FluxAppSpec): ShareCopy {
  let left = 0;
  const compose = spec.compose.map((c) => {
    if (!c.repoauth) return c;
    left++;
    return { ...c, repoauth: '' };
  });
  return { spec: left === 0 ? spec : { ...spec, compose }, credentialsLeftOut: left };
}
