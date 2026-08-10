# Release List and Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every game returned by `GET /api/releases` as a date-grouped, responsive release list that matches the approved Pen screens and includes loading, empty, error, retry, and calendar-placeholder states.

**Architecture:** Keep `fetchReleases` as the only HTTP boundary, replace the console-only hook with a dependency-injected state hook, and feed pure presentation components from the validated `ReleasesResponse`. Date and platform presentation rules live in a small model module; the page only coordinates view selection and the discriminated async state.

**Tech Stack:** React 19.2.8, React Router 8.3.0, TypeScript 6 strict mode, Tailwind CSS 4.3.3, Lucide React, Vitest 4.1.10, React Testing Library, Vite 8.2.0, Vercel Functions.

## Global Constraints

- Do not add runtime or development dependencies.
- Keep `/api/releases`, its server implementation, and `shared/contracts/releases.ts` unchanged.
- Render all items returned by the default endpoint, up to its configured limit.
- Derive relative dates from `meta.generatedAt` in `America/Sao_Paulo`; interpret civil release dates in UTC.
- Desktop uses four columns, tablet two columns, and mobile compact horizontal cards in one column.
- Favorite, add-to-list, more-options, filters, and search remain visual and non-functional.
- Card actions must be real disabled controls, never empty click handlers.
- Calendar mode renders a clear unavailable state and does not trigger a new request.
- Keep one safe console entry per completed attempt; never log secrets, tokens, raw external bodies, or error messages.
- Follow the Pen frames `FlHYJ`, `LSXHf`, `XXde3`, component `htPgz`, and state grid `a1hYC`.
- Use existing Tailwind tokens and direct imports; do not add barrel files or inline styles.
- Every production behavior starts with a failing test and ends with focused and full verification.

---

## File Map

- Create `src/features/releases/model/release-presentation.ts`: deterministic grouping, date labels, status labels, and platform summaries.
- Create `src/features/releases/model/release-presentation.test.ts`: unit coverage for the presentation model.
- Create `src/features/releases/hooks/use-releases.ts`: async state, safe logging, cancellation, and retry.
- Create `src/features/releases/hooks/use-releases.test.tsx`: hook state-machine and Strict Mode coverage.
- Delete `src/features/releases/hooks/use-releases-console.ts`: superseded console-only hook.
- Delete `src/features/releases/hooks/use-releases-console.test.tsx`: superseded tests.
- Create `src/features/releases/components/ReleaseCard.tsx`: responsive card facade and its desktop/mobile presentations.
- Create `src/features/releases/components/ReleaseCard.test.tsx`: contract-to-card rendering coverage.
- Create `src/features/releases/components/ReleaseDateGroup.tsx`: responsive section heading and item grid.
- Create `src/features/releases/components/ReleaseList.tsx`: immutable grouping and group composition.
- Create `src/features/releases/components/ReleaseList.test.tsx`: grouping, ordering, and completeness coverage.
- Create `src/features/releases/components/ReleasesStates.tsx`: loading, empty, error, and calendar placeholder components.
- Create `src/features/releases/components/ReleasesStates.test.tsx`: semantic state and retry coverage.
- Modify `src/features/releases/components/ReleaseViewSwitcher.tsx`: associate controls with the result region.
- Modify `src/features/releases/components/ReleaseViewSwitcher.test.tsx`: verify `aria-controls` while preserving keyboard behavior.
- Modify `src/pages/ReleasesPage.tsx`: coordinate view mode, hook state, and presentation components.
- Modify `src/app/App.test.tsx`: route-level data, calendar, no-refetch, and shell integration coverage.

---

### Task 1: Deterministic Release Presentation Model

**Files:**

- Create: `src/features/releases/model/release-presentation.ts`
- Test: `src/features/releases/model/release-presentation.test.ts`

**Interfaces:**

- Consumes: `ReleasesResponse['data'][number]`, `releaseDate`, and `meta.generatedAt` from `shared/contracts/releases.ts`.
- Produces:

