import { useEffect, useRef } from 'react';

import { ReleaseDatePicker } from '@/features/releases/components/ReleaseDatePicker';
import {
  ReleaseViewSwitcher,
  type ReleaseView,
} from '@/features/releases/components/ReleaseViewSwitcher';
import { formatCalendarShortDate } from '@/features/releases/model/release-calendar';

export interface ReleaseCalendarControlProps {
  readonly controlsId: string;
  readonly currentDate: string;
  readonly knownReleaseDates: ReadonlySet<string>;
  readonly month: string;
  readonly onClearDate: () => void;
  readonly onMonthChange: (month: string) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelectDate: (date: string) => void;
  readonly open: boolean;
  readonly selectedDate: string | null;
}

export function ReleaseCalendarControl({
  controlsId,
  currentDate,
  knownReleaseDates,
  month,
  onClearDate,
  onMonthChange,
  onOpenChange,
  onSelectDate,
  open,
  selectedDate,
}: ReleaseCalendarControlProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const value: ReleaseView = open || selectedDate !== null ? 'calendar' : 'list';
  const calendarLabel = selectedDate === null ? 'Calendário' : formatCalendarShortDate(selectedDate);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node) === false) {
        onOpenChange(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onOpenChange, open]);

  function handlePickerClose() {
    onOpenChange(false);
    queueMicrotask(() => {
      calendarButtonRef.current?.focus();
    });
  }

  return (
    <div className="relative hidden lg:block" ref={rootRef}>
      <ReleaseViewSwitcher
        calendarButtonRef={calendarButtonRef}
        calendarExpanded={open}
        calendarLabel={calendarLabel}
        calendarPopupId="release-date-picker"
        controlsId={controlsId}
        onChange={(nextValue) => {
          if (nextValue === 'list') {
            onClearDate();
            return;
          }

          onOpenChange(!open);
        }}
        value={value}
      />
      {open ? (
        <div className="absolute right-1 top-11 z-30">
          <ReleaseDatePicker
            currentDate={currentDate}
            knownReleaseDates={knownReleaseDates}
            month={month}
            onMonthChange={onMonthChange}
            onRequestClose={handlePickerClose}
            onSelect={onSelectDate}
            selectedDate={selectedDate}
          />
        </div>
      ) : null}
    </div>
  );
}
