import { Plus } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';

import { useLists } from '@/features/lists/context/ListsProvider';
import { headerRoutes } from '@/shared/components/header/header.config';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

import type { UserListSummary } from '@/features/lists/model/lists';

function gameCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'jogo' : 'jogos'}`;
}

function ListSummary({ list }: { readonly list: UserListSummary }) {
  const covers = list.covers
    .filter((cover): cover is string => typeof cover === 'string' && cover.length > 0)
    .slice(0, 3);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-lg shadow-black/10">
      {covers.length > 0 ? (
        <div className="grid h-36 grid-cols-3 overflow-hidden bg-surface-raised">
          {covers.map((cover, index) => (
            <img
              alt={`Capa de ${list.name} ${String(index + 1)}`}
              className="h-full w-full object-cover"
              key={cover}
              src={cover}
            />
          ))}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="h-20 bg-gradient-to-br from-brand/25 to-surface-raised"
        />
      )}
      <div className="space-y-2 p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-content-primary">{list.name}</h2>
          <span className="shrink-0 rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand-light">
            {gameCountLabel(list.gameCount)}
          </span>
        </div>
        {list.description === null || list.description.length === 0 ? null : (
          <p className="text-sm leading-6 text-text-muted">{list.description}</p>
        )}
      </div>
    </article>
  );
}

function LoadingLists() {
  return (
    <div
      aria-label="Carregando suas listas"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
    >
      <span className="sr-only">Carregando suas listas</span>
      {[0, 1, 2].map((item) => (
        <div
          aria-hidden="true"
          className="h-56 animate-pulse rounded-2xl border border-white/10 bg-surface"
          key={item}
        />
      ))}
    </div>
  );
}

export function MyListsPage() {
  const { listsState, loadLists } = useLists();

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  return (
    <main className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pt-7 pb-28 sm:px-5 sm:pb-12 lg:px-8 lg:pt-9">
      <div className="flex items-start justify-between gap-4">
        <PageHeading title="Minhas listas" subtitle="Organize os jogos do seu jeito" />
        <Link
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to={headerRoutes.createList}
        >
          <Plus aria-hidden="true" size={18} />
          Criar lista
        </Link>
      </div>

      <section aria-label="Suas listas" className="mt-8">
        {listsState.status === 'idle' || listsState.status === 'loading' ? (
          <LoadingLists />
        ) : listsState.status === 'error' ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-100" role="alert">
              {listsState.message}
            </p>
            <button
              className="mt-4 rounded-xl border border-red-200/30 px-4 py-2 text-sm font-bold text-white"
              onClick={() => void loadLists()}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        ) : listsState.lists.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-surface p-8 text-center">
            <p className="text-text-muted">Você ainda não criou nenhuma lista.</p>
            <Link
              className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"
              to={headerRoutes.createList}
            >
              Criar minha primeira lista
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listsState.lists.map((list) => (
              <ListSummary key={list.id} list={list} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