```ts
export type ReleaseItem = ReleasesResponse['data'][number];

export interface ReleaseGroup {
  readonly releaseDate: string;
  readonly items: readonly ReleaseItem[];
}

export type ReleaseDayKind = 'today' | 'tomorrow' | 'future';

export function groupReleasesByDate(items: readonly ReleaseItem[]): ReleaseGroup[];
export function getReleaseDayKind(releaseDate: string, generatedAt: string): ReleaseDayKind;
export function formatReleaseDate(releaseDate: string, includeYear?: boolean): string;
export function formatReleaseStatus(releaseDate: string, generatedAt: string): string;
export function platformLabel(platform: ReleaseItem['platforms'][number]): string;
export function desktopPlatformLabels(
  platforms: readonly ReleaseItem['platforms'][number][],
): string[];
export function compactPlatformLabel(
  platforms: readonly ReleaseItem['platforms'][number][],
): string;
```

- [ ] **Step 1: Write failing grouping and formatting tests**

Use literal expected values and a typed fixture. The mutation each test catches is named in its title.

```ts
import { describe, expect, it } from 'vitest';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

import {
  compactPlatformLabel,
  desktopPlatformLabels,
  formatReleaseDate,
  formatReleaseStatus,
  getReleaseDayKind,
  groupReleasesByDate,
} from './release-presentation';

type ReleaseItem = ReleasesResponse['data'][number];

function release(id: number, releaseDate: string, name: string): ReleaseItem {
  return {
    id,
    slug: name.toLowerCase().replaceAll(' ', '-'),
    name,
    coverUrl: null,
    releaseDate,
    platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
    genres: [],
  };
}

describe('release presentation', () => {
  it('groups every release by civil date without mutating the input', () => {
    const input = [release(2, '2026-08-11', 'B'), release(1, '2026-08-10', 'A')];
    const snapshot = structuredClone(input);

    expect(groupReleasesByDate(input)).toEqual([
      { releaseDate: '2026-08-10', items: [input[1]] },
      { releaseDate: '2026-08-11', items: [input[0]] },
    ]);
    expect(input).toEqual(snapshot);
  });

  it('derives today and tomorrow from the generated instant in São Paulo', () => {
    const generatedAt = '2026-08-11T01:30:00.000Z';

    expect(getReleaseDayKind('2026-08-10', generatedAt)).toBe('today');
    expect(getReleaseDayKind('2026-08-11', generatedAt)).toBe('tomorrow');
    expect(getReleaseDayKind('2026-08-12', generatedAt)).toBe('future');
  });

  it('formats civil dates without shifting the day', () => {
    expect(formatReleaseDate('2026-08-10')).toBe('10 de agosto de 2026');
    expect(formatReleaseDate('2026-08-10', false)).toBe('10 de agosto');
  });

  it('formats release status by whole civil-day distance', () => {
    const generatedAt = '2026-08-10T12:00:00.000Z';

    expect(formatReleaseStatus('2026-08-10', generatedAt)).toBe('Lança hoje');
    expect(formatReleaseStatus('2026-08-11', generatedAt)).toBe('Em 1 dia');
    expect(formatReleaseStatus('2026-08-13', generatedAt)).toBe('Em 3 dias');
  });

  it('uses abbreviations and summarizes excess platforms', () => {
    const platforms = [
      { id: 1, name: 'PC', abbreviation: 'PC' },
      { id: 2, name: 'PlayStation 5', abbreviation: 'PS5' },
      { id: 3, name: 'Xbox Series X|S', abbreviation: null },
    ];

    expect(desktopPlatformLabels(platforms)).toEqual(['PC', 'PS5', '+1']);
    expect(compactPlatformLabel(platforms)).toBe('PC • PS5 • +1');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm run test:run -- src/features/releases/model/release-presentation.test.ts
```

Expected: FAIL because `./release-presentation` does not exist.

- [ ] **Step 3: Implement the minimal deterministic model**

Use `Intl.DateTimeFormat(...).formatToParts()` for the São Paulo civil date and UTC arithmetic for civil-day differences. Do not parse `YYYY-MM-DD` with a local timezone.

