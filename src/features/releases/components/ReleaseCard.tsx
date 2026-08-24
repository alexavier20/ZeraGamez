import { BookmarkPlus, CircleCheck, Gamepad2, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { savePendingAuthIntent } from '@/features/auth/model/pending-auth-intent';
import { AddToListsModal } from '@/features/lists/components/AddToListsModal';
import { isListsOperationCancelled, useLists } from '@/features/lists/context/ListsProvider';
import {
  compactPlatformLabel,
  formatReleaseDate,
  formatReleaseStatus,
  platformLabel,
  type ReleaseItem,
} from '@/features/releases/model/release-presentation';

import type { GameSnapshot } from '@/features/lists/model/lists';
import type * as React from 'react';

export type PendingReleaseActionType = 'open-add-to-lists' | 'toggle-want-to-play';

export interface ReleaseCardProps {
  readonly item: ReleaseItem;
  readonly generatedAt: string;
  readonly onPendingActionConsumed?: () => void;
  readonly pendingAction?: PendingReleaseActionType;
}

interface ReleasePresentation {
  readonly date: string;
  readonly status: string;
  readonly desktopPlatforms: readonly ReleasePlatformChip[];
  readonly compactPlatforms: string;
  readonly genre: string | undefined;
}

interface ReleasePlatformChip {
  readonly key: string;
  readonly label: string;
  readonly summary: boolean;
}

interface ReleaseCardLayoutProps {
  readonly actionPending: boolean;
  readonly addToListsButtonRef: React.RefObject<HTMLButtonElement | null>;
  readonly authLoading: boolean;
  readonly item: ReleaseItem;
  readonly onAddToLists: React.MouseEventHandler<HTMLButtonElement>;
  readonly onToggleWantToPlay: () => void;
  readonly presentation: ReleasePresentation;
  readonly wantToPlay: boolean;
}

const disabledActionClassName =
  'inline-flex items-center justify-center rounded-lg text-text-muted transition-colors disabled:opacity-100';

interface WantToPlayButtonProps {
  readonly compact?: boolean;
  readonly disabled: boolean;
  readonly gameName: string;
  readonly onToggle: () => void;
  readonly selected: boolean;
}

function WantToPlayButton({
  compact = false,
  disabled,
  gameName,
  onToggle,
  selected,
}: WantToPlayButtonProps) {
  const Icon = selected ? CircleCheck : Gamepad2;

  return (
    <button
      aria-label={
        selected ? `Remover ${gameName} de Quero jogar` : `Marcar ${gameName} como quero jogar`
      }
      aria-pressed={selected}
      className={`inline-flex shrink-0 items-center justify-center border text-content-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        compact
          ? 'size-7 rounded-lg'
          : 'h-7 w-[104px] gap-[7px] rounded-[10px] px-2 text-[11px] font-semibold'
      } ${
        selected
          ? 'border-success bg-success hover:bg-success/90'
          : 'border-transparent bg-app/80 hover:bg-app'
      }`}
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      <Icon aria-hidden="true" size={15} />
      {compact ? null : <span>Quero jogar!</span>}
    </button>
  );
}

function desktopPlatformChips(platforms: ReleaseItem['platforms']): ReleasePlatformChip[] {
  const chips = platforms.slice(0, 2).map((platform, index) => ({
    key: `platform-${String(platform.id)}-${String(index)}`,
    label: platformLabel(platform),
    summary: false,
  }));
  const remaining = platforms.length - chips.length;

  return remaining > 0
    ? [
        ...chips,
        {
          key: `platform-summary-${String(platforms.length)}`,
          label: `+${String(remaining)}`,
          summary: true,
        },
      ]
    : chips;
}

function ReleaseCardDesktop({
  actionPending,
  addToListsButtonRef,
  authLoading,
  item,
  onAddToLists,
  onToggleWantToPlay,
  presentation,
  wantToPlay,
}: ReleaseCardLayoutProps) {
  return (
    <>
      <div className="relative">
        {item.coverUrl ? (
          <img
            alt={`Capa de ${item.name}`}
            className="h-[244px] w-full rounded-xl object-cover"
            loading="lazy"
            src={item.coverUrl}
          />
        ) : (
          <div
            aria-label={`Capa indisponível de ${item.name}`}
            className="flex h-[244px] w-full items-center justify-center rounded-xl bg-gradient-to-br from-bg-secondary to-surface-hover text-text-muted"
            role="img"
          >
            <Gamepad2 aria-hidden="true" size={32} />
          </div>
        )}
        <span className="absolute bottom-2 left-2 rounded-md bg-app/85 px-2 py-1 text-[11px] font-semibold text-content-primary">
          {presentation.status}
        </span>
        <div className="absolute right-2 top-2">
          <WantToPlayButton
            disabled={actionPending || authLoading}
            gameName={item.name}
            onToggle={onToggleWantToPlay}
            selected={wantToPlay}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="min-w-0">
          <h3
            className="truncate font-heading text-base font-semibold text-text-primary"
            title={item.name}
          >
            {item.name}
          </h3>
          <p className="mt-1 text-xs text-text-muted">{presentation.date}</p>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          {presentation.desktopPlatforms.map((platform) => (
            <span
              className={`${
                platform.summary ? 'shrink-0' : 'min-w-0 shrink truncate'
              } rounded-md border border-border-brand bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-muted`}
              key={platform.key}
              title={platform.summary ? undefined : platform.label}
            >
              {platform.label}
            </span>
          ))}
          {presentation.genre ? (
            <p
              className="ml-auto min-w-[4rem] max-w-[40%] shrink truncate text-xs text-text-muted"
              title={presentation.genre}
            >
              {presentation.genre}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border-brand pt-2">
        <button
          aria-label={`Adicionar ${item.name} à lista`}
          className={`${disabledActionClassName} h-9 flex-1 gap-2 border border-border-brand bg-bg-secondary px-3 text-xs font-semibold text-content-primary hover:border-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
          disabled={authLoading}
          onClick={onAddToLists}
          ref={addToListsButtonRef}
          type="button"
        >
          <BookmarkPlus aria-hidden="true" size={15} />
          Adicionar à lista
        </button>
      </div>
    </>
  );
}

function ReleaseCardMobile({
  actionPending,
  addToListsButtonRef,
  authLoading,
  item,
  onAddToLists,
  onToggleWantToPlay,
  presentation,
  wantToPlay,
}: ReleaseCardLayoutProps) {
  return (
    <>
      <div className="relative h-full">
        {item.coverUrl ? (
          <img
            alt={`Capa de ${item.name}`}
            className="h-full w-[82px] rounded-[10px] object-cover"
            loading="lazy"
            src={item.coverUrl}
          />
        ) : (
          <div
            aria-label={`Capa indisponível de ${item.name}`}
            className="flex h-full w-[82px] items-center justify-center rounded-[10px] bg-gradient-to-br from-bg-secondary to-surface-hover text-text-muted"
            role="img"
          >
            <Gamepad2 aria-hidden="true" size={24} />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col justify-between py-0.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <h3
              className="min-w-0 truncate font-heading text-sm font-semibold text-text-primary"
              title={item.name}
            >
              {item.name}
            </h3>
            <div className="-mr-1 -mt-1">
              <WantToPlayButton
                compact
                disabled={actionPending || authLoading}
                gameName={item.name}
                onToggle={onToggleWantToPlay}
                selected={wantToPlay}
              />
            </div>
          </div>
          <p
            className="mt-1 truncate text-[11px] text-text-muted"
            title={presentation.compactPlatforms}
          >
            {presentation.compactPlatforms}
          </p>
          {presentation.genre ? (
            <p className="mt-1 truncate text-[11px] text-text-muted" title={presentation.genre}>
              {presentation.genre}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-filter-active px-2 py-1 text-[10px] font-semibold text-filter-active-text">
            {presentation.status}
          </span>
          <span className="truncate text-[11px] text-text-muted" title={presentation.date}>
            {presentation.date}
          </span>
          <button
            aria-label={`Adicionar ${item.name} à lista`}
            className={`${disabledActionClassName} size-7 shrink-0 border border-border-brand bg-bg-secondary hover:border-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
            disabled={authLoading}
            onClick={onAddToLists}
            ref={addToListsButtonRef}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
    </>
  );
}

function toGameSnapshot(item: ReleaseItem): GameSnapshot {
  return {
    igdbId: item.id,
    name: item.name,
    coverUrl: item.coverUrl,
    releaseDate: item.releaseDate,
  };
}

export function ReleaseCard({
  item,
  generatedAt,
  onPendingActionConsumed,
  pendingAction,
}: ReleaseCardProps): React.ReactElement {
  const { state: authState } = useAuth();
  const { addGameToLists, listsState, loadLists, scopeVersion, toggleWantToPlay, wantToPlayIds } =
    useLists();
  const navigate = useNavigate();
  const [addToListsOpen, setAddToListsOpen] = useState(false);
  const [togglePending, setTogglePending] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const listTriggerRef = useRef<HTMLButtonElement | null>(null);
  const desktopListButtonRef = useRef<HTMLButtonElement>(null);
  const mobileListButtonRef = useRef<HTMLButtonElement>(null);
  const togglePendingRef = useRef(false);
  const resumedActionRef = useRef<PendingReleaseActionType | null>(null);
  const wantToPlay = wantToPlayIds.has(item.id);
  const authLoading = authState.status === 'loading';
  const presentation: ReleasePresentation = {
    date: formatReleaseDate(item.releaseDate),
    status: formatReleaseStatus(item.releaseDate, generatedAt),
    desktopPlatforms: desktopPlatformChips(item.platforms),
    compactPlatforms: compactPlatformLabel(item.platforms),
    genre: item.genres.at(0)?.name,
  };

  const requestAuthentication = useCallback(
    (type: PendingReleaseActionType) => {
      if (authState.status === 'loading') return;
      savePendingAuthIntent(sessionStorage, {
        version: 1,
        type,
        returnTo: '/lancamentos',
        igdbId: item.id,
      });
      void navigate('/entrar');
    },
    [authState.status, item.id, navigate],
  );

  const openAddToLists = useCallback(
    (trigger?: HTMLButtonElement) => {
      if (authState.status === 'loading') return;
      if (authState.status !== 'authenticated') {
        requestAuthentication('open-add-to-lists');
        return;
      }

      const responsiveTrigger =
        typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 640px)').matches
          ? desktopListButtonRef.current
          : mobileListButtonRef.current;
      listTriggerRef.current =
        trigger ?? responsiveTrigger ?? desktopListButtonRef.current ?? mobileListButtonRef.current;
      setAddToListsOpen(true);
    },
    [authState.status, requestAuthentication],
  );

  const handleOpenAddToLists: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    openAddToLists(event.currentTarget);
  };

  const handleToggleWantToPlay = useCallback(() => {
    if (authState.status === 'loading') return;
    if (authState.status !== 'authenticated') {
      requestAuthentication('toggle-want-to-play');
      return;
    }
    if (togglePendingRef.current) return;

    togglePendingRef.current = true;
    setTogglePending(true);
    setToggleError(null);
    void toggleWantToPlay(toGameSnapshot(item))
      .catch((error: unknown) => {
        if (!isListsOperationCancelled(error)) {
          setToggleError('Não foi possível atualizar Quero jogar. Tente novamente.');
        }
      })
      .finally(() => {
        togglePendingRef.current = false;
        setTogglePending(false);
      });
  }, [authState.status, item, requestAuthentication, toggleWantToPlay]);

  const handleCloseAddToLists = useCallback(() => {
    setAddToListsOpen(false);
    queueMicrotask(() => {
      listTriggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!addToListsOpen || authState.status !== 'authenticated') return;
    void loadLists();
  }, [addToListsOpen, authState.status, loadLists, scopeVersion]);

  useEffect(() => {
    if (pendingAction === undefined) {
      resumedActionRef.current = null;
      return;
    }
    if (authState.status !== 'authenticated') return;

    const action = pendingAction;
    let active = true;
    queueMicrotask(() => {
      if (!active || resumedActionRef.current === action) return;
      resumedActionRef.current = action;
      onPendingActionConsumed?.();
      if (action === 'open-add-to-lists') openAddToLists();
      else handleToggleWantToPlay();
    });

    return () => {
      active = false;
    };
  }, [
    authState.status,
    handleToggleWantToPlay,
    onPendingActionConsumed,
    openAddToLists,
    pendingAction,
  ]);

  return (
    <>
      <article
        className="hidden h-[407px] rounded-2xl border border-border-brand bg-surface p-3 shadow-[0_8px_24px_#00000040] sm:flex sm:flex-col sm:gap-2"
        data-testid={`release-card-desktop-${String(item.id)}`}
      >
        <ReleaseCardDesktop
          actionPending={togglePending}
          addToListsButtonRef={desktopListButtonRef}
          authLoading={authLoading}
          item={item}
          onAddToLists={handleOpenAddToLists}
          onToggleWantToPlay={handleToggleWantToPlay}
          presentation={presentation}
          wantToPlay={wantToPlay}
        />
      </article>
      <article
        className="grid h-[132px] grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-[14px] border border-border-brand bg-surface p-2.5 sm:hidden"
        data-testid={`release-card-mobile-${String(item.id)}`}
      >
        <ReleaseCardMobile
          actionPending={togglePending}
          addToListsButtonRef={mobileListButtonRef}
          authLoading={authLoading}
          item={item}
          onAddToLists={handleOpenAddToLists}
          onToggleWantToPlay={handleToggleWantToPlay}
          presentation={presentation}
          wantToPlay={wantToPlay}
        />
      </article>
      {toggleError === null ? null : (
        <p
          className="mt-2 rounded-lg border border-brand/50 bg-bg-secondary px-3 py-2 text-sm text-content-primary"
          role="alert"
        >
          {toggleError}
        </p>
      )}
      {addToListsOpen ? (
        <AddToListsModal
          gameName={item.name}
          key={scopeVersion}
          listsState={listsState}
          onClose={handleCloseAddToLists}
          onConfirm={(listIds) => addGameToLists(toGameSnapshot(item), listIds)}
          onRetry={() => {
            void loadLists({ force: true });
          }}
          open
        />
      ) : null}
    </>
  );
}
