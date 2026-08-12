import { ChevronDown, X } from 'lucide-react';

import {
  releaseGenreOptions,
  releasePlatformOptions,
  type ReleaseFilterSelection,
  type ReleaseGenreFilterKey,
  type ReleasePlatformFilterKey,
} from '@/features/releases/model/release-filter-options';

const desktopChipClassName =
  'flex h-[38px] items-center gap-[7px] rounded-[11px] border px-[13px] text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
const compactChipClassName =
  'relative flex h-9 min-w-0 items-center rounded-[10px] border px-[11px] text-[11px] font-semibold focus-within:ring-2 focus-within:ring-brand';

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
        className="min-w-0 max-w-full appearance-none truncate bg-transparent pr-5 outline-none"
        onChange={(event) => {
          onChange(event.target.value as TKey);
        }}
        value={value}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2" size={13} />
    </span>
  );
}

export interface ReleaseFiltersProps {
  readonly value: ReleaseFilterSelection;
  readonly onPlatformChange: (value: ReleasePlatformFilterKey) => void;
  readonly onGenreChange: (value: ReleaseGenreFilterKey) => void;
  readonly onClear: () => void;
}

export function ReleaseFilters({
  value,
  onPlatformChange,
  onGenreChange,
  onClear,
}: ReleaseFiltersProps) {
  const hasActiveFilters = value.platform !== 'all' || value.genre !== 'all';
  const clearClassName =
    'shrink-0 font-semibold text-brand-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <section aria-label="Filtros de lançamentos" className="mt-[18px] sm:mt-[22px] lg:mt-7">
      <div className="flex items-center gap-2 sm:hidden" data-testid="release-filters-mobile">
        <FilterSelect
          ariaLabel="Plataforma"
          className={`${compactChipClassName} max-w-[148px] ${value.platform === 'all' ? 'border-border-brand bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onPlatformChange}
          options={releasePlatformOptions}
          value={value.platform}
        />
        <FilterSelect
          ariaLabel="Gênero"
          className={`${compactChipClassName} max-w-[132px] ${value.genre === 'all' ? 'border-border-brand bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onGenreChange}
          options={releaseGenreOptions}
          value={value.genre}
        />
        <button
          aria-label="Limpar filtros"
          className={`${clearClassName} grid size-9 place-items-center rounded-[10px]`}
          disabled={!hasActiveFilters}
          onClick={onClear}
          type="button"
        >
          <X aria-hidden="true" size={15} />
        </button>
      </div>

      <div
        className="hidden items-center gap-2 sm:flex lg:hidden"
        data-testid="release-filters-tablet"
      >
        <FilterSelect
          ariaLabel="Plataforma"
          className={`${compactChipClassName} max-w-[190px] ${value.platform === 'all' ? 'border-border-brand bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onPlatformChange}
          options={releasePlatformOptions}
          value={value.platform}
        />
        <FilterSelect
          ariaLabel="Gênero"
          className={`${compactChipClassName} max-w-[170px] ${value.genre === 'all' ? 'border-border-brand bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
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

      <div className="hidden items-center gap-[10px] lg:flex" data-testid="release-filters-desktop">
        {releasePlatformOptions.map((option) => {
          const selected = option.key === value.platform;
          return (
            <button
              aria-pressed={selected}
              className={`${desktopChipClassName} ${selected ? 'border-brand bg-filter-active font-semibold text-filter-active-text' : 'border-border-brand bg-bg-secondary font-medium text-text-muted'}`}
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
          className={`${desktopChipClassName} relative focus-within:ring-2 focus-within:ring-brand ${value.genre === 'all' ? 'border-border-brand bg-bg-secondary font-medium text-text-muted' : 'border-brand bg-filter-active font-semibold text-filter-active-text'}`}
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