```ts
import type { ReleasesResponse } from '../../../../shared/contracts/releases';

export type ReleaseItem = ReleasesResponse['data'][number];

export interface ReleaseGroup {
  readonly releaseDate: string;
  readonly items: readonly ReleaseItem[];
}

export type ReleaseDayKind = 'today' | 'tomorrow' | 'future';

const sectionFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const cardFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const saoPauloParts = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

function civilDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function generatedCivilDate(value: string) {
  const parts = Object.fromEntries(
    saoPauloParts.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function daysBetween(from: string, to: string) {
  return Math.round((civilDate(to).getTime() - civilDate(from).getTime()) / 86_400_000);
}

export function groupReleasesByDate(items: readonly ReleaseItem[]): ReleaseGroup[] {
  const groups = new Map<string, ReleaseItem[]>();
  for (const item of items) {
    const group = groups.get(item.releaseDate);
    if (group) group.push(item);
    else groups.set(item.releaseDate, [item]);
  }
  return [...groups.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([releaseDate, groupedItems]) => ({ releaseDate, items: groupedItems }));
}
```

Complete the exported formatters with the literal behavior proven by the tests. `desktopPlatformLabels` returns at most two names plus `+N`; `compactPlatformLabel` joins that result with `•`.

- [ ] **Step 4: Run focused tests and the mutation check**

Run the focused test. Then temporarily change `timeZone: 'America/Sao_Paulo'` to `UTC`, confirm the boundary test fails, restore it, and rerun GREEN.

```bash
npm run test:run -- src/features/releases/model/release-presentation.test.ts
```

Expected after restoration: PASS.

- [ ] **Step 5: Commit the presentation model**

```bash
git add src/features/releases/model/release-presentation.ts src/features/releases/model/release-presentation.test.ts
git commit -m "feat: add release presentation model"
```

---

### Task 2: Stateful Releases Hook

**Files:**

- Create: `src/features/releases/hooks/use-releases.ts`
- Test: `src/features/releases/hooks/use-releases.test.tsx`

**Interfaces:**

- Consumes: `fetchReleases({}, { signal })`, `ReleasesResponse`, `ApiErrorCode`, and `ReleasesClientError`.
- Produces:

```ts
export type ReleasesState =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly response: ReleasesResponse }
  | { readonly status: 'empty'; readonly response: ReleasesResponse }
  | {
      readonly status: 'error';
      readonly error: { readonly status: number; readonly code: ApiErrorCode };
    };

export interface UseReleasesResult {
  readonly state: ReleasesState;
  readonly retry: () => void;
}

export interface ReleasesDependencies {
  readonly load: (signal: AbortSignal) => Promise<ReleasesResponse>;
  readonly logger: Pick<Console, 'info' | 'error'>;
}

export function useReleases(dependencies?: ReleasesDependencies): UseReleasesResult;
```

- [ ] **Step 1: Write failing state-machine tests**

Port the existing safe logging and abort assertions, then add state and retry assertions. Keep `load` and `logger` references stable outside the render callback.

```tsx
it('moves from loading to success and logs once in StrictMode', async () => {
  const load = vi.fn().mockResolvedValue(responseWithOneRelease);
  const log = logger();

  const { result } = renderHook(() => useReleases({ load, logger: log }), {
    wrapper: StrictWrapper,
  });

  expect(result.current.state.status).toBe('loading');
  await waitFor(() => expect(result.current.state.status).toBe('success'));
  expect(load).toHaveBeenCalledTimes(1);
  expect(log.info).toHaveBeenCalledWith('[releases] Próximos lançamentos', responseWithOneRelease);
  expect(log.info).toHaveBeenCalledTimes(1);
});

it('exposes empty when the validated response has no items', async () => {
  const load = vi.fn().mockResolvedValue(emptyResponse);
  const log = logger();
  const { result } = renderHook(() => useReleases({ load, logger: log }));

  await waitFor(() => expect(result.current.state.status).toBe('empty'));
});

it('normalizes an error and retries with a new request', async () => {
  const load = vi
    .fn<(signal: AbortSignal) => Promise<ReleasesResponse>>()
    .mockRejectedValueOnce(new ReleasesClientError(503, 'SERVICE_UNAVAILABLE', 'secret'))
    .mockResolvedValueOnce(responseWithOneRelease);
  const log = logger();
  const { result } = renderHook(() => useReleases({ load, logger: log }));

  await waitFor(() => expect(result.current.state.status).toBe('error'));
  act(() => result.current.retry());
  expect(result.current.state.status).toBe('loading');
  await waitFor(() => expect(result.current.state.status).toBe('success'));
  expect(load).toHaveBeenCalledTimes(2);
});
```

