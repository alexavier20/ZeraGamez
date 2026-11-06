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
  { label: 'S', color: 'bg-[#ff7a7a]' },
  { label: 'A', color: 'bg-[#ffbf7a]' },
  { label: 'B', color: 'bg-[#ffe07a]' },
  { label: 'C', color: 'bg-[#ffff83]' },
  { label: 'D', color: 'bg-[#b7ff87]' },
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
        className="mb-4 font-heading text-xl font-semibold sm:text-2xl text-text-primary"
        id="tier-lists-heading"
      >
        Minhas Tier Lists
      </h2>

      {authState.status === 'loading' || (repository !== null && state.status === 'loading') ? (
        <ListCardsLoading tiers />
      ) : state.status !== 'success' || repository === null ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-center">
          <p className="text-sm text-red-100" role="alert">
            Não foi possível carregar suas Tier Lists.
          </p>
          <button
            className="mt-3 rounded-xl border border-red-200/30 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => {
              setRetryKey((value) => value + 1);
            }}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : state.lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-surface p-8 text-center">
          <p className="text-text-muted">Você ainda não criou nenhuma Tier List.</p>
          <Link
            className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-bright"
            to="/minhas-listas/nova"
          >
            Criar Tier List
          </Link>
        </div>
      ) : (
        <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {state.lists.map((list) => (
            <Link
              className="group overflow-hidden rounded-2xl border border-white/10 bg-surface transition-colors duration-150 hover:border-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              key={list.id}
              to={`/minhas-listas/tier/${String(list.id)}`}
            >
              <div aria-hidden="true" className="grid aspect-[3/1] grid-cols-5 overflow-hidden">
                {sampleTiers.map((tier) => (
                  <span
                    className={`${tier.color} grid place-items-center font-heading text-sm font-semibold text-black/75`}
                    key={tier.label}
                  >
                    {tier.label}
                  </span>
                ))}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3
                    className="line-clamp-2 min-h-10 min-w-0 flex-1 break-words font-heading text-sm leading-5 font-semibold text-content-primary"
                    title={list.name}
                  >
                    {list.name}
                  </h3>
                  <span className="shrink-0 pt-0.5 text-[11px] leading-5 font-medium tabular-nums text-text-muted">
                    {String(list.gameCount)} {list.gameCount === 1 ? 'jogo' : 'jogos'}
                  </span>
                </div>
                <p
                  className="line-clamp-2 min-h-10 break-words text-xs leading-5 text-text-muted"
                  title={list.description ?? undefined}
                >
                  {list.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
