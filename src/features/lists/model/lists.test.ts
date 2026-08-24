import { describe, expect, it } from 'vitest';

import { normalizeCreateListInput } from './lists';

describe('normalizeCreateListInput', () => {
  it('normalizes a valid custom list input', () => {
    expect(
      normalizeCreateListInput({
        name: '  RPGs  ',
        description: '  Para jogar em 2027  ',
      }),
    ).toEqual({
      name: 'RPGs',
      description: 'Para jogar em 2027',
    });
  });

  it('rejects an empty name after normalization', () => {
    expect(() => normalizeCreateListInput({ name: '   ', description: '' })).toThrow(
      'Informe um nome para a lista.',
    );
  });

  it('rejects names over 80 characters and descriptions over 500', () => {
    expect(() => normalizeCreateListInput({ name: 'x'.repeat(81), description: '' })).toThrow(
      'O nome deve ter no máximo 80 caracteres.',
    );
    expect(() =>
      normalizeCreateListInput({ name: 'RPGs', description: 'x'.repeat(501) }),
    ).toThrow('A descrição deve ter no máximo 500 caracteres.');
  });
});
