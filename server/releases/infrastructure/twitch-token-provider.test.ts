// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { readIgdbEnvironment } from './env';
import { TwitchTokenProvider } from './twitch-token-provider';
import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from './upstream-errors';

function tokenResponse(token = 'token', expiresIn = 3_600) {
  return Response.json({ access_token: token, expires_in: expiresIn, token_type: 'bearer' });
}

function setup(fetcher: typeof fetch, initial = '2026-08-07T12:00:00.000Z') {
  let now = new Date(initial);
  const provider = new TwitchTokenProvider({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    clock: { now: () => now },
    fetcher,
  });
  return {
    provider,
    advance: (milliseconds: number) => (now = new Date(now.getTime() + milliseconds)),
  };
}

describe('readIgdbEnvironment', () => {
  it('retorna somente as credenciais validadas', () => {
    expect(
      readIgdbEnvironment({
        IGDB_CLIENT_ID: 'client-id',
        IGDB_CLIENT_SECRET: 'client-secret',
      }),
    ).toEqual({ clientId: 'client-id', clientSecret: 'client-secret' });
  });

  it('rejeita configuração incompleta sem expor valores', () => {
    expect(() =>
      readIgdbEnvironment({
        IGDB_CLIENT_ID: '',
        IGDB_CLIENT_SECRET: 'raw-secret',
      }),
    ).toThrow(ServiceUnavailableError);
    try {
      readIgdbEnvironment({ IGDB_CLIENT_ID: '', IGDB_CLIENT_SECRET: 'raw-secret' });
    } catch (error) {
      expect(String(error)).not.toContain('raw-secret');
    }
  });
});

describe('TwitchTokenProvider', () => {
  it('envia credenciais no formulário e reutiliza o token válido', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(tokenResponse());
    const { provider } = setup(fetcher);

    await expect(provider.getToken()).resolves.toBe('token');
    await expect(provider.getToken()).resolves.toBe('token');

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://id.twitch.tv/oauth2/token');
    expect(url).not.toContain('client-secret');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    if (!(init?.body instanceof URLSearchParams)) throw new Error('OAuth body is not form data.');
    expect(init.body.toString()).toBe(
      'client_id=client-id&client_secret=client-secret&grant_type=client_credentials',
    );
  });

  it('compartilha a renovação simultânea', async () => {
    let resolveResponse!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => (resolveResponse = resolve));
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(pending);
    const { provider } = setup(fetcher);

    const first = provider.getToken();
    const second = provider.getToken();
    resolveResponse(tokenResponse());

    await expect(Promise.all([first, second])).resolves.toEqual(['token', 'token']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('renova na margem de segurança e após invalidação', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse('first', 120))
      .mockResolvedValueOnce(tokenResponse('second', 120))
      .mockResolvedValueOnce(tokenResponse('third', 120));
    const { provider, advance } = setup(fetcher);

    await expect(provider.getToken()).resolves.toBe('first');
    advance(60_000);
    await expect(provider.getToken()).resolves.toBe('second');
    provider.invalidate();
    await expect(provider.getToken()).resolves.toBe('third');
  });

  it.each([
    {
      response: new Response('{', { status: 200 }),
      error: InvalidUpstreamResponseError,
    },
    {
      response: new Response(null, { status: 503 }),
      error: ServiceUnavailableError,
    },
  ])('normaliza resposta OAuth inválida', async ({ response, error }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(setup(fetcher).provider.getToken()).rejects.toBeInstanceOf(error);
  });

  it('normaliza timeout', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('timeout', 'TimeoutError'));

    await expect(setup(fetcher).provider.getToken()).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });
});
