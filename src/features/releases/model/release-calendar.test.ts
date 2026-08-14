import { describe, expect, it } from 'vitest';

import {
  addCalendarDays,
  addCalendarMonths,
  buildCalendarMonth,
  calendarMonthStart,
  formatCalendarLongDate,
  formatCalendarMonth,
  formatCalendarShortDate,
  todayInSaoPaulo,
} from './release-calendar';

describe('release calendar model', () => {
  it('builds six Monday-first weeks around August 2026', () => {
    const days = buildCalendarMonth('2026-08-14');

    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({ date: '2026-07-27', dayNumber: 27, inCurrentMonth: false });
    expect(days[5]).toEqual({ date: '2026-08-01', dayNumber: 1, inCurrentMonth: true });
    expect(days[41]).toEqual({ date: '2026-09-06', dayNumber: 6, inCurrentMonth: false });
  });

  it('handles leap-day and year boundaries with UTC civil arithmetic', () => {
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addCalendarDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addCalendarMonths('2026-12-01', 1)).toBe('2027-01-01');
    expect(addCalendarMonths('2027-01-01', -1)).toBe('2026-12-01');
    expect(calendarMonthStart('2026-08-31')).toBe('2026-08-01');
  });

  it('formats the approved Portuguese labels', () => {
    expect(formatCalendarMonth('2026-07-01')).toBe('Julho de 2026');
    expect(formatCalendarShortDate('2026-07-29')).toBe('29 jul. 2026');
    expect(formatCalendarLongDate('2026-07-29')).toBe('29 de julho de 2026');
  });

  it('derives the civil day in America/Sao_Paulo', () => {
    expect(todayInSaoPaulo(new Date('2026-08-15T02:30:00.000Z'))).toBe('2026-08-14');
    expect(todayInSaoPaulo(new Date('2026-08-15T03:30:00.000Z'))).toBe('2026-08-15');
  });
});
