import { BookmarkPlus, CircleCheck, Gamepad2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { savePendingAuthIntent } from '@/features/auth/model/pending-auth-intent';
import { AddToListsModal } from '@/features/lists/components/AddToListsModal';
import { isListsOperationCancelled, useLists } from '@/features/lists/context/ListsProvider';
import {
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
  readonly showActions?: boolean;
  readonly onPendingActionConsumed?: () => void;
  readonly pendingAction?: PendingReleaseActionType;
}

interface ReleasePresentation {
  readonly status: string;
  readonly platforms: readonly ReleasePlatformChip[];
}

interface ReleasePlatformChip {
  readonly key: string;
  readonly label: string;
}

interface ReleaseCardLayoutProps {
  readonly actionPending: boolean;
  readonly addToListsButtonRef: React.RefObject<HTMLButtonElement | null>;
  readonly authLoading: boolean;
  readonly item: ReleaseItem;
  readonly onAddToLists: React.MouseEventHandler<HTMLButtonElement>;
  readonly onToggleWantToPlay: () => void;
  readonly presentation: ReleasePresentation;
  readonly showActions: boolean;
  readonly wantToPlay: boolean;
  readonly wantToPlayDisabled: boolean;
}

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
      onClick={() => {
        onToggle();
      }}
      type="button"
    >
      <Icon aria-hidden="true" size={15} />
      {compact ? null : <span>Quero jogar!</span>}
    </button>
  );
}

interface AddToListsButtonProps {
  readonly buttonRef: React.RefObject<HTMLButtonElement | null>;
  readonly disabled: boolean;
  readonly gameName: string;
  readonly onClick: React.MouseEventHandler<HTMLButtonElement>;
}

function AddToListsButton({ buttonRef, disabled, gameName, onClick }: AddToListsButtonProps) {
  return (
    <button
      aria-label={`Adicionar ${gameName} à lista`}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border-brand bg-app/85 text-content-primary transition-colors hover:border-brand hover:bg-app focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      ref={buttonRef}
      title={`Adicionar ${gameName} à lista`}
      type="button"
    >
      <BookmarkPlus aria-hidden="true" size={15} />
    </button>
  );
}

const platformChipClassName =
  'max-w-[120px] shrink-0 truncate rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-text-muted';
const platformSummaryClassName =
  'shrink-0 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-text-muted';

