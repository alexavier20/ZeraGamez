export class InvalidUpstreamResponseError extends Error {}
export class ServiceUnavailableError extends Error {}
export class UpstreamTimeoutError extends Error {}

export function isTimeoutError(error: unknown) {
  return error instanceof DOMException && error.name === 'TimeoutError';
}
