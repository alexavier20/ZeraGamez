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

function getInitialFocusDate({
  currentDate,
  month,
  selectedDate,
}: Pick<ReleaseDatePickerProps, 'currentDate' | 'month' | 'selectedDate'>): string {
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
  const focusTarget = getInitialFocusDate({ currentDate, month, selectedDate });
  const [focusDate, setFocusDate] = useState(focusTarget);
  const focusInputs = useRef({ currentDate, selectedDate });
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const days = buildCalendarMonth(month);
  const weeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, (index + 1) * 7));

  useEffect(() => {
    if (
      focusInputs.current.currentDate !== currentDate ||
      focusInputs.current.selectedDate !== selectedDate
    ) {
      focusInputs.current = { currentDate, selectedDate };
      setFocusDate(getInitialFocusDate({ currentDate, month, selectedDate }));
    }
  }, [currentDate, month, selectedDate]);

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

  function moveFocusToMonth(amount: number) {
    setFocusDate(addCalendarMonths(focusDate, amount));
    onMonthChange(addCalendarMonths(month, amount));
  }

  function moveToHeaderMonth(amount: number) {
    const nextMonth = addCalendarMonths(month, amount);
    setFocusDate(calendarMonthStart(nextMonth));
    onMonthChange(nextMonth);
  }

  function handleEscape(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onRequestClose();
    }
  }

  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    handleEscape(event);
    if (event.defaultPrevented) return;

    if (!(event.target as HTMLElement).closest('[data-calendar-day]')) {
      return;
    }

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
        moveFocusToMonth(1);
        break;
      case 'PageUp':
        event.preventDefault();
        moveFocusToMonth(-1);
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
      role="dialog"
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex h-8 items-center justify-between">
          <span className="font-heading text-base font-semibold text-content-primary">
            {formatCalendarMonth(month)}
          </span>
          <div className="flex items-center gap-2">
            <button
              aria-label="Mês anterior"
              className="grid size-8 place-items-center rounded-lg bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={() => {
                moveToHeaderMonth(-1);
              }}
              onKeyDown={handleEscape}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </button>
            <button
              aria-label="Próximo mês"
              className="grid size-8 place-items-center rounded-lg bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={() => {
                moveToHeaderMonth(1);
              }}
              onKeyDown={handleEscape}
              type="button"
            >
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
        </div>

        <div className="grid gap-1" onKeyDown={handleGridKeyDown} role="grid" tabIndex={-1}>
          <div className="grid grid-cols-7 gap-1" role="row">
            {weekdays.map((weekday) => (
              <div
                className="grid h-5 w-9 place-items-center rounded bg-bg-secondary text-[11px] font-semibold text-text-muted"
                key={weekday}
                role="columnheader"
              >
                {weekday}
              </div>
            ))}
          </div>
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
                      className={`relative grid size-9 place-items-center rounded-lg text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${dayClassName}`}
                      data-calendar-day="true"
                      data-today={today || undefined}
                      onClick={() => {
                        onSelect(day.date);
                      }}
                      onFocus={() => {
                        setFocusDate(day.date);
                      }}
                      ref={(element) => {
                        if (element === null) {
                          dayRefs.current.delete(day.date);
                        } else {
                          dayRefs.current.set(day.date, element);
                        }
                      }}
                      tabIndex={day.date === focusDate ? 0 : -1}
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