Also retain tests for abort on unmount, suppressed late settlement, `AbortError`, and absence of the string `secret` in error logs. Add an explicit retry-while-pending case: wait until the first `load` starts, call `retry`, assert its signal is aborted, resolve the second attempt, then prove a late first settlement cannot replace the second result. Because loading starts in a microtask, wait for the first spy call before reading its signal or unmounting.

- [ ] **Step 2: Run the hook test and verify RED**

```bash
npm run test:run -- src/features/releases/hooks/use-releases.test.tsx
```

Expected: FAIL because `use-releases.ts` does not exist.

- [ ] **Step 3: Implement the hook with cancellation and safe logging**

Use a microtask before invoking `load`; React Strict Mode cleanup cancels the first scheduled setup before network starts, while the replayed setup performs the single request.

```ts
export function useReleases(
  dependencies: ReleasesDependencies = defaultDependencies,
): UseReleasesResult {
  const { load, logger } = dependencies;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReleasesState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      void load(controller.signal)
        .then((response) => {
          if (!active) return;
          logger.info('[releases] Próximos lançamentos', response);
          setState(
            response.data.length === 0
              ? { status: 'empty', response }
              : { status: 'success', response },
          );
        })
        .catch((error: unknown) => {
          if (!active || isAbortError(error)) return;
          const normalized = normalizeError(error);
          logger.error('[releases] Falha ao carregar lançamentos', normalized);
          setState({ status: 'error', error: normalized });
        });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, load, logger]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  return { retry, state };
}
```

Keep `normalizeError` private and return only `{ status, code }`. Do not set loading state synchronously inside the effect: the initial state and `retry` already do that, avoiding redundant effect-driven state work.

- [ ] **Step 4: Run focused hook tests and mutation checks**

After GREEN, temporarily remove `controller.abort()` and confirm the unmount test fails. Restore it, temporarily remove the microtask guard, confirm the Strict Mode call-count test fails, restore it, and rerun:

```bash
npm run test:run -- src/features/releases/hooks/use-releases.test.tsx
```

Expected after restoration: PASS.

- [ ] **Step 5: Commit the hook**

```bash
git add src/features/releases/hooks/use-releases.ts src/features/releases/hooks/use-releases.test.tsx
git commit -m "feat: expose releases loading state"
```

---

### Task 3: Responsive Release Card

**Files:**

- Create: `src/features/releases/components/ReleaseCard.tsx`
- Test: `src/features/releases/components/ReleaseCard.test.tsx`

**Interfaces:**

- Consumes: `ReleaseItem`, `generatedAt`, and Task 1 formatters.
- Produces:

```ts
export interface ReleaseCardProps {
  readonly item: ReleaseItem;
  readonly generatedAt: string;
}

export function ReleaseCard(props: ReleaseCardProps): React.ReactElement;
```

- [ ] **Step 1: Write failing card rendering tests**

Test the real component without mocking icons or formatters.

```tsx
it('renders the contract fields and disabled visual actions in both layouts', () => {
  render(<ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />);

  const desktop = screen.getByTestId('release-card-desktop-42');
  const mobile = screen.getByTestId('release-card-mobile-42');

  expect(within(desktop).getByText('Eclipse Protocol')).toBeInTheDocument();
  expect(within(desktop).getByText('10 de agosto de 2026')).toBeInTheDocument();
  expect(within(desktop).getByText('Lança hoje')).toBeInTheDocument();
  expect(within(desktop).getByText('Ação RPG')).toBeInTheDocument();
  expect(within(mobile).getByText('PC • PS5')).toBeInTheDocument();
  expect(
    within(desktop).getByRole('button', { name: 'Favoritar Eclipse Protocol' }),
  ).toBeDisabled();
  expect(
    within(desktop).getByRole('button', { name: 'Adicionar Eclipse Protocol à lista' }),
  ).toBeDisabled();
  expect(
    within(desktop).getByRole('button', { name: 'Mais opções para Eclipse Protocol' }),
  ).toBeDisabled();
});

it('renders an accessible cover placeholder when coverUrl is null', () => {
  render(
    <ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={{ ...release, coverUrl: null }} />,
  );

  expect(
    screen.getAllByRole('img', { name: 'Capa indisponível de Eclipse Protocol' }),
  ).toHaveLength(2);
});
```

- [ ] **Step 2: Run the card test and verify RED**

