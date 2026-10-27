import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { createSupabaseTierListsRepository } from '@/features/tier-lists/api/tier-lists-repository';
import type { TierListSummary } from '@/features/tier-lists/model/tier-lists';
import { getSupabaseClient } from '@/shared/supabase/client';

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
    setState({ status: 'loading' });
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
        className="mb-4 font-heading text-2xl font-bold text-text-primary"
        id="tier-lists-heading"
      >
        Minhas Tier Lists
      </h2>

      {authState.status === 'loading' || (repository !== null && state.status === 'loading') ? (
        <div
          aria-label="Carregando suas Tier Lists"
          className="h-36 animate-pulse rounded-2xl bg-surface"
          role="status"
        />
      ) : state.status === 'error' || repository === null ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-center">
          <p className="text-sm text-red-100" role="alert">
            Não foi possível carregar suas Tier Lists.
          </p>
          <button
            className="mt-3 rounded-xl border border-red-200/30 px-4 py-2 text-sm font-bold text-white"
            onClick={() => setRetryKey((value) => value + 1)}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : state.lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-surface p-8 text-center">
          <p className="text-text-muted">Você ainda não criou nenhuma Tier List.</p>
          <Link
            className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-bright"
            to="/minhas-listas/nova"
          >
            Criar Tier List
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {state.lists.map((list) => (
            <Link
              className="group overflow-hidden rounded-2xl bg-surface shadow-lg shadow-black/10 transition hover:ring-1 hover:ring-brand/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              key={list.id}
              to={`/minhas-listas/tier/${String(list.id)}`}
            >
              <div aria-hidden="true" className="grid aspect-[3/1] grid-cols-5 overflow-hidden">
                {sampleTiers.map((tier) => (
                  <span
                    className={`${tier.color} grid place-items-center font-heading text-lg font-bold text-black/75`}
                    key={tier.label}
                  >
                    {tier.label}
                  </span>
                ))}
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-heading text-lg font-bold text-content-primary">
                    {list.name}
                  </h3>
                  {list.description === null || list.description.length === 0 ? null : (
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-text-muted">
                      {list.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-text-muted">
                    {String(list.gameCount)} {list.gameCount === 1 ? 'jogo' : 'jogos'}
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-bright"
                  size={18}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
