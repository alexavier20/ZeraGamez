# Release Calendar Date Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the releases calendar placeholder with the approved desktop date picker and query complete release results for one selected civil date.

**Architecture:** Keep date selection and calendar visibility in `ReleasesPage`, isolate UTC-safe calendar arithmetic in a pure model module, and render the approved popover through focused calendar components. Extend `useReleases` with an optional exact date so it sends `from === to`, preserves platform and genre filters, and deliberately skips the two-year pagination horizon for that session.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, Lucide React, Zod 4, Vitest 4, React Testing Library, user-event.

## Global Constraints

- The approved visual references are Pen frames `cO7zp`, `d0K2j`, `Gc9Cn`, and reusable date-picker component `UV3Qw`.
- Calendar UI remains desktop-only at Tailwind breakpoint `lg`; tablet and mobile keep the existing list.
- A selected date is sent as one civil day with `from` and `to` equal to `YYYY-MM-DD`.
- Platform and genre IDs remain combined with the selected date on initial requests and retries.
- Exact-date sessions do not create an incremental pagination horizon.
- No date-picker dependency, URL persistence, browser-storage persistence, backend endpoint change, or IGDB repository change.
- Use the existing Oxanium, Chakra Petch, Tailwind tokens, and Lucide icon dependency.
- Tests are written and observed failing before production code is changed.
- Preserve all unrelated worktree changes.

---

## File Structure

- `shared/contracts/releases.ts` — export the existing civil-date schema for shared validation.
- `src/features/releases/model/release-calendar.ts` — UTC-safe month grid, civil-date movement, São Paulo today, and Portuguese calendar labels.
- `src/features/releases/model/release-calendar.test.ts` — pure behavior tests for grid boundaries, leap years, movement, timezone, and copy.
- `src/features/releases/components/ReleaseDatePicker.tsx` — approved 320 × 344 dialog and keyboard-navigable six-week date grid.
- `src/features/releases/components/ReleaseDatePicker.test.tsx` — dialog anatomy, navigation, selection, indicators, focus, and keyboard tests.
- `src/features/releases/components/ReleaseCalendarControl.tsx` — switcher/popover composition, outside-click close, trigger focus, and dynamic label.
- `src/features/releases/components/ReleaseCalendarControl.test.tsx` — open, close, select, clear, outside click, and focus-return tests.
- `src/features/releases/components/ReleaseViewSwitcher.tsx` — optional popup semantics, calendar label, and calendar trigger ref.
- `src/features/releases/components/ReleaseViewSwitcher.test.tsx` — preserve the basic switcher contract and prove popup attributes.
- `src/features/releases/hooks/use-releases.ts` — exact-date query key and no-horizon behavior.
- `src/features/releases/hooks/use-releases.test.tsx` — exact success, empty, retry, filter combination, cancellation, and no-pagination tests.
- `src/features/releases/components/ReleaseDateEmpty.tsx` — Pen-faithful empty state for one selected date.
- `src/features/releases/components/ReleaseDateEmpty.test.tsx` — exact copy, semantics, icon, geometry classes, and clear callback.
- `src/features/releases/components/ReleaseFilters.tsx` — consider the selected date when enabling Clear filters.
- `src/features/releases/components/ReleaseFilters.test.tsx` — date-only active clear state.
- `src/features/releases/components/ReleaseList.tsx` — request full-date headings for exact results.
- `src/features/releases/components/ReleaseDateGroup.tsx` — render either relative or full-date heading mode.
- `src/features/releases/components/ReleaseList.test.tsx` — full-date heading without Hoje/Amanhã.
- `src/features/releases/components/ReleasesStates.tsx` — remove the obsolete calendar placeholder export.
- `src/features/releases/components/ReleasesStates.test.tsx` — remove the obsolete placeholder expectation while preserving generic states.
- `src/pages/ReleasesPage.tsx` — own calendar state, derive subtitle, retain known dates, compose the popover, and select exact result states.
- `src/app/App.test.tsx` — end-to-end component integration for open, search, empty, clear, filters, observer pause, and retries.

---

### Task 1: Pure Calendar Model

**Files:**

- Modify: `shared/contracts/releases.ts:3`
- Create: `src/features/releases/model/release-calendar.ts`
- Create: `src/features/releases/model/release-calendar.test.ts`