```bash
npm run test:run -- src/features/releases/components/ReleaseCard.test.tsx
```

Expected: FAIL because `ReleaseCard` does not exist.

- [ ] **Step 3: Implement desktop and mobile presentations**

Use one facade with two CSS-selected presentations because the Pen hierarchies differ. Both consume the same precomputed values.

```tsx
export function ReleaseCard({ item, generatedAt }: ReleaseCardProps) {
  const presentation = {
    date: formatReleaseDate(item.releaseDate),
    status: formatReleaseStatus(item.releaseDate, generatedAt),
    desktopPlatforms: desktopPlatformLabels(item.platforms),
    compactPlatforms: compactPlatformLabel(item.platforms),
    genre: item.genres.at(0)?.name,
  };

  return (
    <>
      <article
        className="hidden overflow-hidden rounded-2xl border border-border-brand bg-surface p-3 shadow-[0_8px_24px_#00000040] sm:flex sm:flex-col sm:gap-3"
        data-testid={`release-card-desktop-${item.id}`}
      >
        <ReleaseCardDesktop generatedAt={generatedAt} item={item} presentation={presentation} />
      </article>
      <article
        className="grid h-[132px] grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-[14px] border border-border-brand bg-surface p-2.5 sm:hidden"
        data-testid={`release-card-mobile-${item.id}`}
      >
        <ReleaseCardMobile generatedAt={generatedAt} item={item} presentation={presentation} />
      </article>
    </>
  );
}
```

Implementation details:

- Desktop cover: `aspect-square w-full rounded-xl object-cover`, with `loading="lazy"` and `alt={\`Capa de ${item.name}\`}`.
- Mobile cover: `h-full w-[82px] rounded-[10px] object-cover`.
- Placeholder: a `div role="img"` with the exact accessible label, a surface gradient, and decorative `Gamepad2` icon.
- Status badge: dark overlay on desktop; success-tinted chip on mobile.
- Desktop platforms: at most two chips plus `+N`; mobile uses the compact text.
- The first genre is omitted when absent.
- Add button, favorite, and more buttons use `disabled` plus explicit accessible names; preserve opacity with `disabled:opacity-100` and use `disabled:cursor-not-allowed`.
- Use `title={item.name}` on truncated headings so the full value remains available.

- [ ] **Step 4: Run focused tests and inspect the component diff**

```bash
npm run test:run -- src/features/releases/components/ReleaseCard.test.tsx
npm run lint -- src/features/releases/components/ReleaseCard.tsx src/features/releases/components/ReleaseCard.test.tsx
```

Expected: PASS with no lint warnings.

- [ ] **Step 5: Commit the card**

```bash
git add src/features/releases/components/ReleaseCard.tsx src/features/releases/components/ReleaseCard.test.tsx
git commit -m "feat: add responsive release card"
```

---

### Task 4: Date Groups and Complete Release List

**Files:**

- Create: `src/features/releases/components/ReleaseDateGroup.tsx`
- Create: `src/features/releases/components/ReleaseList.tsx`
- Test: `src/features/releases/components/ReleaseList.test.tsx`

**Interfaces:**

- Consumes: `ReleaseGroup`, `ReleaseItem`, `groupReleasesByDate`, `getReleaseDayKind`, `formatReleaseDate`, `ReleaseCard`.
- Produces:

```ts
export interface ReleaseDateGroupProps {
  readonly generatedAt: string;
  readonly group: ReleaseGroup;
}

export interface ReleaseListProps {
  readonly response: ReleasesResponse;
}

export function ReleaseDateGroup(props: ReleaseDateGroupProps): React.ReactElement;
export function ReleaseList(props: ReleaseListProps): React.ReactElement;
```

- [ ] **Step 1: Write a failing list completeness test**

```tsx
it('renders every release once in chronological date groups', () => {
  render(<ReleaseList response={responseWithThreeReleasesAcrossTwoDates} />);

  const groups = screen.getAllByRole('group', { name: /10 de agosto|11 de agosto/i });
  expect(groups).toHaveLength(2);
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getAllByText('Primeiro jogo')).toHaveLength(2);
  expect(screen.getAllByText('Segundo jogo')).toHaveLength(2);
  expect(screen.getAllByText('Terceiro jogo')).toHaveLength(2);
  expect(groups[0]).toHaveTextContent('Hoje');
  expect(groups[1]).toHaveTextContent('Amanhã');
});
```

