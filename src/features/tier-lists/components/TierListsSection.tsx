import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { createSupabaseTierListsRepository } from '@/features/tier-lists/api/tier-lists-repository';
import { ListCardsLoading } from '@/shared/components/LoadingSkeletons';
import { getSupabaseClient } from '@/shared/supabase/client';

import type { TierListSummary } from '@/features/tier-lists/model/tier-lists';

type TierListsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'success'; readonly lists: readonly TierListSummary[] };

const sampleTiers = [
  { label: 'S', color: 'bg-brand text-brand-ink' },
  { label: 'A', color: 'bg-secondary text-brand-ink' },
  { label: 'B', color: 'bg-bg-secondary text-text-primary' },
  { label: 'C', color: 'bg-border text-text-primary' },
  { label: 'D', color: 'bg-app text-text-primary' },
] as const;

export function TierListsSection() {
  const { state: authState } = useAuth();
  const client = useMemo(() => getSupabaseClient(), []);
  const repository = useMemo(
    () => (client === null ? null : createSupabaseTierListsRepository(client)),
    [client],
  );
  const [state, setState] = useState<TierListsState>({ status: 'loading' });
  const [retryKey, setRetryKey] = useState(0);
  const userId = authState.status === 'authenticated' ? authState.user.id : null;

  useEffect(() => {
    if (repository === null || userId === null) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setState({ status: 'loading' });
    });
    void repository
      .listSummaries(userId)
      .then((lists) => {
        if (active) setState({ status: 'success', lists });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });

    return () => {
      active = false;
    };
  }, [repository, retryKey, userId]);

  return (
    <section aria-labelledby="tier-lists-heading" className="mt-10">
      <h2
        className="mb-4 flex items-center gap-2 font-heading text-xl font-semibold text-text-primary sm:text-2xl"
        id="tier-lists-heading"
      >
        <span
          aria-hidden="true"
          className="h-6 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-brand"
        />
        Minhas Tier Lists
      </h2>

      {authState.status === 'loading' || (repository !== null && state.status === 'loading') ? (
        <ListCardsLoading tiers />
      ) : state.status !== 'success' || repository === null ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-center">
          <p className="text-sm text-red-700" role="alert">
            Não foi possível carregar suas Tier Lists.
          </p>
          <button
            className="mt-3 rounded-xl border border-red-200/30 px-4 py-2 text-sm font-semibold text-red-700"
            onClick={() => {
              setRetryKey((value) => value + 1);
            }}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : state.lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-text-muted">Você ainda não criou nenhuma Tier List.</p>
          <Link
      className="mt-5 inline-flex cut-corner-button bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors duration-150 hover:bg-brand-hover hover:text-brand-ink"
            to="/minhas-listas/nova"
          >
            Criar Tier List
          </Link>
        </div>
      ) : (
        <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {state.lists.map((list) => (
            <Link
              className="group relative cut-corner-card bg-brand p-[10px] transition-colors duration-200 ease-out hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
              key={list.id}
              to={`/minhas-listas/tier/${String(list.id)}`}
            >
              <div className="cut-corner-card-content overflow-hidden">
                <div aria-hidden="true" className="grid aspect-[2/1] grid-cols-5 overflow-hidden">
                  {sampleTiers.map((tier) => (
                    <span
                      className={`${tier.color} grid place-items-center font-heading text-sm font-semibold`}
                      key={tier.label}
                    >
                      {tier.label}
                    </span>
                  ))}
                </div>
                <div className="flex h-12 flex-col justify-center bg-brand px-4 text-brand-ink transition-colors duration-200 ease-out group-hover:bg-red-600 group-hover:text-text-primary">
                  <div className="flex h-7 items-center justify-between gap-3">
                    <h3
                      className="min-w-0 flex-1 truncate font-heading text-sm leading-5 font-semibold text-brand-ink transition-colors duration-200 ease-out group-hover:text-text-primary"
                      title={list.name}
                    >
                      {list.name}
                    </h3>
                    <span className="shrink-0 text-[11px] leading-5 font-medium tabular-nums text-brand-ink transition-colors duration-200 ease-out group-hover:text-text-primary">
                      {String(list.gameCount)} {list.gameCount === 1 ? 'jogo' : 'jogos'}
                    </span>
                  </div>
                  {list.description?.trim() ? (
                    <p
                      className="flex h-5 items-center truncate text-xs leading-4 text-brand-ink transition-colors duration-200 ease-out group-hover:text-text-primary"
                      title={list.description}
                    >
                      {list.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
