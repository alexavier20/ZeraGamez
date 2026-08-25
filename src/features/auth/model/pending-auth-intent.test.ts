import { describe, expect, it } from 'vitest';

import {
  PENDING_AUTH_INTENT_KEY,
  clearPendingAuthIntent,
  consumePendingAuthIntent,
  peekPendingAuthIntent,
  savePendingAuthIntent,
} from './pending-auth-intent';

class MemoryStorage implements Storage {
  #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

describe('pending auth intents', () => {
  it('consumes a safe intent once and rejects external navigation', () => {
    const storage = new MemoryStorage();

    savePendingAuthIntent(storage, {
      version: 1,
      type: 'navigate',
      returnTo: '/minhas-listas',
    });

    expect(consumePendingAuthIntent(storage)?.returnTo).toBe('/minhas-listas');
    expect(consumePendingAuthIntent(storage)).toBeNull();

    storage.setItem(
      PENDING_AUTH_INTENT_KEY,
      JSON.stringify({ version: 1, type: 'navigate', returnTo: 'https://evil.example' }),
    );

    expect(consumePendingAuthIntent(storage)).toBeNull();
    expect(storage.getItem(PENDING_AUTH_INTENT_KEY)).toBeNull();
  });

  it('keeps a valid card action available until it is consumed', () => {
    const storage = new MemoryStorage();
    const intent = {
      version: 1 as const,
      type: 'open-add-to-lists' as const,
      returnTo: '/lancamentos' as const,
      igdbId: 7346,
    };

    savePendingAuthIntent(storage, intent);

    expect(peekPendingAuthIntent(storage)).toEqual(intent);
    expect(consumePendingAuthIntent(storage)).toEqual(intent);
    expect(peekPendingAuthIntent(storage)).toBeNull();
  });

  it.each(['/', '/lancamentos', '/minhas-listas', '/minhas-listas/nova', '/perfil'] as const)(
    'accepts the allowlisted navigation return path %s',
    (returnTo) => {
      const storage = new MemoryStorage();
      const intent = { version: 1 as const, type: 'navigate' as const, returnTo };

      savePendingAuthIntent(storage, intent);

      expect(peekPendingAuthIntent(storage)).toEqual(intent);
    },
  );

  it('rejects an unallowlisted internal navigation path and removes it', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PENDING_AUTH_INTENT_KEY,
      JSON.stringify({ version: 1, type: 'navigate', returnTo: '/admin' }),
    );

    expect(peekPendingAuthIntent(storage)).toBeNull();
    expect(storage.getItem(PENDING_AUTH_INTENT_KEY)).toBeNull();
  });

  it('removes malformed and unsupported-version payloads immediately', () => {
    const storage = new MemoryStorage();
    storage.setItem(PENDING_AUTH_INTENT_KEY, '{invalid json');

    expect(peekPendingAuthIntent(storage)).toBeNull();
    expect(storage.getItem(PENDING_AUTH_INTENT_KEY)).toBeNull();

    storage.setItem(
      PENDING_AUTH_INTENT_KEY,
      JSON.stringify({
        version: 2,
        type: 'toggle-want-to-play',
        returnTo: '/lancamentos',
        igdbId: 7346,
      }),
    );

    expect(consumePendingAuthIntent(storage)).toBeNull();
    expect(storage.getItem(PENDING_AUTH_INTENT_KEY)).toBeNull();
  });

  it('clears a stored intent explicitly', () => {
    const storage = new MemoryStorage();
    savePendingAuthIntent(storage, { version: 1, type: 'navigate', returnTo: '/' });

    clearPendingAuthIntent(storage);

    expect(peekPendingAuthIntent(storage)).toBeNull();
  });
});