The duplicated name count is two because desktop and mobile presentations coexist behind responsive CSS. Assert three `listitem` wrappers so each DTO is represented only once as a list item.

- [ ] **Step 2: Run the list test and verify RED**

```bash
npm run test:run -- src/features/releases/components/ReleaseList.test.tsx
```

Expected: FAIL because `ReleaseList` does not exist.

- [ ] **Step 3: Implement group headings and responsive grid**

```tsx
export function ReleaseList({ response }: ReleaseListProps) {
  const groups = groupReleasesByDate(response.data);

  return (
    <div aria-label="Lista de lançamentos" className="mt-7 space-y-7" role="list">
      {groups.map((group) => (
        <ReleaseDateGroup
          generatedAt={response.meta.generatedAt}
          group={group}
          key={group.releaseDate}
        />
      ))}
    </div>
  );
}
```

`ReleaseDateGroup` must:

- create a stable heading ID from `releaseDate`;
- use `<section aria-labelledby={headingId} role="group">`, making each date group an allowed grouped child of the outer ARIA list;
- render the desktop/tablet heading with a red `Hoje` badge only for today, `Amanhã — {date}` for tomorrow, and the date for later groups;
- render a mobile uppercase caption matching the same semantic heading;
- map each item into one `<div role="listitem">` containing `ReleaseCard`;
- use `grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4`;
- add `sm:[content-visibility:auto] sm:[contain-intrinsic-size:407px]` to list items.

- [ ] **Step 4: Run focused tests and mutation check**

Temporarily render `groups.toReversed()` and confirm the assertions that the first group is Hoje and the second is Amanhã fail; restore `groups` and rerun:

```bash
npm run test:run -- src/features/releases/components/ReleaseList.test.tsx src/features/releases/components/ReleaseCard.test.tsx
```

Expected after restoration: PASS.

- [ ] **Step 5: Commit the list**

```bash
git add src/features/releases/components/ReleaseDateGroup.tsx src/features/releases/components/ReleaseList.tsx src/features/releases/components/ReleaseList.test.tsx
git commit -m "feat: group releases into responsive list"
```

---

### Task 5: Loading, Empty, Error, and Calendar States

**Files:**

- Create: `src/features/releases/components/ReleasesStates.tsx`
- Test: `src/features/releases/components/ReleasesStates.test.tsx`

**Interfaces:**

- Produces:

```ts
export function ReleasesLoading(): React.ReactElement;
export function ReleasesEmpty(): React.ReactElement;
export function ReleasesError(props: { readonly onRetry: () => void }): React.ReactElement;
export function ReleaseCalendarPlaceholder(): React.ReactElement;
```

- [ ] **Step 1: Write failing semantic state tests**

```tsx
it('renders an accessible loading state without fake game copy', () => {
  render(<ReleasesLoading />);
  expect(screen.getByRole('status')).toHaveTextContent('Carregando jogos');
  expect(screen.getAllByTestId('release-card-skeleton')).toHaveLength(4);
});

it('renders the approved empty copy', () => {
  render(<ReleasesEmpty />);
  expect(screen.getByRole('status')).toHaveTextContent('Nenhum jogo encontrado');
});

it('invokes retry from the sanitized error state', async () => {
  const user = userEvent.setup();
  const onRetry = vi.fn();
  render(<ReleasesError onRetry={onRetry} />);

  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os jogos');
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it('renders the unavailable calendar state', () => {
  render(<ReleaseCalendarPlaceholder />);
  expect(screen.getByRole('status')).toHaveTextContent('Visualização em breve');
});
```

- [ ] **Step 2: Run the state test and verify RED**

```bash
npm run test:run -- src/features/releases/components/ReleasesStates.test.tsx
```

Expected: FAIL because `ReleasesStates.tsx` does not exist.

- [ ] **Step 3: Implement Pen-aligned states**

Use the existing tokens and Lucide icons:

- Loading: `role="status"`, `aria-live="polite"`, visible “Carregando jogos”, and four responsive skeleton cards with `animate-pulse`.
- Empty: `SearchX`, “Nenhum jogo encontrado”, and “Tente outro termo ou limpe os filtros ativos.”
- Error: `TriangleAlert`, “Não foi possível carregar os jogos”, “Verifique sua conexão e tente novamente.”, and a brand retry button.
- Calendar: `CalendarDays`, “Visualização em breve”, and explanatory copy without a call to action.

