import { ChevronLeft, ChevronRight, Pin, Plus, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet } from 'react-router';

import { AddGamesToListModal } from '@/features/lists/components/AddGamesToListModal';
import { DeleteListModal } from '@/features/lists/components/DeleteListModal';
import { ListDetailsModal } from '@/features/lists/components/ListDetailsModal';
import { isListsOperationCancelled, useLists } from '@/features/lists/context/ListsProvider';
import { TierListsSection } from '@/features/tier-lists/components/TierListsSection';
import { headerRoutes } from '@/shared/components/header/header.config';
import { ListCardsLoading } from '@/shared/components/LoadingSkeletons';

import type { CreateListInput, UserListSummary } from '@/features/lists/model/lists';

type ListModalMode = 'add-games' | 'details';
const LISTS_PER_PAGE = 10;

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
    <article className="group relative cut-corner-card bg-brand p-[10px] transition-colors duration-200 ease-out hover:bg-red-600">
      <button
        aria-haspopup="dialog"
        aria-label={`Abrir detalhes da lista ${list.name}`}
        className="cut-corner-card-content flex h-full w-full flex-col overflow-hidden bg-surface text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand-bright"
        onClick={() => {
          onSelect(list);
        }}
        type="button"
      >
        {covers.length > 0 ? (
          <div
            className={`grid aspect-[2/1] w-full shrink-0 overflow-hidden bg-bg-secondary ${coverColumnClass}`}
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
          <div aria-hidden="true" className="aspect-[2/1] w-full shrink-0 bg-bg-secondary" />
        )}
        <div className="w-full flex-1 bg-brand px-4 py-2 text-brand-ink transition-colors duration-200 ease-out group-hover:bg-red-600">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex min-h-8 min-w-0 flex-1 items-center gap-2 font-heading text-sm leading-5 font-semibold text-brand-ink transition-colors duration-200 ease-out group-hover:text-text-primary">
              {list.systemKey === null ? null : (
                <Pin
                  aria-hidden="true"
                  className="shrink-0 text-brand-ink transition-colors duration-200 ease-out group-hover:text-text-primary"
                  size={18}
                  strokeWidth={1.5}
                />
              )}
              <span className="line-clamp-2 break-words" title={list.name}>
                {list.name}
              </span>
            </h2>
            <span className="shrink-0 text-[11px] leading-5 font-medium tabular-nums text-brand-ink transition-colors duration-200 ease-out group-hover:text-text-primary">
              {String(list.gameCount)} {list.gameCount === 1 ? 'jogo' : 'jogos'}
            </span>
          </div>
        </div>
      </button>
      {list.systemKey === null ? (
        <div className="absolute top-3 right-3 z-10" ref={settingsRef}>
          <button
            aria-controls={settingsMenuId}
            aria-expanded={settingsOpen}
            aria-label={`Configurações da lista ${list.name}`}
            className="flex size-11 items-center justify-center rounded-lg text-white transition-colors duration-150 hover:text-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
            onClick={() => {
              setSettingsOpen((open) => !open);
            }}
            ref={settingsButtonRef}
            type="button"
          >
            <Settings
              aria-hidden="true"
              className="drop-shadow-[0_1px_2px_rgba(43,43,48,0.9)]"
              size={24}
              strokeWidth={2}
            />
          </button>
          {settingsOpen ? (
            <div
              className="absolute top-12 right-0 min-w-40 overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-lg shadow-black/50"
              id={settingsMenuId}
              aria-label={`Opções da lista ${list.name}`}
              role="group"
            >
              <button
                className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-content-primary transition-colors duration-150 hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-bright"
                onClick={() => {
                  setSettingsOpen(false);
                  onSelect(list);
                }}
                type="button"
              >
                Editar
              </button>
              <button
                className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-800/15 focus-visible:outline-2 focus-visible:outline-red-300"
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
  const [listsPage, setListsPage] = useState(0);
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
  const pageCount = Math.ceil(displayedLists.length / LISTS_PER_PAGE);
  const currentPage = Math.min(listsPage, Math.max(0, pageCount - 1));
  const visibleLists = displayedLists.slice(
    currentPage * LISTS_PER_PAGE,
    (currentPage + 1) * LISTS_PER_PAGE,
  );

  useEffect(() => {
    setListsPage((page) => Math.min(page, Math.max(0, pageCount - 1)));
  }, [pageCount]);

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
        <h1 className="flex items-center gap-2 font-heading text-xl font-semibold text-text-primary sm:text-2xl">
          <span
            aria-hidden="true"
            className="h-6 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-brand"
          />
          Minhas listas
        </h1>
        <Link
          className="group inline-flex min-h-11 shrink-0 items-center gap-2 cut-corner-button cut-corner-button-outline px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors duration-150 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
          to={headerRoutes.createList}
        >
          <Plus
            aria-hidden="true"
            className="text-brand group-hover:text-brand-ink"
            size={18}
            strokeWidth={1.5}
          />
          <span>Nova lista</span>
        </Link>
      </div>

      <section aria-label="Suas listas" className="mt-8">
        {listsState.status === 'idle' || listsState.status === 'loading' ? (
          <ListCardsLoading />
        ) : listsState.status === 'error' ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-700" role="alert">
              {listsState.message}
            </p>
            <button
              className="mt-4 rounded-xl border border-red-200/30 px-4 py-2 text-sm font-medium text-red-700"
              onClick={() => void loadLists()}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div>
            {displayedLists.length === 0 ? (
              <p className="mb-5 text-sm text-text-muted">Você ainda não criou nenhuma lista.</p>
            )}
            <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              {visibleLists.map((list) => (
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
              <Link
                className="group flex min-h-[190px] w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-border bg-transparent text-text-muted transition-colors duration-150 hover:border-brand hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
                to={headerRoutes.createList}
              >
                <span
                  aria-hidden="true"
                  className="grid size-16 place-items-center rounded-full bg-surface transition-colors duration-150 group-hover:bg-surface-hover"
                >
                  <Plus className="text-brand" size={32} strokeWidth={1.8} />
                </span>
                <span className="text-sm font-medium">Nova lista</span>
              </Link>
            </div>
            {pageCount > 1 ? (
              <nav
                aria-label="Paginação das listas"
                className="mt-5 flex flex-wrap items-center justify-center gap-3"
              >
                <button
                  aria-label="Página anterior"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-content-primary transition-colors enabled:hover:border-border enabled:hover:bg-brand-bright/30 enabled:hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
                  disabled={currentPage === 0}
                  onClick={() => {
                    setListsPage((page) => Math.max(0, page - 1));
                  }}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
                  Anterior
                </button>
                <span aria-live="polite" className="text-xs tabular-nums text-text-muted sm:text-sm">
                  Página {String(currentPage + 1)} de {String(pageCount)}
                </span>
                <button
                  aria-label="Próxima página"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-content-primary transition-colors enabled:hover:border-border enabled:hover:bg-brand-bright/30 enabled:hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => {
                    setListsPage((page) => Math.min(pageCount - 1, page + 1));
                  }}
                  type="button"
                >
                  Próxima
                  <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
                </button>
              </nav>
            ) : null}
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
      <Outlet />
    </main>
  );
}