function PlatformChips({
  gameName,
  platforms,
}: {
  readonly gameName: string;
  readonly platforms: readonly ReleasePlatformChip[];
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(platforms.length);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measurement = measurementRef.current;
    if (!row || !measurement) return;

    const recalculate = () => {
      const availableWidth = row.clientWidth;
      const platformNodes = Array.from(
        measurement.querySelectorAll<HTMLElement>('[data-platform-measure]'),
      );
      const summaryNodes = Array.from(
        measurement.querySelectorAll<HTMLElement>('[data-platform-summary-measure]'),
      );
      const platformWidths = platformNodes.map((node) => node.getBoundingClientRect().width);
      const summaryWidths = new Map(
        summaryNodes.map((node) => [
          Number(node.dataset.platformSummaryMeasure),
          node.getBoundingClientRect().width,
        ] as const),
      );

      if (platforms.length === 0) {
        setVisibleCount(0);
        return;
      }

      if (availableWidth === 0 || platformWidths.some((width) => width === 0)) {
        setVisibleCount(0);
        return;
      }

      const gap = 6;
      for (let count = platforms.length; count >= 0; count -= 1) {
        const remaining = platforms.length - count;
        const summaryWidth = remaining > 0 ? (summaryWidths.get(remaining) ?? 0) : 0;
        const chipCount = count + (remaining > 0 ? 1 : 0);
        const usedWidth =
          platformWidths.slice(0, count).reduce((total, width) => total + width, 0) +
          summaryWidth +
          Math.max(0, chipCount - 1) * gap;

        if (usedWidth <= availableWidth) {
          setVisibleCount(count);
          return;
        }
      }

      setVisibleCount(0);
    };

    recalculate();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(recalculate);
    observer?.observe(row);
    observer?.observe(measurement);
    window.addEventListener('resize', recalculate);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', recalculate);
    };
  }, [platforms]);

  const remaining = platforms.length - visibleCount;

  return (
    <div className="relative min-w-0">
      <div
        aria-label={`Plataformas de ${gameName}`}
        className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap"
        role="group"
        ref={rowRef}
      >
        {platforms.slice(0, visibleCount).map((platform) => (
          <span className={platformChipClassName} key={platform.key} title={platform.label}>
            {platform.label}
          </span>
        ))}
        {remaining > 0 ? (
          <span
            aria-label={`${String(remaining)} plataformas adicionais`}
            className={platformSummaryClassName}
          >
            +{String(remaining)}
          </span>
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 invisible flex w-max items-center gap-1.5 whitespace-nowrap"
        ref={measurementRef}
      >
        {platforms.map((platform, index) => (
          <span
            className={platformChipClassName}
            data-platform-measure={index}
            key={platform.key}
            title={platform.label}
          >
            {platform.label}
          </span>
        ))}
        {platforms.map((_, index) => {
          const count = index + 1;
          return (
            <span
              className={platformSummaryClassName}
              data-platform-summary-measure={count}
              key={`summary-${String(count)}`}
            >
              +{String(count)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function platformChips(platforms: ReleaseItem['platforms']): ReleasePlatformChip[] {
  return platforms.map((platform, index) => ({
    key: `platform-${String(platform.id)}-${String(index)}`,
    label: platformLabel(platform),
  }));
}

function ReleaseCardDesktop({
  actionPending,
  addToListsButtonRef,
  authLoading,
  item,
  onAddToLists,
  onToggleWantToPlay,
  presentation,
  showActions,
  wantToPlay,
  wantToPlayDisabled,
}: ReleaseCardLayoutProps) {
  return (
    <>
      <div className="relative">
        <Link
          aria-label={`Ver detalhes de ${item.name}`}
          className="block aspect-[16/9] w-full overflow-hidden rounded-xl shadow-[0_8px_24px_#00000040] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to={`/jogos/${String(item.id)}`}
        >
          {item.coverUrl ? (
            <img
              alt={`Capa de ${item.name}`}
              className="size-full rounded-xl object-cover transition-opacity hover:opacity-85"
              loading="lazy"
              src={item.coverUrl}
            />
          ) : (
            <div
              aria-label={`Capa indisponível de ${item.name}`}
              className="flex size-full items-center justify-center rounded-xl bg-gradient-to-br from-bg-secondary to-surface-hover text-text-muted"
              role="img"
            >
              <Gamepad2 aria-hidden="true" size={32} />
            </div>
          )}
        </Link>
        <span className="absolute bottom-2 left-2 rounded-md bg-app/85 px-2 py-1 text-[11px] font-semibold text-content-primary">
          {presentation.status}
        </span>
        {showActions ? (
          <div className="absolute right-2 top-2 flex items-center gap-1.5">
            <WantToPlayButton
              disabled={actionPending || wantToPlayDisabled}
              gameName={item.name}
              onToggle={onToggleWantToPlay}
              selected={wantToPlay}
            />
            <AddToListsButton
              buttonRef={addToListsButtonRef}
              disabled={authLoading}
              gameName={item.name}
              onClick={onAddToLists}
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-3">
        <h3
          className="truncate font-heading text-base font-semibold text-text-primary"
          title={item.name}
        >
          <Link
            className="rounded-sm hover:text-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            to={`/jogos/${String(item.id)}`}
          >
            {item.name}
          </Link>
        </h3>
        <PlatformChips gameName={item.name} platforms={presentation.platforms} />
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
  showActions,
  wantToPlay,
  wantToPlayDisabled,
}: ReleaseCardLayoutProps) {
  return (
    <>
      <div className="relative">
        <Link
          aria-label={`Ver detalhes de ${item.name}`}
          className="block aspect-[16/9] w-full overflow-hidden rounded-[10px] shadow-[0_8px_24px_#00000040] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to={`/jogos/${String(item.id)}`}
        >
          {item.coverUrl ? (
            <img
              alt={`Capa de ${item.name}`}
              className="size-full rounded-[10px] object-cover transition-opacity hover:opacity-85"
              loading="lazy"
              src={item.coverUrl}
            />
          ) : (
            <div
              aria-label={`Capa indisponível de ${item.name}`}
              className="flex size-full items-center justify-center rounded-[10px] bg-gradient-to-br from-bg-secondary to-surface-hover text-text-muted"
              role="img"
            >
              <Gamepad2 aria-hidden="true" size={24} />
            </div>
          )}
        </Link>
        {showActions ? (
          <div className="absolute right-2 top-2 flex items-center gap-1.5">
            <WantToPlayButton
              compact
              disabled={actionPending || wantToPlayDisabled}
              gameName={item.name}
              onToggle={onToggleWantToPlay}
              selected={wantToPlay}
            />
            <AddToListsButton
              buttonRef={addToListsButtonRef}
              disabled={authLoading}
              gameName={item.name}
              onClick={onAddToLists}
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-2.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3
            className="min-w-0 truncate font-heading text-sm font-semibold text-text-primary"
            title={item.name}
          >
            <Link
              className="rounded-sm hover:text-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              to={`/jogos/${String(item.id)}`}
            >
              {item.name}
            </Link>
          </h3>
        </div>
        <PlatformChips gameName={item.name} platforms={presentation.platforms} />
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
  showActions = true,
  onPendingActionConsumed,
  pendingAction,
}: ReleaseCardProps): React.ReactElement {
  const { state: authState } = useAuth();
  const {
    addGameToLists,
    listsState,
    loadLists,
    loadWantToPlayIds,
    scopeVersion,
    setWantToPlay,
    wantToPlayIds,
    wantToPlayMemberships,
  } = useLists();
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
  const wantToPlayMembership = wantToPlayMemberships.get(item.id);
  const authLoading = authState.status === 'loading';
  const wantToPlayDisabled =
    authLoading || (authState.status === 'authenticated' && wantToPlayMembership !== 'ready');
  const presentation: ReleasePresentation = {
    status: formatReleaseStatus(item.releaseDate, generatedAt),
    platforms: platformChips(item.platforms),
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

  const handleSetWantToPlay = useCallback(
    (desired = !wantToPlay) => {
      if (authState.status === 'loading') return;
      if (authState.status !== 'authenticated') {
        requestAuthentication('toggle-want-to-play');
        return;
      }
      if (wantToPlayMembership !== 'ready') return;
      if (togglePendingRef.current) return;

      togglePendingRef.current = true;
      setTogglePending(true);
      setToggleError(null);
      void setWantToPlay(toGameSnapshot(item), desired)
        .catch((error: unknown) => {
          if (!isListsOperationCancelled(error)) {
            setToggleError('Não foi possível atualizar Quero jogar. Tente novamente.');
          }
        })
        .finally(() => {
          togglePendingRef.current = false;
          setTogglePending(false);
        });
    },
    [
      authState.status,
      item,
      requestAuthentication,
      setWantToPlay,
      wantToPlay,
      wantToPlayMembership,
    ],
  );

  const retryWantToPlayMembership = useCallback(() => {
    void loadWantToPlayIds([item.id]).catch((error: unknown) => {
      if (isListsOperationCancelled(error)) return;
    });
  }, [item.id, loadWantToPlayIds]);

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
    if (pendingAction === 'toggle-want-to-play' && wantToPlayMembership !== 'ready') return;

    const action = pendingAction;
    let active = true;
    queueMicrotask(() => {
      if (!active || resumedActionRef.current === action) return;
      resumedActionRef.current = action;
      onPendingActionConsumed?.();
      if (action === 'open-add-to-lists') openAddToLists();
      else handleSetWantToPlay(true);
    });

    return () => {
      active = false;
    };
  }, [
    authState.status,
    handleSetWantToPlay,
    onPendingActionConsumed,
    openAddToLists,
    pendingAction,
    wantToPlayMembership,
  ]);

  return (
    <>
      <article
        className="hidden h-full flex-col sm:flex"
        data-testid={`release-card-desktop-${String(item.id)}`}
      >
        <ReleaseCardDesktop
          actionPending={togglePending}
          addToListsButtonRef={desktopListButtonRef}
          authLoading={authLoading}
          item={item}
          onAddToLists={handleOpenAddToLists}
          onToggleWantToPlay={handleSetWantToPlay}
          presentation={presentation}
          showActions={showActions}
          wantToPlay={wantToPlay}
          wantToPlayDisabled={wantToPlayDisabled}
        />
      </article>
      <article
        className="flex h-full flex-col sm:hidden"
        data-testid={`release-card-mobile-${String(item.id)}`}
      >
        <ReleaseCardMobile
          actionPending={togglePending}
          addToListsButtonRef={mobileListButtonRef}
          authLoading={authLoading}
          item={item}
          onAddToLists={handleOpenAddToLists}
          onToggleWantToPlay={handleSetWantToPlay}
          presentation={presentation}
          showActions={showActions}
          wantToPlay={wantToPlay}
          wantToPlayDisabled={wantToPlayDisabled}
        />
      </article>
      {!showActions || toggleError === null ? null : (
        <p
          className="mt-2 rounded-lg border border-brand/50 bg-bg-secondary px-3 py-2 text-sm text-content-primary"
          role="alert"
        >
          {toggleError}
        </p>
      )}
      {showActions && authState.status === 'authenticated' && wantToPlayMembership === 'error' ? (
        <div
          className="mt-2 rounded-lg border border-brand/50 bg-bg-secondary px-3 py-2 text-sm text-content-primary"
          role="alert"
        >
          <p>Não foi possível verificar Quero jogar.</p>
          <button
            className="mt-2 font-semibold underline underline-offset-2"
            onClick={retryWantToPlayMembership}
            type="button"
          >
            Tentar novamente para {item.name}
          </button>
        </div>
      ) : null}
      {showActions && addToListsOpen ? (
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
