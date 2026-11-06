import { Pin, Plus, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { AddGamesToListModal } from '@/features/lists/components/AddGamesToListModal';
import { DeleteListModal } from '@/features/lists/components/DeleteListModal';
import { ListDetailsModal } from '@/features/lists/components/ListDetailsModal';
import { isListsOperationCancelled, useLists } from '@/features/lists/context/ListsProvider';
import { TierListsSection } from '@/features/tier-lists/components/TierListsSection';
import { headerRoutes } from '@/shared/components/header/header.config';
import { ListCardsLoading } from '@/shared/components/LoadingSkeletons';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

import type { CreateListInput, UserListSummary } from '@/features/lists/model/lists';

type ListModalMode = 'add-games' | 'details';

function gameCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'jogo' : 'jogos'}`;
}

interface ListSummaryProps {
  readonly list: UserListSummary;
  readonly onDelete: (list: UserListSummary) => void;
  readonly onSelect: (list: UserListSummary) => void;
}

function ListSummary({ list, onDelete, onSelect }: ListSummaryProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsMenuId = `list-settings-${String(list.id)}`;
  const covers = list.covers
    .filter((cover): cover is string => typeof cover === 'string' && cover.length > 0)
    .slice(0, 3);
  const coverColumnClass =
    covers.length === 1 ? 'grid-cols-1' : covers.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  useEffect(() => {
    if (!settingsOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !settingsRef.current?.contains(event.target)) {
        setSettingsOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
        settingsButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [settingsOpen]);

  return (
    <article className="relative rounded-2xl border border-white/10 bg-surface transition-colors duration-150 hover:border-white/25">
      <button
        aria-haspopup="dialog"
        aria-label={`Abrir detalhes da lista ${list.name}`}
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand"
        onClick={() => {
          onSelect(list);
        }}
        type="button"
      >
        {covers.length > 0 ? (
          <div
            className={`grid aspect-[3/1] w-full shrink-0 overflow-hidden bg-bg-secondary ${coverColumnClass}`}
          >
            {covers.map((cover, index) => (
              <img
                alt={`Capa de ${list.name} ${String(index + 1)}`}
                className="h-full w-full object-cover"
                key={`${String(list.id)}:${String(index)}:${cover}`}
                src={cover}
              />
            ))}
          </div>
        ) : (
          <div aria-hidden="true" className="aspect-[3/1] w-full shrink-0 bg-bg-secondary" />
        )}
        <div className="w-full flex-1 space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="flex min-h-10 min-w-0 flex-1 items-start gap-2 font-heading text-sm leading-5 font-semibold text-content-primary">
              {list.systemKey === null ? null : (
                <Pin
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-text-muted"
                  size={18}
                  strokeWidth={1.5}
                />
              )}
              <span className="line-clamp-2 break-words" title={list.name}>
                {list.name}
              </span>
            </h2>
            <span className="shrink-0 pt-0.5 text-[11px] leading-5 font-medium tabular-nums text-text-muted">
              {gameCountLabel(list.gameCount)}
            </span>
          </div>
          <p
            className="line-clamp-2 min-h-10 break-words text-xs leading-5 text-text-muted"
            title={list.description ?? undefined}
          >
            {list.description}
          </p>
        </div>
      </button>
      {list.systemKey === null ? (
        <div className="absolute top-3 right-3 z-10" ref={settingsRef}>
          <button
            aria-controls={settingsMenuId}
            aria-expanded={settingsOpen}
            aria-label={`Configurações da lista ${list.name}`}
            className="flex size-11 items-center justify-center rounded-lg border border-white/15 bg-black/75 text-white transition-colors duration-150 hover:border-white/30 hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={() => {
              setSettingsOpen((open) => !open);
            }}
            ref={settingsButtonRef}
            type="button"
          >
            <Settings aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
          {settingsOpen ? (
            <div
              className="absolute top-12 right-0 min-w-40 overflow-hidden rounded-xl border border-white/10 bg-surface p-2 shadow-lg shadow-black/20"
              id={settingsMenuId}
              aria-label={`Opções da lista ${list.name}`}
              role="group"
            >
              <button
                className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-content-primary transition-colors duration-150 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand"
                onClick={() => {
                  setSettingsOpen(false);
                  onSelect(list);
                }}
                type="button"
              >
                Editar
              </button>
              <button
                className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-red-200 transition-colors duration-150 hover:bg-red-500/15 focus-visible:outline-2 focus-visible:outline-red-300"
                onClick={() => {
                  setSettingsOpen(false);
                  onDelete(list);
                }}
                type="button"
              >
                Excluir
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function MyListsPage() {
  const lists = useLists();
  const { addGamesToList, deleteList, listsState, loadLists, scopeVersion, updateList } = lists;
  const [selectedList, setSelectedList] = useState<{
    readonly list: UserListSummary;
    readonly mode: ListModalMode;
    readonly scopeVersion: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    readonly list: UserListSummary;
    readonly scopeVersion: number;
  } | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const activeDeleteList = deleteTarget?.scopeVersion === scopeVersion ? deleteTarget.list : null;
  const activeList =
    selectedList?.scopeVersion === scopeVersion
      ? listsState.status === 'success'
        ? (listsState.lists.find((list) => list.id === selectedList.list.id) ?? selectedList.list)
        : selectedList.list
      : null;
  const systemLists =
    listsState.status === 'success'
      ? listsState.lists.filter((list) => list.systemKey !== null)
      : [];
  const userLists =
    listsState.status === 'success'
      ? listsState.lists.filter((list) => list.systemKey === null)
      : [];
  const displayedLists = [...systemLists, ...userLists];

  const closeModal = useCallback(() => {
    setSelectedList(null);
  }, []);
  const saveGames = useCallback(
    (games: Parameters<typeof addGamesToList>[0]) => {
      if (activeList === null) return Promise.resolve();
      return addGamesToList(games, activeList.id);
    },
    [activeList, addGamesToList],
  );
  const returnToDetails = useCallback(() => {
    setSelectedList((current) => (current === null ? null : { ...current, mode: 'details' }));
  }, []);
  const openAddGames = useCallback(() => {
    setSelectedList((current) => (current === null ? null : { ...current, mode: 'add-games' }));
  }, []);
  const updateSelectedList = useCallback(
    async (listId: number, input: CreateListInput) => {
      await updateList(listId, input);
      setSelectedList((current) =>
        current?.list.id !== listId
          ? current
          : {
              ...current,
              list: { ...current.list, name: input.name, description: input.description || null },
            },
      );
    },
    [updateList],
  );
  const closeDeleteModal = useCallback(() => {
    setDeleteTarget(null);
    setDeleteErrorMessage(null);
  }, []);
  const confirmDeleteList = useCallback(async () => {
    if (activeDeleteList === null || isDeletingList) return;

    setIsDeletingList(true);
    setDeleteErrorMessage(null);
    try {
      await deleteList(activeDeleteList.id);
      setDeleteTarget(null);
      setSelectedList((current) => (current?.list.id === activeDeleteList.id ? null : current));
    } catch (error) {
      if (!isListsOperationCancelled(error)) {
        setDeleteErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível excluir esta lista. Tente novamente.',
        );
      }
    } finally {
      setIsDeletingList(false);
    }
  }, [activeDeleteList, deleteList, isDeletingList]);

  useEffect(() => {
    if (listsState.status === 'idle') void loadLists();
  }, [listsState.status, loadLists]);

  return (
    <main className="site-container min-h-[calc(100dvh-3.5rem)] pb-28 pt-5 sm:pb-12 sm:pt-6 lg:pt-7">
      <div className="flex items-start justify-between gap-4">
        <PageHeading
          title="Minhas listas"
          subtitle="Organize os jogos do seu jeito"
          titleClassName="font-heading text-2xl leading-tight font-semibold text-content-primary sm:text-[28px] lg:text-[32px]"
        />
        <Link
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to={headerRoutes.createList}
        >
          <Plus aria-hidden="true" size={18} strokeWidth={1.5} />
          Criar lista
        </Link>
      </div>

      <section aria-label="Suas listas" className="mt-8">
        {listsState.status === 'idle' || listsState.status === 'loading' ? (
          <ListCardsLoading />
        ) : listsState.status === 'error' ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-100" role="alert">
              {listsState.message}
            </p>
            <button
              className="mt-4 rounded-xl border border-red-200/30 px-4 py-2 text-sm font-medium text-white"
              onClick={() => void loadLists()}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div>
            {displayedLists.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-surface p-8 text-center">
                <p className="text-text-muted">Você ainda não criou nenhuma lista.</p>
                <Link
                  className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white"
                  to={headerRoutes.createList}
                >
                  Criar minha primeira lista
                </Link>
              </div>
            ) : (
              <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                {displayedLists.map((list) => (
                  <ListSummary
                    key={list.id}
                    list={list}
                    onDelete={(selected) => {
                      setDeleteErrorMessage(null);
                      setDeleteTarget({ list: selected, scopeVersion });
                    }}
                    onSelect={(selected) => {
                      setSelectedList({ list: selected, mode: 'details', scopeVersion });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
      <TierListsSection />
      {activeList === null || selectedList === null ? null : selectedList.mode === 'add-games' ? (
        <AddGamesToListModal list={activeList} onClose={returnToDetails} onSave={saveGames} />
      ) : (
        <ListDetailsModal
          list={activeList}
          onAddGames={openAddGames}
          onClose={closeModal}
          onLoadCoverGameIds={lists.getListCoverGameIds}
          onLoadGames={lists.loadListGames}
          onMoveGame={lists.moveGameInList}
          onRemoveGame={lists.removeGameFromList}
          onSetCoverGameIds={lists.setListCoverGameIds}
          onUpdate={updateSelectedList}
        />
      )}
      {activeDeleteList === null ? null : (
        <DeleteListModal
          errorMessage={deleteErrorMessage}
          isDeleting={isDeletingList}
          list={activeDeleteList}
          onClose={closeDeleteModal}
          onConfirm={() => {
            void confirmDeleteList();
          }}
        />
      )}
    </main>
  );
}
