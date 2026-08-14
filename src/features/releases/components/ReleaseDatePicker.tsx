import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  addCalendarDays,
  addCalendarMonths,
  buildCalendarMonth,
  calendarMonthStart,
  formatCalendarLongDate,
  formatCalendarMonth,
} from '@/features/releases/model/release-calendar';

export interface ReleaseDatePickerProps {
  readonly currentDate: string;
  readonly knownReleaseDates: ReadonlySet<string>;
  readonly month: string;
  readonly onMonthChange: (month: string) => void;
  readonly onRequestClose: () => void;
  readonly onSelect: (date: string) => void;
  readonly selectedDate: string | null;
}

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function getInitialFocusDate({ currentDate, month, selectedDate }: ReleaseDatePickerProps): string {
  if (selectedDate !== null) {
    return selectedDate;
  }

  return calendarMonthStart(currentDate) === calendarMonthStart(month)
    ? currentDate
    : calendarMonthStart(month);
}

export function ReleaseDatePicker({
  currentDate,
  knownReleaseDates,
  month,
  onMonthChange,
  onRequestClose,
  onSelect,
  selectedDate,
}: ReleaseDatePickerProps) {
  const focusTarget = getInitialFocusDate({
    currentDate,
    knownReleaseDates,
    month,
    onMonthChange,
    onRequestClose,
    onSelect,
    selectedDate,
  });
  const [focusDate, setFocusDate] = useState(focusTarget);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const days = buildCalendarMonth(month);
  const weeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, (index + 1) * 7));

  useEffect(() => {
    setFocusDate(focusTarget);
  }, [focusTarget]);

  useEffect(() => {
    dayRefs.current.get(focusDate)?.focus();
  }, [focusDate, month]);

  function moveFocus(amount: number) {
    const nextFocusDate = addCalendarDays(focusDate, amount);
    setFocusDate(nextFocusDate);

    if (calendarMonthStart(nextFocusDate) !== calendarMonthStart(month)) {
      onMonthChange(calendarMonthStart(nextFocusDate));
    }
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(7);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        moveFocus(-1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(-7);
        break;
      case 'PageDown':
        event.preventDefault();
        onMonthChange(addCalendarMonths(month, 1));
        break;
      case 'PageUp':
        event.preventDefault();
        onMonthChange(addCalendarMonths(month, -1));
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        onRequestClose();
        break;
      default:
        break;
    }
  }

  return (
    <div
      aria-label={formatCalendarMonth(month)}
      className="h-[344px] w-80 rounded-[14px] border border-border-brand bg-surface p-4 shadow-[0_8px_20px_#00000066]"
      id="release-date-picker"
      onKeyDown={handleDialogKeyDown}
      role="dialog"
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex h-8 items-center justify-between">
          <button
            aria-label="Mês anterior"
            className="grid size-8 place-items-center rounded-lg bg-surface-hover"
            onClick={() => {
              onMonthChange(addCalendarMonths(month, -1));
            }}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <span className="text-sm font-semibold text-content-primary">{formatCalendarMonth(month)}</span>
          <button
            aria-label="Próximo mês"
            className="grid size-8 place-items-center rounded-lg bg-surface-hover"
            onClick={() => {
              onMonthChange(addCalendarMonths(month, 1));
            }}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1" role="row">
          {weekdays.map((weekday) => (
            <div
              className="grid h-5 w-9 place-items-center text-[11px] font-medium text-text-muted"
              key={weekday}
              role="columnheader"
            >
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid gap-1" role="grid">
          {weeks.map((week) => (
            <div className="grid grid-cols-7 gap-1" key={week[0].date} role="row">
              {week.map((day) => {
                const selected = day.date === selectedDate;
                const today = day.date === currentDate;
                const knownRelease = knownReleaseDates.has(day.date);
                const dayClassName = selected
                  ? 'bg-brand font-bold text-white'
                  : today
                    ? 'border border-brand bg-transparent font-medium text-content-primary'
                    : day.inCurrentMonth
                      ? 'font-medium text-content-primary hover:bg-surface-hover'
                      : 'font-medium text-text-muted opacity-[0.58] hover:bg-surface-hover';

                return (
                  <div key={day.date} role="gridcell">
                    <button
                      aria-label={formatCalendarLongDate(day.date)}
                      aria-pressed={selected}
                      className={`relative grid size-9 place-items-center rounded-lg text-[13px] ${dayClassName}`}
                      data-today={today || undefined}
                      onClick={() => {
                        onSelect(day.date);
                      }}
                      ref={(element) => {
                        if (element === null) {
                          dayRefs.current.delete(day.date);
                        } else {
                          dayRefs.current.set(day.date, element);
                        }
                      }}
                      type="button"
                    >
                      {day.dayNumber}
                      {knownRelease && !selected ? (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1 size-1 rounded-full bg-brand"
                          data-testid={`release-indicator-${day.date}`}
                        />
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
