import { BookmarkPlus, CircleCheck, Gamepad2, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

import { AddToListsModal } from '@/features/lists/components/AddToListsModal';
import { demoAddToListsOptions } from '@/features/lists/model/add-to-lists';
import {
  compactPlatformLabel,
  formatReleaseDate,
  formatReleaseStatus,
  platformLabel,
  type ReleaseItem,
} from '@/features/releases/model/release-presentation';

import type * as React from 'react';

export interface ReleaseCardProps {
  readonly item: ReleaseItem;
  readonly generatedAt: string;
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
  readonly gameName: string;
  readonly onToggle: () => void;
  readonly selected: boolean;
}

function WantToPlayButton({
  compact = false,
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
          onClick={onAddToLists}
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
            onClick={onAddToLists}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
    </>
  );
}

export function ReleaseCard({ item, generatedAt }: ReleaseCardProps): React.ReactElement {
  const [addToListsOpen, setAddToListsOpen] = useState(false);
  const [wantToPlay, setWantToPlay] = useState(false);
  const listTriggerRef = useRef<HTMLButtonElement | null>(null);
  const presentation: ReleasePresentation = {
    date: formatReleaseDate(item.releaseDate),
    status: formatReleaseStatus(item.releaseDate, generatedAt),
    desktopPlatforms: desktopPlatformChips(item.platforms),
    compactPlatforms: compactPlatformLabel(item.platforms),
    genre: item.genres.at(0)?.name,
  };

  const handleOpenAddToLists: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    listTriggerRef.current = event.currentTarget;
    setAddToListsOpen(true);
  };

  const handleToggleWantToPlay = () => {
    setWantToPlay((current) => !current);
  };

  const handleCloseAddToLists = () => {
    setAddToListsOpen(false);
    queueMicrotask(() => {
      listTriggerRef.current?.focus();
    });
  };

  return (
    <>
      <article
        className="hidden h-[407px] rounded-2xl border border-border-brand bg-surface p-3 shadow-[0_8px_24px_#00000040] sm:flex sm:flex-col sm:gap-2"
        data-testid={`release-card-desktop-${String(item.id)}`}
      >
        <ReleaseCardDesktop
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
          item={item}
          onAddToLists={handleOpenAddToLists}
          onToggleWantToPlay={handleToggleWantToPlay}
          presentation={presentation}
          wantToPlay={wantToPlay}
        />
      </article>
      {addToListsOpen ? (
        <AddToListsModal
          gameName={item.name}
          lists={demoAddToListsOptions}
          onClose={handleCloseAddToLists}
          open
        />
      ) : null}
    </>
  );
}
