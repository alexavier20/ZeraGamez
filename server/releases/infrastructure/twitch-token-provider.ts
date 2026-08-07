import { z } from 'zod';

import {
  InvalidUpstreamResponseError,
  isTimeoutError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from './upstream-errors';

import type { Clock } from '../application/list-upcoming-releases';

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.literal('bearer'),
});

export interface AccessTokenProvider {
  getToken(): Promise<string>;
  invalidate(): void;
}

interface TwitchTokenProviderOptions {
  clientId: string;
  clientSecret: string;
  clock: Clock;
  fetcher: typeof fetch;
  timeoutMs?: number;
}

export class TwitchTokenProvider implements AccessTokenProvider {
  private cachedToken?: { token: string; expiresAt: number };
  private readonly options: TwitchTokenProviderOptions;
  private pendingToken?: Promise<string>;

  constructor(options: TwitchTokenProviderOptions) {
    this.options = options;
  }

  getToken() {
    if (this.cachedToken && this.options.clock.now().getTime() < this.cachedToken.expiresAt) {
      return Promise.resolve(this.cachedToken.token);
    }
    this.pendingToken ??= this.requestToken().finally(() => {
      this.pendingToken = undefined;
    });
    return this.pendingToken;
  }

  invalidate() {
    this.cachedToken = undefined;
  }

  private async requestToken() {
    const body = new URLSearchParams({
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      grant_type: 'client_credentials',
    });

    let response: Response;
    try {
      response = await this.options.fetcher('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 5_000),
      });
    } catch (error) {
      if (isTimeoutError(error)) throw new UpstreamTimeoutError('OAuth excedeu o timeout.');
      throw new ServiceUnavailableError('OAuth indisponível.');
    }

    if (!response.ok) throw new ServiceUnavailableError('OAuth indisponível.');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new InvalidUpstreamResponseError('Resposta OAuth inválida.');
    }

    const result = tokenResponseSchema.safeParse(payload);
    if (!result.success) throw new InvalidUpstreamResponseError('Resposta OAuth inválida.');

    this.cachedToken = {
      token: result.data.access_token,
      expiresAt: this.options.clock.now().getTime() + result.data.expires_in * 1_000 - 60_000,
    };
    return this.cachedToken.token;
  }
}
