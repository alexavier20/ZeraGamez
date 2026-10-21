export type DataErrorCode =
  | 'configuration'
  | 'unauthenticated'
  | 'permission'
  | 'conflict'
  | 'list_name_conflict'
  | 'list_name_reserved'
  | 'network'
  | 'google_provider_disabled'
  | 'unexpected';

const DATA_ERROR_MESSAGES: Record<DataErrorCode, string> = {
  configuration: 'A autenticação ainda não está configurada.',
  unauthenticated: 'Faça login para continuar.',
  permission: 'Você não tem permissão para realizar esta ação.',
  conflict: 'Não foi possível concluir porque os dados foram alterados.',
  list_name_conflict: 'Você já tem uma lista com esse nome.',
  list_name_reserved:
    'Os nomes "Quero Jogar!" e "Já Zerei" são reservados para listas automáticas.',
  network: 'Não foi possível conectar ao serviço. Tente novamente.',
  google_provider_disabled:
    'O login com Google não está habilitado. Use o código enviado por e-mail para entrar.',
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
  if (isRecord(error)) {
    if (
      error.code === '23505' &&
      (error.constraint === 'lists_user_name_unique' ||
        error.message === 'A list with this name already exists for the user')
    ) {
      return new DataError('list_name_conflict', { cause: error });
    }
    if (
      error.code === '23514' &&
      (error.constraint === 'lists_reserved_want_to_play_name' ||
        error.constraint === 'lists_reserved_system_name' ||
        error.message === 'The list name is reserved for the want-to-play list' ||
        error.message === 'A system list name is reserved')
    ) {
      return new DataError('list_name_reserved', { cause: error });
    }
  }
  return new DataError('unexpected', { cause: error });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
