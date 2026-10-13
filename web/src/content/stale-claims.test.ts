/**
 * Regression guard for a retired statistic.
 *
 * The academy used to say that about 22 percent (78 of 351) of live single-instance apps had no running
 * copy. The 78 are blocklisted Orbit deployments, so the figure measured a blocklist artefact and not how
 * fragile one instance is (FACTS 6.5 CORRECTED note, 11 row 13, 15.3.3). No lesson, lab, troubleshooter
 * entry or reference page may say it again. A dated sample goes through `ORBIT_FACTS` and carries its date.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const SELF = 'stale-claims.test.ts';

const RETIRED: readonly RegExp[] = [
  /one in five/i,
  /\b78 of (?:the )?35[12]\b/i,
  /\b8 of (?:the )?43[46]\b/i,
  /\b22 percent\b/i,
  /\b22 ?%\s+of\b/i,
  /singleInstanceNoCopy/,
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name) && !path.endsWith(SELF)) out.push(path);
  }
  return out;
}

describe('the retired single-instance statistic', () => {
  it('appears nowhere in web/src', () => {
    const found: string[] = [];
    for (const file of sourceFiles(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (RETIRED.some((re) => re.test(line))) found.push(`${file.slice(SRC.length)}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
  });
});
