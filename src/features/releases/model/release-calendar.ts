import { civilDateSchema } from '../../../../shared/contracts/releases';

export interface CalendarDay {
  readonly date: string;
  readonly dayNumber: number;
  readonly inCurrentMonth: boolean;
}

const DAY_MS = 86_400_000;
const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});
const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});
const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});
const saoPauloFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
});

function timestamp(value: string): number {
  return Date.parse(`${civilDateSchema.parse(value)}T00:00:00.000Z`);
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
}

export function addCalendarDays(value: string, amount: number): string {
  return new Date(timestamp(value) + amount * DAY_MS).toISOString().slice(0, 10);
}

export function calendarMonthStart(value: string): string {
  return `${civilDateSchema.parse(value).slice(0, 7)}-01`;
}

export function addCalendarMonths(value: string, amount: number): string {
  const date = new Date(`${calendarMonthStart(value)}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}

export function buildCalendarMonth(value: string): CalendarDay[] {
  const month = calendarMonthStart(value);
  const firstWeekday = new Date(timestamp(month)).getUTCDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  const firstGridDate = addCalendarDays(month, -mondayOffset);
  const monthKey = month.slice(0, 7);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addCalendarDays(firstGridDate, index);
    return {
      date,
      dayNumber: Number(date.slice(8, 10)),
      inCurrentMonth: date.startsWith(monthKey),
    };
  });
}

export function formatCalendarMonth(value: string): string {
  return capitalize(monthFormatter.format(new Date(timestamp(calendarMonthStart(value)))));
}

export function formatCalendarShortDate(value: string): string {
  const parts = Object.fromEntries(
    shortDateFormatter
      .formatToParts(new Date(timestamp(value)))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day} ${parts.month} ${parts.year}`;
}

export function formatCalendarLongDate(value: string): string {
  return longDateFormatter.format(new Date(timestamp(value)));
}

export function todayInSaoPaulo(now = new Date()): string {
  const parts = Object.fromEntries(
    saoPauloFormatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
