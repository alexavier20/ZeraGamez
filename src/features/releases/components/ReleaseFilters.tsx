import { CalendarDays, ChevronDown, Gamepad2, SlidersHorizontal } from 'lucide-react';

const desktopChipClassName =
  'flex h-[38px] items-center gap-[7px] rounded-[11px] border px-[13px] text-xs';
const compactChipClassName =
  'flex items-center rounded-[10px] border px-[11px] text-[11px] font-semibold';
const mobileChipClassName =
  'flex h-[38px] items-center gap-[7px] rounded-[11px] border px-[11px] text-[11px] font-semibold';

export function ReleaseFilters() {
  return (
    <section aria-label="Filtros de lançamentos" className="mt-[18px] sm:mt-[22px] lg:mt-7">
      <div className="flex items-center gap-2 sm:hidden" data-testid="release-filters-mobile">
        <span className={`${mobileChipClassName} border-brand bg-brand text-content-primary`}>
          <SlidersHorizontal aria-hidden="true" size={15} />
          <span>Filtros (2)</span>
        </span>
        <span className={`${mobileChipClassName} border-border-brand bg-surface text-text-muted`}>
          <CalendarDays aria-hidden="true" size={15} />
          <span>Período</span>
        </span>
        <span className={`${mobileChipClassName} border-border-brand bg-surface text-text-muted`}>
          <Gamepad2 aria-hidden="true" size={15} />
          <span>PS5</span>
        </span>
      </div>

      <div
        className="hidden items-center gap-2 sm:flex lg:hidden"
        data-testid="release-filters-tablet"
      >
        <span
          className={`${compactChipClassName} h-9 border-brand bg-[#ff30402a] text-filter-active-text`}
        >
          <span>Todas</span>
        </span>
        {['PS5', 'PC', 'Gênero', 'Período'].map((label) => (
          <span
            className={`${compactChipClassName} h-9 border-border-brand bg-surface text-text-muted`}
            key={label}
          >
            <span>{label}</span>
          </span>
        ))}
      </div>

      <div className="hidden items-center gap-[10px] lg:flex" data-testid="release-filters-desktop">
        <span
          className={`${desktopChipClassName} border-brand bg-filter-active font-semibold text-filter-active-text`}
        >
          <span>Todas as plataformas</span>
        </span>
        {['PC', 'PlayStation 5', 'Xbox Series X|S', 'Nintendo Switch'].map((label) => (
          <span
            className={`${desktopChipClassName} border-border-brand bg-bg-secondary font-medium text-text-muted`}
            key={label}
          >
            <span>{label}</span>
          </span>
        ))}
        <span
          className={`${desktopChipClassName} border-border-brand bg-bg-secondary font-medium text-text-muted`}
        >
          <span>Gênero</span>
          <ChevronDown aria-hidden="true" size={13} />
        </span>
        <span
          className={`${desktopChipClassName} border-border-brand bg-bg-secondary font-medium text-text-muted`}
        >
          <span>Período</span>
          <ChevronDown aria-hidden="true" size={13} />
        </span>
        <span className="text-xs font-semibold text-brand-bright">Limpar filtros</span>
      </div>
    </section>
  );
}
