import { ChevronDown, X } from 'lucide-react';

import {
  releaseGenreOptions,
  releasePlatformOptions,
  type ReleaseFilterSelection,
  type ReleaseGenreFilterKey,
  type ReleasePlatformFilterKey,
} from '@/features/releases/model/release-filter-options';

const desktopChipClassName =
  'flex h-10 items-center gap-2 rounded-lg border px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
const compactChipClassName =
  'relative flex min-h-11 min-w-0 items-center rounded-lg border px-3 text-xs font-medium focus-within:ring-2 focus-within:ring-brand';

interface FilterSelectProps<TKey extends string> {
  readonly ariaLabel: string;
  readonly className: string;
  readonly onChange: (value: TKey) => void;
  readonly options: readonly { readonly key: TKey; readonly label: string }[];
  readonly value: TKey;
}

function FilterSelect<TKey extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  value,
}: FilterSelectProps<TKey>) {
  return (
    <span className={className}>
      <select
        aria-label={ariaLabel}
        className="min-w-0 w-full max-w-full self-stretch appearance-none truncate bg-transparent pr-5 font-body [color-scheme:dark] outline-none"
        onChange={(event) => {
          onChange(event.target.value as TKey);
        }}
        value={value}
      >
        {options.map((option) => (
          <option
            className="bg-surface font-body text-content-primary"
            key={option.key}
            value={option.key}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2"
        size={16}
        strokeWidth={1.5}
      />
    </span>
  );
}

export interface ReleaseFiltersProps {
  readonly additionalFilterActive?: boolean;
  readonly value: ReleaseFilterSelection;
  readonly onPlatformChange: (value: ReleasePlatformFilterKey) => void;
  readonly onGenreChange: (value: ReleaseGenreFilterKey) => void;
  readonly onClear: () => void;
}

export function ReleaseFilters({
  additionalFilterActive = false,
  value,
  onPlatformChange,
  onGenreChange,
  onClear,
}: ReleaseFiltersProps) {
  const hasActiveFilters =
    additionalFilterActive || value.platform !== 'all' || value.genre !== 'all';
  const clearClassName =
    'shrink-0 font-medium text-text-muted transition-colors enabled:hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40';

  return (
    <section aria-label="Filtros de lançamentos" className="mt-6">
      <div className="flex items-center gap-2 sm:hidden" data-testid="release-filters-mobile">
        <FilterSelect
          ariaLabel="Plataforma"
          className={`${compactChipClassName} flex-1 ${value.platform === 'all' ? 'border-white/10 bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onPlatformChange}
          options={releasePlatformOptions}
          value={value.platform}
        />
        <FilterSelect
          ariaLabel="Gênero"
          className={`${compactChipClassName} flex-1 ${value.genre === 'all' ? 'border-white/10 bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onGenreChange}
          options={releaseGenreOptions}
          value={value.genre}
        />
        <button
          aria-label="Limpar filtros"
          className={`${clearClassName} grid size-11 place-items-center rounded-lg`}
          disabled={!hasActiveFilters}
          onClick={onClear}
          type="button"
        >
          <X aria-hidden="true" size={18} strokeWidth={1.5} />
        </button>
      </div>

      <div
        className="hidden items-center gap-2 sm:flex lg:hidden"
        data-testid="release-filters-tablet"
      >
        <FilterSelect
          ariaLabel="Plataforma"
          className={`${compactChipClassName} max-w-[190px] ${value.platform === 'all' ? 'border-white/10 bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onPlatformChange}
          options={releasePlatformOptions}
          value={value.platform}
        />
        <FilterSelect
          ariaLabel="Gênero"
          className={`${compactChipClassName} max-w-[170px] ${value.genre === 'all' ? 'border-white/10 bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onGenreChange}
          options={releaseGenreOptions}
          value={value.genre}
        />
        <button
          aria-label="Limpar filtros"
          className={`${clearClassName} px-2 text-xs`}
          disabled={!hasActiveFilters}
          onClick={onClear}
          type="button"
        >
          Limpar filtros
        </button>
      </div>

      <div
        className="hidden flex-wrap items-center gap-2 lg:flex"
        data-testid="release-filters-desktop"
      >
        {releasePlatformOptions.map((option) => {
          const selected = option.key === value.platform;
          return (
            <button
              aria-pressed={selected}
              className={`${desktopChipClassName} ${selected ? 'border-brand bg-filter-active font-semibold text-filter-active-text' : 'border-white/10 bg-bg-secondary font-medium text-text-muted'}`}
              key={option.key}
              onClick={() => {
                onPlatformChange(option.key);
              }}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
        <FilterSelect
          ariaLabel="Gênero"
          className={`${desktopChipClassName} relative focus-within:ring-2 focus-within:ring-brand ${value.genre === 'all' ? 'border-white/10 bg-bg-secondary font-medium text-text-muted' : 'border-brand bg-filter-active font-semibold text-filter-active-text'}`}
          onChange={onGenreChange}
          options={releaseGenreOptions}
          value={value.genre}
        />
        <button
          aria-label="Limpar filtros"
          className={`${clearClassName} text-xs`}
          disabled={!hasActiveFilters}
          onClick={onClear}
          type="button"
        >
          Limpar filtros
        </button>
      </div>
    </section>
  );
}
