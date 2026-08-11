import { BookmarkPlus, Ellipsis, Gamepad2, Heart, Plus } from 'lucide-react';

import {
  compactPlatformLabel,
  desktopPlatformLabels,
  formatReleaseDate,
  formatReleaseStatus,
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
  readonly desktopPlatforms: readonly string[];
  readonly compactPlatforms: string;
  readonly genre: string | undefined;
}

interface ReleaseCardLayoutProps {
  readonly item: ReleaseItem;
  readonly presentation: ReleasePresentation;
}

const disabledActionClassName =
  'inline-flex items-center justify-center rounded-lg text-text-muted transition-colors disabled:cursor-not-allowed disabled:opacity-100';

function ReleaseCardDesktop({ item, presentation }: ReleaseCardLayoutProps) {
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
        <button
          aria-label={`Favoritar ${item.name}`}
          className={`${disabledActionClassName} absolute right-2 top-2 size-8 bg-app/85 hover:text-content-primary`}
          disabled
          type="button"
        >
          <Heart aria-hidden="true" size={16} />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <h3
            className="truncate font-heading text-base font-semibold text-text-primary"
            title={item.name}
          >
            {item.name}
          </h3>
          <p className="mt-1 text-xs text-text-muted">{presentation.date}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {presentation.desktopPlatforms.map((platform) => (
            <span
              className="rounded-md border border-border-brand bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-muted"
              key={platform}
            >
              {platform}
            </span>
          ))}
        </div>

        {presentation.genre ? (
          <p className="truncate text-xs text-text-muted" title={presentation.genre}>
            {presentation.genre}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-border-brand pt-3">
        <button
          aria-label={`Adicionar ${item.name} à lista`}
          className={`${disabledActionClassName} h-9 flex-1 gap-2 border border-border-brand bg-bg-secondary px-3 text-xs font-semibold text-content-primary`}
          disabled
          type="button"
        >
          <BookmarkPlus aria-hidden="true" size={15} />
          Adicionar à lista
        </button>
        <button
          aria-label={`Mais opções para ${item.name}`}
          className={`${disabledActionClassName} size-9 border border-border-brand bg-bg-secondary`}
          disabled
          type="button"
        >
          <Ellipsis aria-hidden="true" size={17} />
        </button>
      </div>
    </>
  );
}

function ReleaseCardMobile({ item, presentation }: ReleaseCardLayoutProps) {
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
            <button
              aria-label={`Favoritar ${item.name}`}
              className={`${disabledActionClassName} -mr-1 -mt-1 size-7 shrink-0`}
              disabled
              type="button"
            >
              <Heart aria-hidden="true" size={15} />
            </button>
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
            className={`${disabledActionClassName} size-7 shrink-0 border border-border-brand bg-bg-secondary`}
            disabled
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
          </button>
          <button
            aria-label={`Mais opções para ${item.name}`}
            className={`${disabledActionClassName} size-7 shrink-0`}
            disabled
            type="button"
          >
            <Ellipsis aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

export function ReleaseCard({ item, generatedAt }: ReleaseCardProps): React.ReactElement {
  const presentation: ReleasePresentation = {
    date: formatReleaseDate(item.releaseDate),
    status: formatReleaseStatus(item.releaseDate, generatedAt),
    desktopPlatforms: desktopPlatformLabels(item.platforms),
    compactPlatforms: compactPlatformLabel(item.platforms),
    genre: item.genres.at(0)?.name,
  };

  return (
    <>
      <article
        className="hidden overflow-hidden rounded-2xl border border-border-brand bg-surface p-3 shadow-[0_8px_24px_#00000040] sm:flex sm:flex-col sm:gap-3"
        data-testid={`release-card-desktop-${String(item.id)}`}
      >
        <ReleaseCardDesktop item={item} presentation={presentation} />
      </article>
      <article
        className="grid h-[132px] grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-[14px] border border-border-brand bg-surface p-2.5 sm:hidden"
        data-testid={`release-card-mobile-${String(item.id)}`}
      >
        <ReleaseCardMobile item={item} presentation={presentation} />
      </article>
    </>
  );
}
