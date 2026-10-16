export class InvalidGameDetailsQueryError extends Error {}

export function parseGameDetailsId(params: URLSearchParams): number {
  for (const key of params.keys()) {
    if (key !== 'id' || params.getAll(key).length !== 1) {
      throw new InvalidGameDetailsQueryError('Parâmetro inválido.');
    }
  }

  const value = params.get('id');
  if (value === null || !/^\d+$/.test(value)) {
    throw new InvalidGameDetailsQueryError('ID inválido.');
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new InvalidGameDetailsQueryError('ID inválido.');
  }

  return id;
}