Use a shared private `StatePanel` inside the file so icon, title, body, and optional action stay consistent.

- [ ] **Step 4: Run focused tests**

```bash
npm run test:run -- src/features/releases/components/ReleasesStates.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the states**

```bash
git add src/features/releases/components/ReleasesStates.tsx src/features/releases/components/ReleasesStates.test.tsx
git commit -m "feat: add release list states"
```

---

### Task 6: Integrate Data and View Modes into the Releases Page

**Files:**

- Modify: `src/features/releases/components/ReleaseViewSwitcher.tsx`
- Modify: `src/features/releases/components/ReleaseViewSwitcher.test.tsx`
- Modify: `src/pages/ReleasesPage.tsx`
- Modify: `src/app/App.test.tsx`
- Delete: `src/features/releases/hooks/use-releases-console.ts`
- Delete: `src/features/releases/hooks/use-releases-console.test.tsx`

**Interfaces:**

- Consumes: `useReleases`, `ReleaseList`, all state components, and the existing `ReleaseViewSwitcher`/`ReleaseFilters`.
- Produces: `/lancamentos` rendering `#release-results` from the current view and async state.

- [ ] **Step 1: Write failing route-level tests**

Change the App fixture to contain two releases on one date. Extend the releases navigation test:

```tsx
await user.click(screen.getByRole('link', { name: 'Lançamentos' }));

expect(await screen.findByRole('list', { name: 'Lista de lançamentos' })).toBeInTheDocument();
expect(screen.getAllByRole('listitem')).toHaveLength(2);
expect(screen.getAllByText('Eclipse Protocol')).toHaveLength(2);
expect(fetchReleasesMock).toHaveBeenCalledTimes(1);

await user.click(screen.getByRole('button', { name: 'Calendário' }));
expect(screen.getByRole('status')).toHaveTextContent('Visualização em breve');
expect(screen.queryByRole('list', { name: 'Lista de lançamentos' })).not.toBeInTheDocument();

await user.click(screen.getByRole('button', { name: 'Lista' }));
expect(screen.getByRole('list', { name: 'Lista de lançamentos' })).toBeInTheDocument();
expect(fetchReleasesMock).toHaveBeenCalledTimes(1);
```

Add a separate test where `fetchReleasesMock` rejects once and resolves on retry; assert error, click “Tentar novamente”, and observe the list.

Update the switcher test to pass `controlsId="release-results"` and assert both buttons have `aria-controls="release-results"`.

- [ ] **Step 2: Run page and switcher tests and verify RED**

```bash
npm run test:run -- src/app/App.test.tsx src/features/releases/components/ReleaseViewSwitcher.test.tsx
```

Expected: FAIL because the page does not render the new state or result region.

- [ ] **Step 3: Integrate the hook and presentation**

Update the switcher props:

```ts
type ReleaseViewSwitcherProps = Readonly<{
  controlsId: string;
  onChange: (value: ReleaseView) => void;
  value: ReleaseView;
}>;
```

Set `aria-controls={controlsId}` on both mode buttons.

In `ReleasesPage`:

```tsx
const resultsId = 'release-results';

export function ReleasesPage() {
  const { retry, state } = useReleases();
  const [view, setView] = useState<ReleaseView>('list');

  return (
    <main aria-label="Lançamentos" className="...existing page classes...">
      <div className="lg:flex lg:items-end lg:justify-between">
        <PageHeading title="Próximos lançamentos" subtitle="Descubra os games que estão chegando" />
        <ReleaseViewSwitcher controlsId={resultsId} onChange={setView} value={view} />
      </div>
      <ReleaseFilters />
      <section aria-label="Resultados de lançamentos" id={resultsId}>
        {view === 'calendar' ? (
          <ReleaseCalendarPlaceholder />
        ) : state.status === 'loading' ? (
          <ReleasesLoading />
        ) : state.status === 'error' ? (
          <ReleasesError onRetry={retry} />
        ) : state.status === 'empty' ? (
          <ReleasesEmpty />
        ) : (
          <ReleaseList response={state.response} />
        )}
      </section>
    </main>
  );
}
```

