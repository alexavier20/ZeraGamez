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
  private cachedToken?: { token: string; expiresAt: number; generation: number };
  private generation = 0;
  private readonly options: TwitchTokenProviderOptions;
  private pendingToken?: { generation: number; promise: Promise<string> };

  constructor(options: TwitchTokenProviderOptions) {
    this.options = options;
  }

  getToken() {
    const generation = this.generation;
    if (
      this.cachedToken?.generation === generation &&
      this.options.clock.now().getTime() < this.cachedToken.expiresAt
    ) {
      return Promise.resolve(this.cachedToken.token);
    }
    if (this.pendingToken?.generation !== generation) {
      const promise = this.requestToken(generation).finally(() => {
        if (this.pendingToken?.promise === promise) this.pendingToken = undefined;
      });
      this.pendingToken = { generation, promise };
    }
    return this.pendingToken.promise;
  }

  invalidate() {
    this.generation += 1;
    this.cachedToken = undefined;
    this.pendingToken = undefined;
  }

  private async requestToken(generation: number) {
    const body = new URLSearchParams({
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      grant_type: 'client_credentials',
    });
    const timeoutSignal = AbortSignal.timeout(this.options.timeoutMs ?? 5_000);

    let response: Response;
    try {
      response = await this.options.fetcher('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: timeoutSignal,
      });
    } catch (error) {
      if (isTimeoutError(error) || isTimeoutError(timeoutSignal.reason)) {
        throw new UpstreamTimeoutError('OAuth excedeu o timeout.');
      }
      throw new ServiceUnavailableError('OAuth indisponível.');
    }

    if (!response.ok) throw new ServiceUnavailableError('OAuth indisponível.');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (isTimeoutError(error) || isTimeoutError(timeoutSignal.reason)) {
        throw new UpstreamTimeoutError('OAuth excedeu o timeout.');
      }
      if (error instanceof SyntaxError) {
        throw new InvalidUpstreamResponseError('Resposta OAuth inválida.');
      }
      throw new ServiceUnavailableError('OAuth indisponível.');
    }

    const result = tokenResponseSchema.safeParse(payload);
    if (!result.success) throw new InvalidUpstreamResponseError('Resposta OAuth inválida.');

    const token = result.data.access_token;
    if (generation === this.generation) {
      this.cachedToken = {
        token,
        expiresAt: this.options.clock.now().getTime() + result.data.expires_in * 1_000 - 60_000,
        generation,
      };
    }
    return token;
  }
}
