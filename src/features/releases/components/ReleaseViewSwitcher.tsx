import { CalendarDays, List } from 'lucide-react';

import type { Ref } from 'react';

export type ReleaseView = 'list' | 'calendar';

type ReleaseViewSwitcherProps = Readonly<{
  calendarButtonRef?: Ref<HTMLButtonElement>;
  calendarExpanded?: boolean;
  calendarLabel?: string;
  calendarPopupId?: string;
  controlsId: string;
  onChange: (value: ReleaseView) => void;
  value: ReleaseView;
}>;

const optionClassName =
  'flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export function ReleaseViewSwitcher({
  calendarButtonRef,
  calendarExpanded,
  calendarLabel,
  calendarPopupId,
  controlsId,
  onChange,
  value,
}: ReleaseViewSwitcherProps) {
  return (
    <div
      aria-label="Filtrar por data"
      className="flex w-fit max-w-full items-center gap-1 rounded-xl border border-border bg-bg-secondary p-1"
      role="group"
    >
      <button
        aria-label="Todas as datas"
        aria-controls={controlsId}
        aria-pressed={value === 'list'}
        className={`${optionClassName} ${
          value === 'list'
            ? 'bg-brand-bright/20 text-content-primary ring-1 ring-inset ring-border'
            : 'bg-transparent text-text-muted ring-1 ring-inset ring-transparent hover:text-content-primary'
        }`}
        onClick={() => {
          onChange('list');
        }}
        type="button"
      >
        <List aria-hidden="true" size={18} strokeWidth={1.5} />
        Todas
      </button>
      <button
        aria-controls={
          calendarPopupId === undefined ? controlsId : `${controlsId} ${calendarPopupId}`
        }
        aria-expanded={calendarPopupId === undefined ? undefined : calendarExpanded}
        aria-haspopup={calendarPopupId === undefined ? undefined : 'dialog'}
        aria-pressed={value === 'calendar'}
        className={`${optionClassName} ${
          value === 'calendar'
            ? 'bg-brand-bright/20 text-content-primary ring-1 ring-inset ring-border'
            : 'bg-transparent text-text-muted ring-1 ring-inset ring-transparent hover:text-content-primary'
        }`}
        onClick={() => {
          onChange('calendar');
        }}
        ref={calendarButtonRef}
        type="button"
      >
        <CalendarDays aria-hidden="true" size={18} strokeWidth={1.5} />
        {calendarLabel ?? 'Escolher data'}
      </button>
    </div>
  );
}