Use the page's full existing class string, not the abbreviated comment above. Delete the obsolete console-only hook and test after all imports move to `useReleases`.

- [ ] **Step 4: Run all focused release tests**

```bash
npm run test:run -- src/app/App.test.tsx src/features/releases
```

Expected: PASS with one fetch and one success log per completed attempt.

- [ ] **Step 5: Run typecheck and lint for integration boundaries**

```bash
npm run typecheck
npx tsc -p tsconfig.server.json --noEmit
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit page integration**

```bash
git add src/pages/ReleasesPage.tsx src/app/App.test.tsx src/features/releases/components/ReleaseViewSwitcher.tsx src/features/releases/components/ReleaseViewSwitcher.test.tsx
git add -u src/features/releases/hooks
git commit -m "feat: display upcoming releases"
```

---

### Task 7: Visual Fidelity, Responsive QA, and Final Verification

**Files:**

- Modify only if QA finds a mismatch: release files created or modified in Tasks 1–6.

**Interfaces:**

- Consumes: complete `/lancamentos` flow and live `/api/releases` response.
- Produces: verified desktop, tablet, and mobile rendering with no framework or console errors.

- [ ] **Step 1: Run the complete automated gate**

```bash
npm run test:run
npm run lint
npm run format:check
npm run typecheck
npx tsc -p tsconfig.server.json --noEmit
npm run build
git diff --check
```

Expected: 0 failed tests, 0 lint errors, formatting clean, both typechecks and build exit 0, and no whitespace errors.

- [ ] **Step 2: Start the integrated local environment**

```bash
npm run dev
```

Expected: Vercel reports `Ready` and `/api/releases?limit=1` returns `200 application/json` without printing credentials or the OAuth token.

- [ ] **Step 3: Validate the target flow with the Browser plugin**

The flow under test is: `/lancamentos` loads → real releases render in date groups → Calendário shows the unavailable state → Lista restores the existing cards without a second API request.

Use the Browser skill and persistent Node REPL:

```js
await tab.goto('http://localhost:3000/lancamentos');
await tab.playwright.waitForTimeout(7000);
const dom = await tab.playwright.domSnapshot();
const logs = await tab.dev.logs({ levels: ['error', 'warn'], limit: 50 });
await nodeRepl.emitImage(await tab.screenshot({ fullPage: false }));
```

Verify:

- URL and title identify Zera GameZ releases;
- meaningful headings, date groups, and game cards exist;
- no Vite overlay or blank shell appears;
- no relevant error/warn log exists;
- desktop viewport matches `FlHYJ` with four columns;
- a narrowed tablet browser surface matches `LSXHf` with two columns;
- a narrowed mobile browser surface matches `XXde3` with compact rows and no horizontal overflow;
- clicking Calendário shows “Visualização em breve”;
- clicking Lista restores the same card names;
- the Network panel or injected fetch counter shows no second `/api/releases` request for the view toggle.

- [ ] **Step 4: Keep a mismatch ledger and fix only observed differences**

For each mismatch, record: Pen evidence, rendered evidence, minimal file/class correction, and post-fix screenshot. Any fix must start with a failing component or integration assertion when behavior changes; pure class adjustments require before/after browser evidence.

- [ ] **Step 5: Re-run the full gate after the final edit**

Repeat every command from Step 1 and repeat page identity, DOM, console, screenshot, and interaction checks from Step 3.

- [ ] **Step 6: Commit QA corrections if files changed**

If Step 4 changed tracked files:

```bash
git add src/features/releases src/pages/ReleasesPage.tsx src/app/App.test.tsx
git diff --cached --check
git commit -m "style: align release cards with Pencil"
```

If no tracked file changed, do not create an empty commit. Report the existing Task 1–6 commits and the final verification evidence.

---

## Final Review Checklist

- [ ] Every spec requirement maps to Tasks 1–7.
- [ ] No task changes the server or public contract.
- [ ] No test or fixture contains real credentials.
- [ ] No card action has an empty click handler.
- [ ] All items are represented once as list items and in one date group.
- [ ] Calendar/List toggling does not refetch.
- [ ] Loading, empty, error, retry, and cover fallback are tested.
- [ ] Desktop, tablet, and mobile have screenshot evidence.
- [ ] Full tests, lint, format, typechecks, build, diff check, and live smoke pass.
