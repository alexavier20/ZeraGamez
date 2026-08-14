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
  'flex h-8 items-center gap-[7px] rounded-[9px] px-[11px] text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

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
      aria-label="Alternar visualização"
      className="hidden h-10 w-fit min-w-[189px] items-center gap-1 rounded-xl bg-bg-secondary p-1 lg:flex"
      role="group"
    >
      <button
        aria-controls={controlsId}
        aria-pressed={value === 'list'}
        className={`${optionClassName} ${
          value === 'list'
            ? 'bg-surface-hover text-content-primary ring-1 ring-inset ring-brand'
            : 'bg-transparent text-text-muted ring-1 ring-inset ring-transparent hover:text-content-primary'
        }`}
        onClick={() => {
          onChange('list');
        }}
        type="button"
      >
        <List aria-hidden="true" size={15} />
        Lista
      </button>
      <button
        aria-controls={calendarPopupId === undefined ? controlsId : `${controlsId} ${calendarPopupId}`}
        aria-expanded={calendarPopupId === undefined ? undefined : calendarExpanded}
        aria-haspopup={calendarPopupId === undefined ? undefined : 'dialog'}
        aria-pressed={value === 'calendar'}
        className={`${optionClassName} ${
          value === 'calendar'
            ? 'bg-surface-hover text-content-primary ring-1 ring-inset ring-brand'
            : 'bg-transparent text-text-muted ring-1 ring-inset ring-transparent hover:text-content-primary'
        }`}
        onClick={() => {
          onChange('calendar');
        }}
        ref={calendarButtonRef}
        type="button"
      >
        <CalendarDays aria-hidden="true" size={15} />
        {calendarLabel ?? 'Calendário'}
      </button>
    </div>
  );
}
