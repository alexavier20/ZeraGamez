export type DataErrorCode =
  'configuration' | 'unauthenticated' | 'permission' | 'conflict' | 'network' | 'unexpected';

const DATA_ERROR_MESSAGES: Record<DataErrorCode, string> = {
  configuration: 'A autenticação ainda não está configurada.',
  unauthenticated: 'Faça login para continuar.',
  permission: 'Você não tem permissão para realizar esta ação.',
  conflict: 'Não foi possível concluir porque os dados foram alterados.',
  network: 'Não foi possível conectar ao serviço. Tente novamente.',
  unexpected: 'Algo deu errado. Tente novamente.',
};

export class DataError extends Error {
  readonly code: DataErrorCode;

  constructor(code: DataErrorCode, options?: ErrorOptions) {
    super(DATA_ERROR_MESSAGES[code], options);
    this.name = 'DataError';
    this.code = code;
  }
}

export function toDataError(error: unknown): DataError {
  if (error instanceof DataError) return error;
  return new DataError('unexpected', { cause: error });
}