**Interfaces:**

- Consumes: existing Zod civil-date validation in `shared/contracts/releases.ts`.
- Produces: `CalendarDay`, `addCalendarDays`, `addCalendarMonths`, `buildCalendarMonth`, `calendarMonthStart`, `formatCalendarLongDate`, `formatCalendarMonth`, `formatCalendarShortDate`, and `todayInSaoPaulo`.

- [ ] **Step 1: Write the failing model tests**

Create `src/features/releases/model/release-calendar.test.ts` with literal expectations:

```ts
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
```

- [ ] **Step 2: Run the model test and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/model/release-calendar.test.ts
```

Expected: FAIL because `./release-calendar` does not exist.

- [ ] **Step 3: Export the existing validator and implement the model**

Change the declaration in `shared/contracts/releases.ts` to:

```ts
export const civilDateSchema = z.string().refine((value) => {
```

Create `src/features/releases/model/release-calendar.ts`:

```ts
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
```

- [ ] **Step 4: Run the model and contract tests and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/model/release-calendar.test.ts shared/contracts/releases.test.ts
```

Expected: PASS with no warnings.

- [ ] **Step 5: Commit the calendar model**

```powershell
git add shared/contracts/releases.ts src/features/releases/model/release-calendar.ts src/features/releases/model/release-calendar.test.ts
git commit -m "feat: add release calendar date model"
```

---

### Task 2: Accessible Date Picker Popover

**Files:**

- Create: `src/features/releases/components/ReleaseDatePicker.tsx`
- Create: `src/features/releases/components/ReleaseDatePicker.test.tsx`

**Interfaces:**

- Consumes: Task 1 calendar functions.
- Produces: `ReleaseDatePicker` with controlled `month`, `selectedDate`, `knownReleaseDates`, `currentDate`, `onMonthChange`, `onSelect`, and `onRequestClose` props.

- [ ] **Step 1: Write failing picker behavior tests**

Create tests that render July 2026 with `currentDate="2026-07-29"`, `selectedDate="2026-07-31"`, and `knownReleaseDates={new Set(['2026-07-29', '2026-07-30'])}`. Assert these exact behaviors:

```ts
const dialog = screen.getByRole('dialog', { name: 'Julho de 2026' });
expect(dialog).toHaveClass('h-[344px]', 'w-80', 'rounded-[14px]', 'bg-surface', 'p-4');
expect(within(dialog).getAllByRole('columnheader')).toHaveLength(7);
expect(within(dialog).getAllByRole('gridcell')).toHaveLength(42);
expect(screen.getByRole('button', { name: '29 de julho de 2026' })).toHaveAttribute(
  'data-today',
  'true',
);
expect(screen.getByRole('button', { name: '31 de julho de 2026' })).toHaveAttribute(
  'aria-pressed',
  'true',
);
expect(screen.getByTestId('release-indicator-2026-07-29')).toHaveClass('size-1', 'bg-brand');
```

Add independent tests that:

1. click `Mês anterior` and `Próximo mês` and expect `2026-06-01` and `2026-08-01`;
2. click `30 de julho de 2026` and expect `onSelect('2026-07-30')`;
3. confirm the initially focused date is selected date, then today, then month day 1 by rerendering each case;
4. press ArrowRight, ArrowDown, ArrowLeft, and ArrowUp and assert focus moves by `+1`, `+7`, `-1`, and `-7` days;
5. press PageDown and PageUp and assert month callbacks;
6. press Escape and expect `onRequestClose` once.

- [ ] **Step 2: Run the picker test and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseDatePicker.test.tsx
```

Expected: FAIL because `ReleaseDatePicker.tsx` does not exist.

- [ ] **Step 3: Implement the controlled picker**

Create `ReleaseDatePicker.tsx` with this public contract:

```ts
export interface ReleaseDatePickerProps {
  readonly currentDate: string;
  readonly knownReleaseDates: ReadonlySet<string>;
  readonly month: string;
  readonly onMonthChange: (month: string) => void;
  readonly onRequestClose: () => void;
  readonly onSelect: (date: string) => void;
  readonly selectedDate: string | null;
}
```

Use `buildCalendarMonth(month)` and split the result into six arrays of seven. Render:

```tsx
<div
  aria-label={formatCalendarMonth(month)}
  className="h-[344px] w-80 rounded-[14px] border border-border-brand bg-surface p-4 shadow-[0_8px_20px_#00000066]"
  id="release-date-picker"
  onKeyDown={handleDialogKeyDown}
  role="dialog"
>
```

The inner stack must use `flex h-full flex-col gap-3`. The month header is
`flex h-8 items-center justify-between`; month buttons are `grid size-8 place-items-center rounded-lg bg-surface-hover`. The weekday cells are seven `36 × 20` column headers. The grid uses six rows with `gap-1`; every day button is `relative grid size-9 place-items-center rounded-lg text-[13px]`.

Compute day state in this priority order:

```ts
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
```

Add `aria-pressed`, `data-today`, a ref keyed by date, and the release dot only when `knownRelease && !selected`. Use `useState` for the focus date and `useEffect` to focus it after month changes. Arrow keys call `addCalendarDays`; PageUp/PageDown call `addCalendarMonths`; moving focus into another month calls `onMonthChange(calendarMonthStart(nextFocusDate))`. Escape prevents propagation and calls `onRequestClose`.

- [ ] **Step 4: Run picker and accessibility tests and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseDatePicker.test.tsx
```

Expected: PASS with the 42 real day buttons and no mock-component assertions.

- [ ] **Step 5: Commit the date picker**

```powershell
git add src/features/releases/components/ReleaseDatePicker.tsx src/features/releases/components/ReleaseDatePicker.test.tsx
git commit -m "feat: add accessible release date picker"
```

---

### Task 3: Calendar Trigger and Popover Control

**Files:**

- Modify: `src/features/releases/components/ReleaseViewSwitcher.tsx:1-55`
- Modify: `src/features/releases/components/ReleaseViewSwitcher.test.tsx:1-49`
- Create: `src/features/releases/components/ReleaseCalendarControl.tsx`
- Create: `src/features/releases/components/ReleaseCalendarControl.test.tsx`

**Interfaces:**

- Consumes: `ReleaseDatePicker` and `formatCalendarShortDate`.
- Produces: a desktop-only `ReleaseCalendarControl` that owns DOM interaction but not page query state.

- [ ] **Step 1: Write failing switcher and control tests**

Extend `ReleaseViewSwitcher.test.tsx` with a popup case:

```tsx
render(
  <ReleaseViewSwitcher
    calendarExpanded
    calendarLabel="29 jul. 2026"
    calendarPopupId="release-date-picker"
    controlsId="release-results"
    onChange={vi.fn()}
    value="calendar"
  />,
);

const calendar = screen.getByRole('button', { name: '29 jul. 2026' });
expect(calendar).toHaveAttribute('aria-expanded', 'true');
expect(calendar).toHaveAttribute('aria-haspopup', 'dialog');
expect(calendar).toHaveAttribute('aria-controls', 'release-results release-date-picker');
```

Create `ReleaseCalendarControl.test.tsx` with a controlled harness and assert:

- initial Lista state has no dialog;
- clicking Calendário calls `onOpenChange(true)` and the rerendered open state shows the dialog;
- clicking Calendário again calls `onOpenChange(false)`;
- selecting 29 July calls `onSelectDate('2026-07-29')`;
- selected state displays `29 jul. 2026` and clicking Lista calls `onClearDate`;
- pointer down outside calls `onOpenChange(false)`;
- Escape closes and restores focus to the calendar trigger.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseViewSwitcher.test.tsx src/features/releases/components/ReleaseCalendarControl.test.tsx
```

Expected: FAIL because popup props and `ReleaseCalendarControl` do not exist.

- [ ] **Step 3: Extend `ReleaseViewSwitcher` without breaking its default API**

Add these optional properties:

```ts
import type { Ref } from 'react';

type ReleaseViewSwitcherProps = Readonly<{
  calendarButtonRef?: Ref<HTMLButtonElement>;
  calendarExpanded?: boolean;
  calendarLabel?: string;
  calendarPopupId?: string;
  controlsId: string;
  onChange: (value: ReleaseView) => void;
  value: ReleaseView;
}>;
```

For the calendar button, set:

```tsx
aria-controls={
  calendarPopupId === undefined ? controlsId : `${controlsId} ${calendarPopupId}`
}
aria-expanded={calendarPopupId === undefined ? undefined : calendarExpanded}
aria-haspopup={calendarPopupId === undefined ? undefined : 'dialog'}
ref={calendarButtonRef}
```

Render `{calendarLabel ?? 'Calendário'}` after the icon. Replace the fixed switcher width with `w-fit` while preserving `min-w-[189px]` so the selected date expands exactly as in the Pen.

- [ ] **Step 4: Implement `ReleaseCalendarControl`**

Use this contract:

```ts
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
```

Render a `relative` wrapper containing the switcher and, when open, an absolute picker with `absolute right-1 top-11 z-30`. Hold `rootRef` and `calendarButtonRef`. Add a document `pointerdown` listener only while open; close when `rootRef.current?.contains(event.target as Node)` is false. The picker close callback must call `onOpenChange(false)` and then focus `calendarButtonRef.current` in `queueMicrotask`.

Derive the active view and label exactly:

```ts
const value: ReleaseView = open || selectedDate !== null ? 'calendar' : 'list';
const calendarLabel = selectedDate === null ? 'Calendário' : formatCalendarShortDate(selectedDate);
```

List calls `onClearDate`; Calendar toggles `onOpenChange(!open)`.

- [ ] **Step 5: Run the control tests and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseViewSwitcher.test.tsx src/features/releases/components/ReleaseCalendarControl.test.tsx src/features/releases/components/ReleaseDatePicker.test.tsx
```

Expected: PASS with focus restored after Escape and no document-listener leak after unmount.

- [ ] **Step 6: Commit the calendar control**

```powershell
git add src/features/releases/components/ReleaseViewSwitcher.tsx src/features/releases/components/ReleaseViewSwitcher.test.tsx src/features/releases/components/ReleaseCalendarControl.tsx src/features/releases/components/ReleaseCalendarControl.test.tsx
git commit -m "feat: connect release calendar popover"
```

---

### Task 4: Exact-Date Release Sessions

**Files:**

- Modify: `src/features/releases/hooks/use-releases.ts:41-314`
- Modify: `src/features/releases/hooks/use-releases.test.tsx:84-998`

**Interfaces:**

- Consumes: existing `ReleasesClientQuery` fields `from`, `to`, `platformIds`, and `genreIds`.
- Produces: `ReleasesFilters.date?: string` and exact sessions that complete after one day.

- [ ] **Step 1: Add failing exact-date hook tests**

Add four tests to `use-releases.test.tsx`:

```ts
it('loads one exact date with active filters and never creates a next window', async () => {
  const exact = page([release(29, '2026-08-29')], {
    from: '2026-08-29',
    to: '2026-08-29',
  });
  const load = vi.fn<ReleasesDependencies['load']>().mockResolvedValue(exact);
  const { result } = renderHook(() =>
    useReleases(
      { date: '2026-08-29', platformIds: [167], genreIds: [12] },
      { load, logger: logger() },
    ),
  );

  await waitFor(() => expect(result.current.state.status).toBe('success'));
  expect(load.mock.calls[0]?.[0]).toEqual({
    from: '2026-08-29',
    to: '2026-08-29',
    platformIds: [167],
    genreIds: [12],
    limit: 100,
  });
  expect(result.current.pagination).toEqual({ status: 'complete' });

  act(() => result.current.loadMore());
  expect(load).toHaveBeenCalledTimes(1);
});

it('finishes an empty exact date without scanning later windows', async () => {
  const exactEmpty = page([], { from: '2026-08-31', to: '2026-08-31' });
  const load = vi.fn<ReleasesDependencies['load']>().mockResolvedValue(exactEmpty);
  const { result } = renderHook(() =>
    useReleases({ date: '2026-08-31' }, { load, logger: logger() }),
  );

  await waitFor(() => expect(result.current.state.status).toBe('empty'));
  expect(load).toHaveBeenCalledTimes(1);
  expect(result.current.pagination).toEqual({ status: 'complete' });
});
```

Add a retry test that rejects once, calls `retry`, resolves, and expects both calls to contain the same exact `from` and `to`. Add a rerender test that changes `date` while the first promise is pending, expects the first signal to be aborted, resolves the stale promise, and proves only the second date reaches success.

- [ ] **Step 2: Run exact hook tests and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/hooks/use-releases.test.tsx
```

Expected: FAIL because `ReleasesFilters` has no `date` and requests omit `from`/`to`.

- [ ] **Step 3: Add the exact date to the stable filter key**

Extend the public filter interface:

```ts
export interface ReleasesFilters {
  readonly date?: string;
  readonly platformIds?: readonly number[];
  readonly genreIds?: readonly number[];
}
```

Change `filtersFromKeys` to accept `date` and emit an exact range:

```ts
function filtersFromKeys(
  date: string,
  platformIdsKey: string,
  genreIdsKey: string,
): ReleasesClientQuery {
  const platformIds = idsFromKey(platformIdsKey);
  const genreIds = idsFromKey(genreIdsKey);
  return {
    ...(date === '' ? {} : { from: date, to: date }),
    ...(platformIds.length > 0 ? { platformIds } : {}),
    ...(genreIds.length > 0 ? { genreIds } : {}),
  };
}
```

Inside `useReleases`, derive `const dateKey = filters.date ?? ''`, pass it to `filtersFromKeys`, and add `dateKey` to the session effect dependency array.

- [ ] **Step 4: Stop the horizon for exact sessions**

In the initial response branch, replace unconditional horizon creation with:

```ts
const exactDateSession = dateKey !== '';
horizonRef.current = exactDateSession ? null : createReleaseHorizon(page.meta.from);
```

Create the next window only when a horizon exists:

```ts
const horizon = horizonRef.current;
const next = horizon === null ? null : nextReleaseWindow(page.meta.to, horizon);
```

Keep the existing saturated-one-day behavior: a source-truncated exact day cannot be split and must expose the existing sanitized error rather than silently returning incomplete data.

- [ ] **Step 5: Run hook regression tests and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/hooks/use-releases.test.tsx src/features/releases/api/releases-client.test.ts
```

Expected: all exact-date and existing scan/pagination/filter tests PASS.

- [ ] **Step 6: Commit exact-date sessions**

```powershell
git add src/features/releases/hooks/use-releases.ts src/features/releases/hooks/use-releases.test.tsx
git commit -m "feat: query releases by exact date"
```

---

### Task 5: Exact-Date Result Presentation

**Files:**

- Create: `src/features/releases/components/ReleaseDateEmpty.tsx`
- Create: `src/features/releases/components/ReleaseDateEmpty.test.tsx`
- Modify: `src/features/releases/components/ReleaseFilters.tsx:49-166`
- Modify: `src/features/releases/components/ReleaseFilters.test.tsx:8-112`
- Modify: `src/features/releases/components/ReleaseList.tsx:7-25`
- Modify: `src/features/releases/components/ReleaseDateGroup.tsx:9-58`
- Modify: `src/features/releases/components/ReleaseList.test.tsx:45-129`
- Modify: `src/features/releases/components/ReleasesStates.tsx:1-97`
- Modify: `src/features/releases/components/ReleasesStates.test.tsx:1-55`

**Interfaces:**

- Consumes: existing release cards and `formatReleaseDate`.
- Produces: `ReleaseDateEmpty`, `ReleaseFilters.additionalFilterActive`, and `ReleaseList.exactDate`.

- [ ] **Step 1: Write failing presentation tests**

Create `ReleaseDateEmpty.test.tsx`:

```tsx
it('renders the approved empty date state and clears only the date', async () => {
  const user = userEvent.setup();
  const onClearDate = vi.fn();
  render(<ReleaseDateEmpty date="2026-07-31" onClearDate={onClearDate} />);

  const status = screen.getByRole('status');
  expect(status).toHaveClass('h-[360px]');
  expect(status).toHaveTextContent('Nenhum lançamento nesta data');
  expect(status).toHaveTextContent(
    'Não encontramos jogos com lançamento em 31 de julho de 2026. Escolha outro dia ou limpe o filtro.',
  );
  const clear = screen.getByRole('button', { name: 'Limpar data' });
  expect(clear).toHaveClass('h-9', 'rounded-[9px]', 'bg-surface-hover');
  await user.click(clear);
  expect(onClearDate).toHaveBeenCalledTimes(1);
});
```

Add to `ReleaseFilters.test.tsx` a render with default platform/genre and `additionalFilterActive` that expects all three clear buttons enabled.

Add to `ReleaseList.test.tsx`:

```tsx
render(<ReleaseList exactDate response={responseWithThreeReleasesAcrossTwoDates} />);
expect(screen.getByRole('region', { name: '10 de agosto de 2026' })).toBeInTheDocument();
expect(screen.queryByText('Hoje')).not.toBeInTheDocument();
expect(screen.queryByText(/Amanhã/)).not.toBeInTheDocument();
```

Delete the placeholder test expectation only after its production export is removed in Step 3.

- [ ] **Step 2: Run presentation tests and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseDateEmpty.test.tsx src/features/releases/components/ReleaseFilters.test.tsx src/features/releases/components/ReleaseList.test.tsx src/features/releases/components/ReleasesStates.test.tsx
```

Expected: FAIL because the date-empty component and new props do not exist.

- [ ] **Step 3: Implement the approved empty state and remove the placeholder**

Create `ReleaseDateEmpty.tsx` using `CalendarX` and `X` from Lucide. The root is:

```tsx
<section
  aria-live="polite"
  className="flex h-[360px] flex-col items-center justify-center text-center"
  role="status"
>
```

Use a `grid size-14 place-items-center rounded-2xl border border-border-brand bg-bg-secondary text-brand` icon wrapper; title classes `mt-[14px] font-heading text-[22px] font-semibold text-content-primary`; description classes `mt-[14px] max-w-[640px] text-[13px] text-text-muted`; and button classes `mt-[14px] flex h-9 items-center gap-2 rounded-[9px] border border-border-brand bg-surface-hover px-[14px] text-xs font-semibold text-content-primary` plus the established focus ring.

Remove `ReleaseCalendarPlaceholder` and its `CalendarDays` import from `ReleasesStates.tsx`. Remove only the obsolete placeholder test from `ReleasesStates.test.tsx`.

- [ ] **Step 4: Add exact heading mode and additional-filter state**

Add `exactDate?: boolean` to `ReleaseListProps` and pass `headingMode={exactDate ? 'full' : 'relative'}` to each `ReleaseDateGroup`.

Add this prop and heading branch to `ReleaseDateGroup`:

```ts
readonly headingMode?: 'full' | 'relative';
```

When `headingMode === 'full'`, use `formatReleaseDate(group.releaseDate)` for both the accessible heading and visible desktop/mobile text, and do not render the Hoje badge or Amanhã copy. Preserve the current markup and classes for the default `relative` mode.

Add `additionalFilterActive?: boolean` to `ReleaseFiltersProps`, default it to `false`, and compute:

```ts
const hasActiveFilters =
  additionalFilterActive || value.platform !== 'all' || value.genre !== 'all';
```

- [ ] **Step 5: Run presentation tests and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseDateEmpty.test.tsx src/features/releases/components/ReleaseFilters.test.tsx src/features/releases/components/ReleaseList.test.tsx src/features/releases/components/ReleasesStates.test.tsx
```

Expected: PASS; generic list headings and generic loading/empty/error states remain unchanged.

- [ ] **Step 6: Commit exact-date presentation**

```powershell
git add src/features/releases/components/ReleaseDateEmpty.tsx src/features/releases/components/ReleaseDateEmpty.test.tsx src/features/releases/components/ReleaseFilters.tsx src/features/releases/components/ReleaseFilters.test.tsx src/features/releases/components/ReleaseList.tsx src/features/releases/components/ReleaseDateGroup.tsx src/features/releases/components/ReleaseList.test.tsx src/features/releases/components/ReleasesStates.tsx src/features/releases/components/ReleasesStates.test.tsx
git commit -m "feat: present exact release date results"
```

---

### Task 6: Releases Page Integration and Visual Fidelity

**Files:**

- Modify: `src/pages/ReleasesPage.tsx:1-85`
- Modify: `src/app/App.test.tsx:1-513`

**Interfaces:**

- Consumes: `ReleaseCalendarControl`, exact-date `useReleases`, `ReleaseDateEmpty`, `ReleaseList.exactDate`, and `ReleaseFilters.additionalFilterActive`.
- Produces: complete user flow matching all three approved Pen frames.

- [ ] **Step 1: Replace placeholder integration assertions with failing calendar-flow tests**

In the first Releases page integration test, replace the placeholder assertions after clicking Calendário with:

```ts
expect(listButton).toHaveAttribute('aria-pressed', 'false');
expect(calendarButton).toHaveAttribute('aria-pressed', 'true');
expect(calendarButton).toHaveAttribute('aria-expanded', 'true');
expect(screen.getByRole('dialog')).toBeInTheDocument();
expect(screen.getByRole('list', { name: 'Hoje 10 de agosto' })).toBeInTheDocument();
expect(fetchReleasesMock).toHaveBeenCalledTimes(1);
```

Add an exact success test whose fetch mock returns a response using `query.from` as the item date. Select a visible day from the open calendar and assert the last query equals:

```ts
{
  from: selectedDate,
  to: selectedDate,
  limit: 100,
}
```

Then assert the calendar button uses `formatCalendarShortDate(selectedDate)`, the subtitle uses `1 lançamento encontrado em`, the group name uses `formatCalendarLongDate(selectedDate)`, the dialog is closed, and no load-more sentinel is observed.

Add an empty response test that selects a date, expects `Nenhum lançamento encontrado em`, clicks `Limpar data`, and expects a broad `{ limit: 100 }` request. Add a combined-filter test that selects PC and RPG before the date and expects exact `from`, `to`, `platformIds: [6]`, and `genreIds: [12]`; clicking `Limpar data` preserves the two ID arrays, while clicking `Limpar filtros` returns to `{ limit: 100 }`.

Update the observer-pause test: opening the calendar removes only the observer sentinel, keeps the release list visible, does not start another request, and closing with Lista resumes the same broad session.

- [ ] **Step 2: Run the application integration tests and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx
```

Expected: FAIL because `ReleasesPage` still renders the placeholder and never sends exact dates.

- [ ] **Step 3: Add page state and stable derived copy**

Import `useEffect`, `ReleaseCalendarControl`, `ReleaseDateEmpty`, and calendar formatting utilities. Add state:

```ts
const currentDate = todayInSaoPaulo();
const [calendarOpen, setCalendarOpen] = useState(false);
const [selectedDate, setSelectedDate] = useState<string | null>(null);
const [visibleMonth, setVisibleMonth] = useState(() => calendarMonthStart(currentDate));
const [knownReleaseDates, setKnownReleaseDates] = useState<ReadonlySet<string>>(() => new Set());
```

Pass the exact date into the hook:

```ts
const { loadMore, pagination, retry, retryMore, state } = useReleases({
  ...toReleaseFilterIds(filters),
  ...(selectedDate === null ? {} : { date: selectedDate }),
});
```

When `selectedDate === null && state.status === 'success'`, update known dates in an effect with `new Set(state.response.data.map((item) => item.releaseDate))`. Do not clear the set when an exact query starts.

Derive the subtitle in a pure local helper:

```ts
function releaseSubtitle(selectedDate: string | null, state: ReleasesState): string {
  if (selectedDate === null) return 'Descubra os games que estão chegando';
  const date = formatReleaseDate(selectedDate, false);
  if (state.status === 'success') {
    const count = state.response.data.length;
    return `${String(count)} ${count === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'} em ${date}`;
  }
  if (state.status === 'empty') return `Nenhum lançamento encontrado em ${date}`;
  return 'Descubra os games que estão chegando';
}
```

Import `ReleasesState` as a type from the hook.

- [ ] **Step 4: Compose calendar, clear handlers, and exact result states**

Replace `ReleaseViewSwitcher` in the page header with `ReleaseCalendarControl`. Use these handlers:

```ts
const handleSelectDate = (date: string) => {
  setSelectedDate(date);
  setCalendarOpen(false);
};

const handleClearDate = () => {
  setSelectedDate(null);
  setCalendarOpen(false);
};

const handleClearFilters = () => {
  setFilters(defaultReleaseFilterSelection);
  setSelectedDate(null);
  setCalendarOpen(false);
};
```

Pass `additionalFilterActive={selectedDate !== null}` to `ReleaseFilters`.

Remove the calendar placeholder conditional. Preserve loading and error states. For empty, render `selectedDate === null ? <ReleasesEmpty /> : <ReleaseDateEmpty date={selectedDate} onClearDate={handleClearDate} />`. For success, render `<ReleaseList exactDate={selectedDate !== null} response={state.response} />`; render `ReleaseLoadMore` only when `selectedDate === null`, and pass `enabled={!calendarOpen}` so the observer pauses while the dialog is open.

- [ ] **Step 5: Run focused integration and regression tests and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx src/features/releases
```

Expected: PASS for open-with-list-visible, exact success, exact empty, clear semantics, observer pause/resume, filter combination, retry, and all component/model tests.

- [ ] **Step 6: Run complete automated quality gates**

Run each command separately and require a zero exit code with pristine output:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

If `format:check` fails only on files changed by this plan, run:

```powershell
npx.cmd prettier --write shared/contracts/releases.ts src/features/releases/model/release-calendar.ts src/features/releases/model/release-calendar.test.ts src/features/releases/components/ReleaseDatePicker.tsx src/features/releases/components/ReleaseDatePicker.test.tsx src/features/releases/components/ReleaseCalendarControl.tsx src/features/releases/components/ReleaseCalendarControl.test.tsx src/features/releases/components/ReleaseViewSwitcher.tsx src/features/releases/components/ReleaseViewSwitcher.test.tsx src/features/releases/hooks/use-releases.ts src/features/releases/hooks/use-releases.test.tsx src/features/releases/components/ReleaseDateEmpty.tsx src/features/releases/components/ReleaseDateEmpty.test.tsx src/features/releases/components/ReleaseFilters.tsx src/features/releases/components/ReleaseFilters.test.tsx src/features/releases/components/ReleaseList.tsx src/features/releases/components/ReleaseDateGroup.tsx src/features/releases/components/ReleaseList.test.tsx src/features/releases/components/ReleasesStates.tsx src/features/releases/components/ReleasesStates.test.tsx src/pages/ReleasesPage.tsx src/app/App.test.tsx
```

Then rerun `format:check`, the focused tests, and typecheck.

- [ ] **Step 7: Verify the real UI in the Browser plugin**

Start the project with:

```powershell
npm.cmd run dev
```

Use the Browser plugin first. Verify at `1440 × 1560`:

1. Calendar open against Pen `cO7zp`;
2. exact date success against Pen `d0K2j`;
3. exact date empty against Pen `Gc9Cn`;
4. month navigation, day selection, outside click, Escape, focus return, Lista, Limpar data, Limpar filtros, and retry;
5. no new request while merely opening the calendar;
6. exact request contains `from === to` plus active platform/genre IDs;
7. no exact-date infinite-scroll request;
8. no console errors or warnings.

Verify `390 × 844` and `768 × 1024`: calendar control remains hidden, the current list and filters have no horizontal overflow, and existing mobile navigation is unchanged.

Capture the accepted Pen frames and the latest Browser renders. Inspect both with `view_image`. Write the fidelity ledger in the task commentary with at least these comparison points: header/subtitle copy, switcher geometry, popover geometry and shadow, typography, weekday/day grid, selected/today/indicator states, result heading/cards, empty-state spacing, and responsive visibility. Fix every material mismatch before continuing.

- [ ] **Step 8: Commit the integrated page**

```powershell
git add src/pages/ReleasesPage.tsx src/app/App.test.tsx
git commit -m "feat: add release search by date"
```

---

## Plan Self-Review

- Spec coverage: exact query, platform/genre combination, desktop-only UI, all three Pen states, clear semantics, keyboard behavior, observer behavior, testing, and visual QA are assigned to Tasks 1–6.
- Placeholder scan: every step names concrete files, interfaces, commands, expected failures, and expected passing behavior.
- Type consistency: calendar dates are `YYYY-MM-DD` strings; `month` is always a first-of-month civil date; exact date enters `useReleases` as `ReleasesFilters.date`; presentation receives `selectedDate: string | null`.
- Dependency order: Task 1 model → Task 2 picker → Task 3 control → Task 4 data session → Task 5 result presentation → Task 6 integration.
- Mutation coverage: tests fail for a wrong week start, wrong month boundary, missing exact `to`, accidental horizon creation, lost platform/genre IDs, stale response acceptance, missing clear behavior, hidden background list, missing focus return, and incorrect empty/success copy.
