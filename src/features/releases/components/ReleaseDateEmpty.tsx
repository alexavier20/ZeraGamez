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
      <div className="grid size-14 place-items-center rounded-2xl border border-border bg-bg-secondary text-text-muted">
        <CalendarX aria-hidden="true" size={18} strokeWidth={1.5} />
      </div>
      <h2 className="mt-4 font-heading text-[22px] font-semibold text-content-primary">
        Nenhum lançamento nesta data
      </h2>
      <p className="mt-4 max-w-[640px] text-[13px] text-text-muted">
        Não encontramos jogos com lançamento em {formatReleaseDate(date)}. Escolha outro dia ou
        limpe o filtro.
      </p>
      <button
        className="mt-4 flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-xs font-semibold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={onClearDate}
        type="button"
      >
        <X aria-hidden="true" size={18} strokeWidth={1.5} />
        Limpar data
      </button>
    </section>
  );
}
