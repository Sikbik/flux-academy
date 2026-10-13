import { describe, expect, it } from 'vitest';
import { coveredByEditable } from './validate-spec';

describe('coveredByEditable', () => {
  it('matches the exact path and paths inside or around it', () => {
    expect(coveredByEditable('compose[0].cpu', ['compose[0].cpu'])).toBe(true);
    expect(coveredByEditable('compose[0].ports[1]', ['compose[0].ports'])).toBe(true);
    expect(coveredByEditable('compose[0]', ['compose[0].cpu'])).toBe(true);
    expect(coveredByEditable('compose', ['compose[0].cpu'])).toBe(true);
  });

  it('does not match a sibling or a different index', () => {
    expect(coveredByEditable('compose[0].ram', ['compose[0].cpu'])).toBe(false);
    expect(coveredByEditable('compose[1].cpu', ['compose[0].cpu'])).toBe(false);
    expect(coveredByEditable('instances', ['instance'])).toBe(false);
  });

  it('treats [*] as any index, like the Spec Forge', () => {
    expect(coveredByEditable('compose[0].cpu', ['compose[*].cpu'])).toBe(true);
    expect(coveredByEditable('compose[7].cpu', ['compose[*].cpu'])).toBe(true);
    expect(coveredByEditable('compose[2].ram', ['compose[*].cpu'])).toBe(false);
    expect(coveredByEditable('compose[1]', ['compose[*].cpu'])).toBe(true);
    expect(coveredByEditable('compose[1].ports[0]', ['compose[*].ports'])).toBe(true);
  });

  it('never lets an empty change slip through unless the root is editable', () => {
    expect(coveredByEditable('', ['compose[*].cpu'])).toBe(false);
    expect(coveredByEditable('', [''])).toBe(true);
  });
});
