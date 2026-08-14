import { CalendarX, X } from 'lucide-react';

import { formatReleaseDate } from '@/features/releases/model/release-presentation';

import type * as React from 'react';

export interface ReleaseDateEmptyProps {
  readonly date: string;
  readonly onClearDate: () => void;
}

export function ReleaseDateEmpty({ date, onClearDate }: ReleaseDateEmptyProps): React.ReactElement {
  return (
    <section
      aria-live="polite"
      className="flex h-[360px] flex-col items-center justify-center text-center"
      role="status"
    >
      <div className="grid size-14 place-items-center rounded-2xl border border-border-brand bg-bg-secondary text-brand">
        <CalendarX aria-hidden="true" size={28} />
      </div>
      <h2 className="mt-[14px] font-heading text-[22px] font-semibold text-content-primary">
        Nenhum lançamento nesta data
      </h2>
      <p className="mt-[14px] max-w-[640px] text-[13px] text-text-muted">
        Não encontramos jogos com lançamento em {formatReleaseDate(date)}. Escolha outro dia ou
        limpe o filtro.
      </p>
      <button
        className="mt-[14px] flex h-9 items-center gap-2 rounded-[9px] border border-border-brand bg-surface-hover px-[14px] text-xs font-semibold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={onClearDate}
        type="button"
      >
        <X aria-hidden="true" size={14} />
        Limpar data
      </button>
    </section>
  );
}
