import { useCallback, useEffect, useState } from 'react';

import { fetchGameDetails, GameDetailsClientError } from '@/features/games/api/game-details-client';

import type { GameDetails } from '../../../../shared/contracts/game-details';

export type GameDetailsState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | { readonly status: 'success'; readonly game: GameDetails };

export function useGameDetails(id: number | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    readonly attempt: number;
    readonly id: number;
    readonly state: GameDetailsState;
  }>({ attempt: -1, id: -1, state: { status: 'loading' } });

  useEffect(() => {
    if (id === null) return;

    const controller = new AbortController();
    void fetchGameDetails(id, { signal: controller.signal })
      .then((game) => {
        setResult({ attempt, id, state: { status: 'success', game } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof GameDetailsClientError && error.status === 404) {
          setResult({ attempt, id, state: { status: 'not-found' } });
          return;
        }
        setResult({ attempt, id, state: { status: 'error' } });
      });

    return () => {
      controller.abort();
    };
  }, [attempt, id]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);
  const state: GameDetailsState =
    id === null
      ? { status: 'not-found' }
      : result.id === id && result.attempt === attempt
        ? result.state
        : { status: 'loading' };
  return { retry, state };
}
