/**
 * Identity of the Terminal lab. The curriculum (`shared/curriculum.ts` `LABS`) lists the same id, the lab
 * registry finds the working area in `./index.tsx`, and lessons reach it with `{{lab:terminal}}`.
 */
export const id = 'terminal' as const;

export const lab = { id } as const;

export default lab;
