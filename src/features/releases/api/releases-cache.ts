import { z } from 'zod';

import {
  releasesResponseSchema,
  type ReleasesResponse,
} from '../../../../shared/contracts/releases';

export const RELEASES_CACHE_TTL_MS = 15 * 60 * 1_000;
export const RELEASES_CACHE_STORAGE_KEY = 'zeragamez:releases:v1';
const MAX_ENTRIES = 24;
const MAX_STORAGE_CHARACTERS = 500_000;

const entrySchema = z.object({
  key: z.string().max(2_048),
  savedAt: z.number(),
  response: releasesResponseSchema,
});
const storedEntriesSchema = z.array(entrySchema).max(MAX_ENTRIES);
type CacheEntry = z.infer<typeof entrySchema>;
type CacheStorage = Pick<Storage, 'getItem' | 'setItem'>;
type RequestReleases = (signal: AbortSignal) => Promise<ReleasesResponse>;

interface PendingRequest {
  readonly controller: AbortController;
  readonly promise: Promise<ReleasesResponse>;
  subscribers: number;
}

interface CacheOptions {
  readonly now?: () => number;
  readonly storage?: () => CacheStorage | null;
}

function browserStorage(): CacheStorage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function abortReason(signal?: AbortSignal): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('Request aborted', 'AbortError');
}

export function createReleasesCache({
  now = Date.now,
  storage = browserStorage,
}: CacheOptions = {}) {
  const entries = new Map<string, CacheEntry>();
  const pending = new Map<string, PendingRequest>();
  let restored = false;

  const isFresh = (entry: CacheEntry) => {
    const age = now() - entry.savedAt;
    return age >= 0 && age < RELEASES_CACHE_TTL_MS;
  };

  const restore = () => {
    if (restored) return;
    restored = true;
    try {
      const serialized = storage()?.getItem(RELEASES_CACHE_STORAGE_KEY);
      if (!serialized || serialized.length > MAX_STORAGE_CHARACTERS) return;
      const parsed = storedEntriesSchema.safeParse(JSON.parse(serialized));
      if (!parsed.success) return;
      for (const entry of parsed.data) {
        if (isFresh(entry)) entries.set(entry.key, entry);
      }
    } catch {
      // Storage may be unavailable or contain data from an interrupted write.
    }
  };

  const save = (key: string, response: ReleasesResponse) => {
    // An incomplete single day cannot be split; its retry must reach the API.
    if (response.meta.sourceTruncated && response.meta.from === response.meta.to) return;
    for (const [storedKey, entry] of entries) {
      if (!isFresh(entry)) entries.delete(storedKey);
    }
    entries.delete(key);
    entries.set(key, { key, savedAt: now(), response });
    while (entries.size > MAX_ENTRIES) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) break;
      entries.delete(oldestKey);
    }

    try {
      const persisted = [...entries.values()];
      let serialized = JSON.stringify(persisted);
      while (serialized.length > MAX_STORAGE_CHARACTERS && persisted.length > 0) {
        persisted.shift();
        serialized = JSON.stringify(persisted);
      }
      storage()?.setItem(RELEASES_CACHE_STORAGE_KEY, serialized);
    } catch {
      // Keep the memory cache working when storage is blocked or full.
    }
  };

  const subscribe = (key: string, entry: PendingRequest, signal?: AbortSignal) => {
    entry.subscribers += 1;
    return new Promise<ReleasesResponse>((resolve, reject) => {
      let settled = false;
      const finish = (complete: () => void) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        entry.subscribers -= 1;
        complete();
      };
      const onAbort = () => {
        finish(() => {
          if (entry.subscribers === 0) {
            if (pending.get(key) === entry) pending.delete(key);
            entry.controller.abort();
          }
          reject(abortReason(signal));
        });
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      entry.promise.then(
        (response) => {
          finish(() => {
            resolve(response);
          });
        },
        (error: unknown) => {
          finish(() => {
            reject(error instanceof Error ? error : new Error('Release request failed'));
          });
        },
      );
    });
  };

  return {
    load(key: string, request: RequestReleases, signal?: AbortSignal): Promise<ReleasesResponse> {
      if (signal?.aborted) return Promise.reject(abortReason(signal));
      restore();
      const cached = entries.get(key);
      if (cached && isFresh(cached)) {
        entries.delete(key);
        entries.set(key, cached);
        return Promise.resolve(cached.response);
      }
      entries.delete(key);

      let entry = pending.get(key);
      if (!entry) {
        const controller = new AbortController();
        const created: PendingRequest = {
          controller,
          subscribers: 0,
          promise: Promise.resolve()
            .then(() => {
              controller.signal.throwIfAborted();
              return request(controller.signal);
            })
            .then((response) => {
              if (!controller.signal.aborted) save(key, response);
              return response;
            })
            .finally(() => {
              if (pending.get(key) === created) pending.delete(key);
            }),
        };
        pending.set(key, created);
        entry = created;
      }
      return subscribe(key, entry, signal);
    },
  };
}
