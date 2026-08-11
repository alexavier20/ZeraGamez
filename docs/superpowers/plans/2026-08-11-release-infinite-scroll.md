# Release Infinite Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue loading chronological release-date windows near the end of `/lancamentos`, preserving rendered games and exposing accessible incremental loading, retry, fallback, and completion states.

**Architecture:** Keep the public `/api/releases` contract unchanged and paginate with adaptive, non-overlapping civil-date windows. A pure model owns date arithmetic, saturation decisions, and immutable aggregation; `useReleases` owns the sequential request state machine; a focused footer component owns `IntersectionObserver` and progressive fallback; `ReleasesPage` composes those units without moving data logic into the view.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, Testing Library, Vite 8, Tailwind CSS 4, Zod 4, Vercel Functions, IGDB API.

## Global Constraints

- Keep `/api/releases`, `shared/contracts/releases.ts`, Twitch OAuth, and the IGDB repository public behavior unchanged.
- Use the existing client query fields `from`, `to`, and `limit`; do not add a public cursor or offset.
- Use `PAGE_LIMIT = 100`, `WINDOW_SPAN_DAYS = 90`, `HORIZON_DAYS = 730`, and observer `rootMargin = '600px 0px'` exactly.
- Treat every date as a UTC civil date in `YYYY-MM-DD`; derive the initial date from the first response `meta.from`, never from the browser clock.
- Treat `meta.count >= meta.limit` or `meta.sourceTruncated === true` as an incomplete window.
- Never append an incomplete multi-day response; split its window and load the chronological halves.
- Never advance past an incomplete one-day response; expose incremental error and retry the same day.
- Keep no more than one request in flight and suppress late settlements after cancellation or session replacement.
- Preserve loaded cards, scroll position, chronological order, the first complete page's `generatedAt`, and one item per `id + releaseDate`.
- Skip complete empty windows automatically, but stop at the inclusive two-year horizon.
- Pause new automatic loads in Calendar view; returning to List must reuse accumulated data.
- Filters remain visual only; card actions and approved 407/244 desktop/tablet and 132/82 mobile geometry remain unchanged.
- Do not add dependencies, inline styles, secrets, raw IGDB payload logging, or a new barrel file.
- Follow strict TDD: capture RED for each behavior, implement the smallest GREEN, run a representative mutation, restore it, and commit only after focused checks pass.
- On Windows use `npm.cmd`/`npx.cmd`; when running from the main checkout with a managed worktree below `.worktrees`, exclude that worktree or run verification inside the isolated worktree to avoid duplicate React discovery.

---

## File Structure

- Create `src/features/releases/model/release-pagination.ts`: pure civil-window planning, saturation classification, and immutable response aggregation.
- Create `src/features/releases/model/release-pagination.test.ts`: unit contract for every planner/merge edge.
- Modify `src/features/releases/hooks/use-releases.ts`: query-aware dependency injection and sequential adaptive pagination state machine.
- Modify `src/features/releases/hooks/use-releases.test.tsx`: initial/incremental state, split, empty-scan, retry, cancellation, horizon, and single-flight coverage.
- Create `src/features/releases/components/ReleaseLoadMore.tsx`: observer sentinel and accessible incremental footer.
- Create `src/features/releases/components/ReleaseLoadMore.test.tsx`: observer, fallback, state copy, retry, and cleanup coverage.
- Modify `src/pages/ReleasesPage.tsx`: compose the footer only for a successful List view.
- Modify `src/app/App.test.tsx`: route-level append and Lista/Calendário behavior.
- Modify `docs/superpowers/specs/2026-08-11-release-infinite-scroll-design.md`: mark the reviewed spec approved; no behavioral rewrite.

---

### Task 1: Pure release pagination model

**Files:**

- Create: `src/features/releases/model/release-pagination.ts`
- Create: `src/features/releases/model/release-pagination.test.ts`

**Interfaces:**

- Consumes: `ReleasesResponse` and its item type from `shared/contracts/releases.ts`.
- Produces:

```ts
export const PAGE_LIMIT = 100;
export const WINDOW_SPAN_DAYS = 90;
export const HORIZON_DAYS = 730;

export interface ReleaseWindow {
  readonly from: string;
  readonly to: string;
}

export function addCivilDays(value: string, days: number): string;
export function createReleaseHorizon(initialFrom: string): string;
export function nextReleaseWindow(after: string, horizon: string): ReleaseWindow | null;
export function splitReleaseWindow(
  window: ReleaseWindow,
): readonly [ReleaseWindow, ReleaseWindow] | null;
export function isReleaseWindowIncomplete(response: ReleasesResponse): boolean;
export function mergeReleaseResponses(
  current: ReleasesResponse | null,
  next: ReleasesResponse,
): ReleasesResponse;
```

- The interval convention is explicit: `WINDOW_SPAN_DAYS = 90` means `to = from + 90 days`, matching the existing server default and therefore including both endpoint dates.

- [ ] **Step 1: Write failing civil-window tests**

Create `release-pagination.test.ts` with fixed civil dates and assertions that do not depend on the machine timezone:

```ts
import { describe, expect, it } from 'vitest';

import {
  addCivilDays,
  createReleaseHorizon,
  nextReleaseWindow,
  splitReleaseWindow,
} from './release-pagination';

describe('release pagination windows', () => {
  it('uses UTC civil arithmetic across month and leap-year boundaries', () => {
    expect(addCivilDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(addCivilDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('creates consecutive windows capped by the inclusive two-year horizon', () => {
    const horizon = createReleaseHorizon('2026-08-11');

    expect(horizon).toBe('2028-08-10');
    expect(nextReleaseWindow('2026-11-09', horizon)).toEqual({
      from: '2026-11-10',
      to: '2027-02-08',
    });
    expect(nextReleaseWindow('2028-08-10', horizon)).toBeNull();
    expect(nextReleaseWindow('2028-08-09', horizon)).toEqual({
      from: '2028-08-10',
      to: '2028-08-10',
    });
  });

  it('splits odd and even spans without a gap or overlap', () => {
    expect(splitReleaseWindow({ from: '2026-08-01', to: '2026-08-10' })).toEqual([
      { from: '2026-08-01', to: '2026-08-05' },
      { from: '2026-08-06', to: '2026-08-10' },
    ]);
    expect(splitReleaseWindow({ from: '2026-08-01', to: '2026-08-01' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the planner tests and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/model/release-pagination.test.ts
```

Expected: FAIL because `./release-pagination` does not exist.

- [ ] **Step 3: Implement civil-window planning**

Create `release-pagination.ts` with strict parsing through the existing civil-date contract shape and UTC arithmetic:

```ts
import type { ReleasesResponse } from '../../../../shared/contracts/releases';

export const PAGE_LIMIT = 100;
export const WINDOW_SPAN_DAYS = 90;
export const HORIZON_DAYS = 730;

export interface ReleaseWindow {
  readonly from: string;
  readonly to: string;
}

const DAY_MS = 86_400_000;

function civilTimestamp(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

export function addCivilDays(value: string, days: number): string {
  return new Date(civilTimestamp(value) + days * DAY_MS).toISOString().slice(0, 10);
}

export function createReleaseHorizon(initialFrom: string): string {
  return addCivilDays(initialFrom, HORIZON_DAYS);
}

export function nextReleaseWindow(after: string, horizon: string): ReleaseWindow | null {
  const from = addCivilDays(after, 1);
  if (from > horizon) return null;
  const candidateTo = addCivilDays(from, WINDOW_SPAN_DAYS);
  return { from, to: candidateTo < horizon ? candidateTo : horizon };
}

export function splitReleaseWindow(
  window: ReleaseWindow,
): readonly [ReleaseWindow, ReleaseWindow] | null {
  const span = Math.round((civilTimestamp(window.to) - civilTimestamp(window.from)) / DAY_MS);
  if (span <= 0) return null;
  const leftTo = addCivilDays(window.from, Math.floor(span / 2));
  return [
    { from: window.from, to: leftTo },
    { from: addCivilDays(leftTo, 1), to: window.to },
  ];
}
```

- [ ] **Step 4: Run the planner tests and verify GREEN**

Run the focused command from Step 2.

Expected: PASS for all civil-window tests.

- [ ] **Step 5: Add failing saturation and immutable-merge tests**

Add a typed response helper and these behaviors:

```ts
import type { ReleasesResponse } from '../../../../shared/contracts/releases';

function response(
  data: ReleasesResponse['data'],
  overrides: Partial<ReleasesResponse['meta']> = {},
): ReleasesResponse {
  return {
    data,
    meta: {
      from: '2026-08-11',
      to: '2026-11-09',
      count: data.length,
      limit: 100,
      generatedAt: '2026-08-11T12:00:00.000Z',
      sourceTruncated: false,
      ...overrides,
    },
  };
}

function release(
  id: number,
  releaseDate: string,
  name = `Game ${String(id)}`,
): ReleasesResponse['data'][number] {
  return {
    id,
    slug: `game-${String(id)}`,
    name,
    coverUrl: null,
    releaseDate,
    platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
    genres: [],
  };
}

it('classifies public-limit and raw-source truncation as incomplete', () => {
  expect(isReleaseWindowIncomplete(response([], { count: 100 }))).toBe(true);
  expect(isReleaseWindowIncomplete(response([], { sourceTruncated: true }))).toBe(true);
  expect(isReleaseWindowIncomplete(response([], { count: 99 }))).toBe(false);
});

it('merges chronologically without mutating inputs or duplicating game/date keys', () => {
  const first = response([release(2, '2026-08-12'), release(1, '2026-08-11')]);
  const second = response([release(1, '2026-08-11'), release(3, '2026-12-01')], {
    from: '2026-11-10',
    to: '2027-02-08',
    generatedAt: '2026-08-11T13:00:00.000Z',
  });
  const firstSnapshot = structuredClone(first);

  const merged = mergeReleaseResponses(first, second);

  expect(merged.data.map(({ id }) => id)).toEqual([1, 2, 3]);
  expect(merged.meta).toMatchObject({
    from: '2026-08-11',
    to: '2027-02-08',
    count: 3,
    limit: 100,
    generatedAt: '2026-08-11T12:00:00.000Z',
    sourceTruncated: false,
  });
  expect(first).toEqual(firstSnapshot);
});
```

- [ ] **Step 6: Run tests and verify the second RED**

Run the same focused command.

Expected: FAIL because `isReleaseWindowIncomplete` and `mergeReleaseResponses` are not exported.

- [ ] **Step 7: Implement saturation and merge**

Append:

```ts
export function isReleaseWindowIncomplete(response: ReleasesResponse): boolean {
  return response.meta.count >= response.meta.limit || response.meta.sourceTruncated;
}

export function mergeReleaseResponses(
  current: ReleasesResponse | null,
  next: ReleasesResponse,
): ReleasesResponse {
  const generatedAt = current?.meta.generatedAt ?? next.meta.generatedAt;
  const from = current?.meta.from ?? next.meta.from;
  const items = new Map<string, ReleasesResponse['data'][number]>();

  for (const item of [...(current?.data ?? []), ...next.data]) {
    const key = `${String(item.id)}:${item.releaseDate}`;
    if (!items.has(key)) items.set(key, item);
  }

  const data = [...items.values()].sort(
    (left, right) =>
      left.releaseDate.localeCompare(right.releaseDate) ||
      left.name.localeCompare(right.name, 'pt-BR') ||
      left.id - right.id,
  );

  return {
    data,
    meta: {
      from,
      to:
        next.meta.to > (current?.meta.to ?? '') ? next.meta.to : (current?.meta.to ?? next.meta.to),
      count: data.length,
      limit: PAGE_LIMIT,
      generatedAt,
      sourceTruncated: false,
    },
  };
}
```

- [ ] **Step 8: Verify GREEN and mutation strength**

Run the focused test and `npm.cmd run typecheck`.

Then temporarily introduce each representative mutation and confirm a focused failure:

1. change the next start from `addCivilDays(after, 1)` to `after`;
2. append incomplete data in the merge test fixture;
3. key deduplication by `id` only instead of `id + releaseDate`.

Restore production after each failure and rerun the focused suite GREEN.

- [ ] **Step 9: Commit Task 1**

```powershell
git add src/features/releases/model/release-pagination.ts src/features/releases/model/release-pagination.test.ts
git commit -m "feat: plan adaptive release windows"
```

---

### Task 2: Adaptive pagination state machine in `useReleases`

**Files:**

- Modify: `src/features/releases/hooks/use-releases.ts`
- Modify: `src/features/releases/hooks/use-releases.test.tsx`

**Interfaces:**

- Consumes all Task 1 exports plus `ReleasesClientQuery`, `ReleasesClientError`, and `ReleasesResponse`.
- Changes dependency injection to:

```ts
export interface ReleasesDependencies {
  readonly load: (query: ReleasesClientQuery, signal: AbortSignal) => Promise<ReleasesResponse>;
  readonly logger: Pick<Console, 'info' | 'error'>;
}
```

- Produces:

```ts
export type ReleasesPagination =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | {
      readonly status: 'error';
      readonly error: { readonly status: number; readonly code: ApiErrorCode };
    }
  | { readonly status: 'complete' };

export interface UseReleasesResult {
  readonly state: ReleasesState;
  readonly pagination: ReleasesPagination;
  readonly retry: () => void;
  readonly loadMore: () => void;
  readonly retryMore: () => void;
}
```

- `retry`, `loadMore`, and `retryMore` must keep stable function identity for the lifetime of one dependency set.

- [ ] **Step 1: Update existing hook tests for query-aware loading and capture RED**

Change every test double from `(signal) => Promise` to `(query, signal) => Promise`. In the initial-success test, add:

```ts
expect(load).toHaveBeenCalledWith({ limit: 100 }, expect.any(AbortSignal));
expect(result.current.pagination).toEqual({ status: 'idle' });
expect(result.current.loadMore).toBe(initialLoadMore);
expect(result.current.retryMore).toBe(initialRetryMore);
```

Update abort-signal reads from `load.mock.calls[0][0]` to `load.mock.calls[0][1]`.

Run:

```powershell
npm.cmd run test:run -- src/features/releases/hooks/use-releases.test.tsx
```

Expected: FAIL because the hook still calls `load(signal)` and does not expose pagination callbacks/state.

- [ ] **Step 2: Add the public state and default dependency wiring**

Update the default dependency exactly as follows:

```ts
const defaultDependencies: ReleasesDependencies = {
  load: (query, signal) => fetchReleases(query, { signal }),
  logger: console,
};
```

Add pagination state initialized to `{ status: 'idle' }` and stable callback shells guarded by refs. Make the initial effect call `load({ limit: PAGE_LIMIT }, controller.signal)`.

Run the focused hook test until all pre-pagination regression tests pass with the new signature.

- [ ] **Step 3: Write failing append and single-flight tests**

Use a first page from `2026-08-11` through `2026-11-09` and a second page beginning on `2026-11-10`:

```ts
it('appends the next chronological window and ignores concurrent triggers', async () => {
  const second = deferred<ReleasesResponse>();
  const load = vi
    .fn<ReleasesDependencies['load']>()
    .mockResolvedValueOnce(responseWithOneRelease)
    .mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useReleases({ load, logger: logger() }));

  await waitFor(() => expect(result.current.state.status).toBe('success'));

  act(() => {
    result.current.loadMore();
    result.current.loadMore();
    result.current.loadMore();
  });

  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  expect(load.mock.calls[1]?.[0]).toEqual({
    from: '2026-11-10',
    to: '2027-02-08',
    limit: 100,
  });
  expect(result.current.pagination).toEqual({ status: 'loading' });

  await act(async () => {
    second.resolve(nextResponse);
    await second.promise;
  });

  expect(successData(result.current.state).map(({ id }) => id)).toEqual([1, 2]);
  expect(result.current.pagination).toEqual({ status: 'idle' });
});
```

The `successData` test helper must assert/narrow `state.status === 'success'` before returning data. The fixtures must use `meta.limit = 100` and non-overlapping windows.

Run the focused hook test.

Expected: FAIL because `loadMore` does not execute the next window or append.

- [ ] **Step 4: Implement refs and the sequential window runner**

Inside the hook, introduce refs with these exact responsibilities:

```ts
const responseRef = useRef<ReleasesResponse | null>(null);
const horizonRef = useRef<string | null>(null);
const pendingWindowsRef = useRef<ReleaseWindow[]>([]);
const failedWindowRef = useRef<ReleaseWindow | null>(null);
const activeControllerRef = useRef<AbortController | null>(null);
const inFlightRef = useRef(false);
const sessionRef = useRef(0);
```

Implement a stable asynchronous runner following this control flow:

```ts
async function consumePendingWindow(session: number): Promise<void> {
  if (inFlightRef.current) return;
  inFlightRef.current = true;
  setPagination({ status: 'loading' });
  let requestWindow: ReleaseWindow | null = null;

  try {
    while (sessionRef.current === session) {
      const window = pendingWindowsRef.current.shift();
      if (!window) {
        setPagination({ status: 'complete' });
        return;
      }

      requestWindow = window;
      const controller = new AbortController();
      activeControllerRef.current = controller;
      const page = await load({ ...window, limit: PAGE_LIMIT }, controller.signal);
      if (sessionRef.current !== session) return;

      if (isReleaseWindowIncomplete(page)) {
        const halves = splitReleaseWindow(window);
        if (!halves) {
          failedWindowRef.current = window;
          setPagination({ status: 'error', error: { status: 0, code: 'INTERNAL_ERROR' } });
          return;
        }
        pendingWindowsRef.current.unshift(...halves);
        requestWindow = null;
        continue;
      }

      const hadItems = page.data.length > 0;
      if (hadItems) {
        responseRef.current = mergeReleaseResponses(responseRef.current, page);
        setState({ status: 'success', response: responseRef.current });
      }

      if (pendingWindowsRef.current.length === 0) {
        const horizon = horizonRef.current;
        const next = horizon ? nextReleaseWindow(window.to, horizon) : null;
        if (next) pendingWindowsRef.current.push(next);
      }

      if (hadItems) {
        setPagination(
          pendingWindowsRef.current.length > 0 ? { status: 'idle' } : { status: 'complete' },
        );
        return;
      }
      requestWindow = null;
    }
  } catch (error: unknown) {
    if (sessionRef.current !== session || isAbortError(error)) return;
    failedWindowRef.current = requestWindow;
    const normalized = normalizeError(error);
    logger.error('[releases] Falha ao carregar mais lan\u00e7amentos', normalized);
    setPagination({ status: 'error', error: normalized });
  } finally {
    activeControllerRef.current = null;
    inFlightRef.current = false;
  }
}
```

The `requestWindow` assignment is load-bearing: the catch block retains the exact rejected
window rather than consuming a later queued window.

After a complete initial page:

1. set `horizonRef` from `page.meta.from`;
2. append through `mergeReleaseResponses(null, page)`;
3. enqueue `nextReleaseWindow(page.meta.to, horizon)`;
4. expose `idle` or `complete`.

If the initial page is incomplete, enqueue its split halves without appending the parent and immediately run the queue while the main state remains loading. If it is complete but empty, enqueue the next window and continue automatically. Only expose `empty` after the queue reaches the horizon without accumulated data.

- [ ] **Step 5: Run append test and verify GREEN**

Run the focused hook suite.

Expected: existing tests and the append/single-flight test pass.

- [ ] **Step 6: Write failing adaptive split and empty-window tests**

Add:

```ts
it('splits a saturated parent without appending it and loads halves chronologically', async () => {
  const saturated = page([], {
    from: '2026-08-11',
    to: '2026-08-20',
    count: 100,
    limit: 100,
  });
  const left = page([release(1, '2026-08-12')], {
    from: '2026-08-11',
    to: '2026-08-15',
  });
  const load = vi
    .fn<ReleasesDependencies['load']>()
    .mockResolvedValueOnce(saturated)
    .mockResolvedValueOnce(left);

  const { result } = renderHook(() => useReleases({ load, logger: logger() }));

  await waitFor(() => expect(result.current.state.status).toBe('success'));
  expect(load.mock.calls.map(([query]) => query)).toEqual([
    { limit: 100 },
    { from: '2026-08-11', to: '2026-08-15', limit: 100 },
  ]);
  expect(successData(result.current.state)).toEqual(left.data);
});

it('skips empty windows until data is found', async () => {
  const load = vi
    .fn<ReleasesDependencies['load']>()
    .mockResolvedValueOnce(emptyPage)
    .mockResolvedValueOnce(nextEmptyPage)
    .mockResolvedValueOnce(laterPage);

  const { result } = renderHook(() => useReleases({ load, logger: logger() }));

  await waitFor(() => expect(result.current.state.status).toBe('success'));
  expect(load).toHaveBeenCalledTimes(3);
  expect(successData(result.current.state)).toEqual(laterPage.data);
});
```

Run the focused suite.

Expected: FAIL until the initial-response classifier and automatic queue loop are complete.

- [ ] **Step 7: Complete initial classification and horizon behavior**

Implement the initial loader as one session-scoped async path. It must:

- call `{ limit: PAGE_LIMIT }` exactly once;
- derive horizon from the first response even if that response is saturated or empty;
- classify saturation before appending;
- retain chronological right halves in `pendingWindowsRef` when the left half yields data;
- keep `state.status === 'loading'` while skipping initial empty windows;
- set `empty` only after no pending/next window remains and `responseRef.current === null`;
- set `complete` after the horizon when accumulated data exists.

Run the focused suite GREEN.

- [ ] **Step 8: Write failing incremental error, retry, horizon, and one-day saturation tests**

Add four deterministic cases:

1. a rejected second page keeps `state.response` byte-for-byte and sets pagination error;
2. `retryMore` calls the exact failed `{ from, to, limit: 100 }` once and appends its success;
3. an empty final window ending at the horizon produces `complete` without requesting beyond it;
4. a saturated one-day page produces incremental error and does not append/advance.

For the retry assertion:

```ts
const beforeError = successResponse(result.current.state);
act(() => result.current.loadMore());
await waitFor(() => expect(result.current.pagination.status).toBe('error'));
expect(successResponse(result.current.state)).toBe(beforeError);

act(() => result.current.retryMore());
await waitFor(() => expect(result.current.pagination.status).toBe('idle'));
expect(load.mock.calls.at(-1)?.[0]).toEqual(failedQuery);
```

Run the focused suite and verify RED for missing retry/horizon behavior.

- [ ] **Step 9: Implement retry and completion without resetting data**

`retryMore` must unshift only `failedWindowRef.current`, clear the failure, and invoke the same guarded runner. It must be a no-op when there is no failed window or a request is active.

On completion:

- with accumulated response: keep success state and set pagination complete;
- without accumulated response: create `empty` with a valid aggregate response using the first response metadata and `data: []`.

Run the focused hook suite GREEN.

- [ ] **Step 10: Protect cancellation and mutation strength**

Extend the existing unmount/retry tests to assert the active incremental signal is aborted and a late incremental resolve/reject cannot append or log.

Run representative mutations one at a time:

1. remove the `inFlightRef` early return; repeated-trigger test must fail with extra calls;
2. append the saturated parent; split test must fail with parent data present;
3. advance instead of retaining `failedWindowRef`; retry query test must fail;
4. remove the horizon check; completion test must fail with an out-of-range query;
5. remove `controller.abort()` on cleanup; cancellation test must fail.

Restore after each mutation, then run:

```powershell
npm.cmd run test:run -- src/features/releases/model/release-pagination.test.ts src/features/releases/hooks/use-releases.test.tsx
npm.cmd run typecheck
npm.cmd run lint -- src/features/releases/model/release-pagination.ts src/features/releases/model/release-pagination.test.ts src/features/releases/hooks/use-releases.ts src/features/releases/hooks/use-releases.test.tsx
```

Expected: all pass.

- [ ] **Step 11: Commit Task 2**

```powershell
git add src/features/releases/hooks/use-releases.ts src/features/releases/hooks/use-releases.test.tsx
git commit -m "feat: load adaptive release pages"
```

---

### Task 3: Accessible observer footer and fallback

**Files:**

- Create: `src/features/releases/components/ReleaseLoadMore.tsx`
- Create: `src/features/releases/components/ReleaseLoadMore.test.tsx`

**Interfaces:**

- Consumes `ReleasesPagination` from `use-releases.ts`.
- Produces:

```ts
export interface ReleaseLoadMoreProps {
  readonly enabled: boolean;
  readonly pagination: ReleasesPagination;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
}

export function ReleaseLoadMore(props: ReleaseLoadMoreProps): React.ReactElement | null;
```

- [ ] **Step 1: Write the failing observer and cleanup tests**

Create a controlled observer double:

```ts
let observerCallback: IntersectionObserverCallback;
let observerOptions: IntersectionObserverInit | undefined;
let observerInstance: IntersectionObserver;
const observe = vi.fn();
const disconnect = vi.fn();

class IntersectionObserverDouble {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observerCallback = callback;
    observerOptions = options;
    observerInstance = this as unknown as IntersectionObserver;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  readonly root = null;
  readonly rootMargin = '600px 0px';
  readonly thresholds = [0];
}
```

Use `vi.stubGlobal('IntersectionObserver', IntersectionObserverDouble)` in setup and restore globals after each test. Assert:

```ts
it('loads once when the idle sentinel intersects and disconnects on cleanup', () => {
  const onLoadMore = vi.fn();
  const { unmount } = render(
    <ReleaseLoadMore
      enabled
      onLoadMore={onLoadMore}
      onRetry={vi.fn()}
      pagination={{ status: 'idle' }}
    />,
  );

  expect(observe).toHaveBeenCalledTimes(1);
  expect(observerOptions).toMatchObject({ rootMargin: '600px 0px' });
  act(() =>
    observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], observerInstance),
  );
  expect(onLoadMore).toHaveBeenCalledTimes(1);

  unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
});

it('does not observe while disabled or while pagination is not idle', () => {
  const onLoadMore = vi.fn();
  const onRetry = vi.fn();
  const { rerender } = render(
    <ReleaseLoadMore
      enabled={false}
      onLoadMore={onLoadMore}
      onRetry={onRetry}
      pagination={{ status: 'idle' }}
    />,
  );
  expect(observe).not.toHaveBeenCalled();
  rerender(
    <ReleaseLoadMore
      enabled
      onLoadMore={onLoadMore}
      onRetry={onRetry}
      pagination={{ status: 'loading' }}
    />,
  );
  expect(observe).not.toHaveBeenCalled();
});
```

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseLoadMore.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 2: Implement observer-only idle state**

Create the component with a `useRef<HTMLDivElement>` sentinel and an effect keyed by
`enabled`, `pagination.status`, and `onLoadMore`:

```tsx
useEffect(() => {
  if (!enabled || pagination.status !== 'idle' || !sentinelRef.current) return;
  if (typeof IntersectionObserver === 'undefined') return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
    },
    { rootMargin: '600px 0px' },
  );
  observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [enabled, onLoadMore, pagination.status]);
```

For idle-with-observer render an `aria-hidden="true"` sentinel with a small minimum height and no text. Run the focused tests GREEN.

- [ ] **Step 3: Write failing accessible-state and fallback tests**

Add cases asserting exact copy and behavior:

```ts
it('shows polite incremental loading', () => {
  renderFooter({ status: 'loading' });
  expect(screen.getByRole('status')).toHaveTextContent('Carregando mais lançamentos…');
  expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
});

it('preserves an actionable incremental error', async () => {
  const onRetry = vi.fn();
  renderFooter(
    { status: 'error', error: { status: 503, code: 'SERVICE_UNAVAILABLE' } },
    { onRetry },
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar mais jogos');
  await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it('shows completion copy', () => {
  renderFooter({ status: 'complete' });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Todos os lançamentos disponíveis foram carregados',
  );
});

it('falls back to a manual load button without IntersectionObserver', async () => {
  vi.unstubAllGlobals();
  const onLoadMore = vi.fn();
  renderFooter({ status: 'idle' }, { onLoadMore });
  await userEvent.click(screen.getByRole('button', { name: 'Carregar mais lançamentos' }));
  expect(onLoadMore).toHaveBeenCalledTimes(1);
});
```

Run focused tests and verify RED for missing visual states.

- [ ] **Step 4: Implement visual states and fallback**

Use existing tokens and focus patterns; do not reuse the full-page `StatePanel` because the footer must remain compact below loaded cards.

```tsx
if (!enabled) return null;

if (pagination.status === 'loading') {
  return (
    <div
      aria-live="polite"
      className="mt-7 flex items-center justify-center gap-2 text-sm text-text-muted"
      role="status"
    >
      <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
      Carregando mais lançamentos…
    </div>
  );
}

if (pagination.status === 'error') {
  return (
    <div className="mt-7 flex flex-col items-center gap-3 text-center" role="alert">
      <p className="text-sm text-text-muted">Não foi possível carregar mais jogos</p>
      <button
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onClick={onRetry}
        type="button"
      >
        Tentar novamente
      </button>
    </div>
  );
}

if (pagination.status === 'complete') {
  return (
    <p aria-live="polite" className="mt-7 text-center text-sm text-text-muted" role="status">
      Todos os lançamentos disponíveis foram carregados
    </p>
  );
}
```

For idle, render the observer sentinel when supported; otherwise render the manual button with the same focus treatment as retry.

- [ ] **Step 5: Verify rerender/re-observe and mutation strength**

Add a test that rerenders `loading -> idle` and asserts a fresh observer observes again, covering the short-list case.

Run mutations:

1. change `rootMargin` to `0px`; observer-options test must fail;
2. remove `enabled`; Calendar/disabled test must fail;
3. remove `disconnect`; cleanup test must fail;
4. replace the fallback button with a div; accessible fallback test must fail.

Restore and run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseLoadMore.test.tsx
npm.cmd run typecheck
npm.cmd run lint -- src/features/releases/components/ReleaseLoadMore.tsx src/features/releases/components/ReleaseLoadMore.test.tsx
```

Expected: all pass.

- [ ] **Step 6: Commit Task 3**

```powershell
git add src/features/releases/components/ReleaseLoadMore.tsx src/features/releases/components/ReleaseLoadMore.test.tsx
git commit -m "feat: add release scroll sentinel"
```

---

### Task 4: Route integration and List/Calendar behavior

**Files:**

- Modify: `src/pages/ReleasesPage.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**

- Consumes `ReleaseLoadMore` from Task 3 and the expanded `UseReleasesResult` from Task 2.
- Produces the final route behavior: loaded cards plus footer in List view, no footer/observer in Calendar view.

- [ ] **Step 1: Update fixtures to the new public limit**

In `App.test.tsx`, change release response fixtures from `meta.limit: 50` to `meta.limit: 100`. Keep every fixture's `meta.count` equal to its data length unless a test explicitly exercises saturation.

Update the existing successful route assertion:

```ts
expect(fetchReleasesMock).toHaveBeenCalledWith({ limit: 100 }, { signal: expect.any(AbortSignal) });
```

- [ ] **Step 2: Write a failing route-level append test**

Install a minimal `IntersectionObserver` double in this file and retain a callable callback. Add a second response with a date after the first window:

```ts
it('loads and appends the next release window when the sentinel intersects', async () => {
  fetchReleasesMock
    .mockResolvedValueOnce(payload)
    .mockResolvedValueOnce(nextPayload);
  window.history.replaceState({}, '', '/lancamentos');
  render(<AppRouter />);

  expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);

  act(() => intersectReleaseSentinel());

  expect(await screen.findAllByText('Future Game')).toHaveLength(2);
  expect(fetchReleasesMock.mock.calls[1]?.[0]).toEqual({
    from: '2026-11-06',
    to: '2027-02-04',
    limit: 100,
  });
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});
```

Use the fixture's actual `meta.to` when calculating the expected next `from`; the dates above match the existing `2026-11-05` fixture.

Run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx
```

Expected: FAIL because `ReleasesPage` does not render `ReleaseLoadMore`.

- [ ] **Step 3: Integrate the footer in `ReleasesPage`**

Import `ReleaseLoadMore` and expand the hook destructuring:

```tsx
const { loadMore, pagination, retry, retryMore, state } = useReleases();
```

In the successful List branch, render:

```tsx
<>
  <ReleaseList response={state.response} />
  <ReleaseLoadMore
    enabled={view === 'list'}
    onLoadMore={loadMore}
    onRetry={retryMore}
    pagination={pagination}
  />
</>
```

Do not move the footer inside `ReleaseList` or any date `ul`; it must remain outside WAI-ARIA list ownership.

Run the focused App suite GREEN.

- [ ] **Step 4: Write failing Calendar pause/resume and incremental-error tests**

Add an integration test that:

1. waits for the initial list;
2. switches to Calendário;
3. invokes the stored observer callback and confirms call count remains one;
4. switches back to Lista and confirms the same initial cards remain;
5. invokes the newly registered observer and confirms the second request starts.

Add a second test where the next request rejects:

```ts
expect(screen.getAllByText('Eclipse Protocol')).toHaveLength(2);
expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais jogos');
await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual(failedNextQuery);
expect(await screen.findAllByText('Future Game')).toHaveLength(2);
```

Run the App suite and verify RED if observer pause/re-registration or footer retry is not correctly wired.

- [ ] **Step 5: Make the smallest integration corrections**

Keep `useReleases` mounted above the List/Calendar conditional. Render `ReleaseLoadMore` only in the successful List branch, so switching views unmounts and disconnects the observer without resetting the hook.

Do not add an effect to load based on `view`; observer visibility is the only automatic UI trigger after initial loading.

Run the App suite GREEN.

- [ ] **Step 6: Protect the empty-state horizon behavior**

Replace the old single-empty-response App fixture with a query-aware mock that returns a valid empty response for each requested window:

```ts
fetchReleasesMock.mockImplementation(async (query: ReleasesClientQuery = {}) => {
  const from = query.from ?? '2026-08-07';
  const to = query.to ?? '2026-11-05';
  return {
    data: [],
    meta: {
      ...emptyPayload.meta,
      from,
      to,
      count: 0,
      limit: 100,
    },
  };
});
```

Assert the empty state eventually appears, more than one query was made, and the last query does not exceed `2028-08-06` (`2026-08-07 + 730 days`). This prevents the old expectation of exactly one request from hiding the new empty-window traversal.

- [ ] **Step 7: Run integration mutations and focused checks**

Mutate one condition at a time:

1. render the footer in Calendar; pause test must fail;
2. reset the hook on view change; preserved-card/call-count test must fail;
3. place the footer inside `ReleaseList`; the structural assertion that it is outside all named lists must fail;
4. replace retryMore with retry; accumulated-card test must fail.

Restore, then run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx src/features/releases/components/ReleaseLoadMore.test.tsx src/features/releases/hooks/use-releases.test.tsx src/features/releases/model/release-pagination.test.ts
npm.cmd run typecheck
npm.cmd run lint -- src/pages/ReleasesPage.tsx src/app/App.test.tsx
```

Expected: all pass.

- [ ] **Step 8: Commit Task 4**

```powershell
git add src/pages/ReleasesPage.tsx src/app/App.test.tsx
git commit -m "feat: continue loading release dates"
```

---

### Task 5: Full verification and responsive Browser QA

**Files:**

- Verify: all files changed by Tasks 1–4
- Update only if evidence requires it: focused tests or the approved spec/plan; do not broaden production scope.

**Interfaces:**

- Consumes the complete feature.
- Produces a clean, reviewed branch ready for the finishing-a-development-branch workflow.

- [ ] **Step 1: Run the complete automated gate**

From the isolated feature worktree run sequentially:

```powershell
npm.cmd run test:run
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npx.cmd tsc -p tsconfig.server.json --noEmit
npm.cmd run build
git diff --check
git status --short
```

Expected:

- all test files and tests pass;
- lint and Prettier exit 0;
- client/server typechecks exit 0;
- production build exits 0;
- no whitespace errors;
- no unintended tracked changes.

- [ ] **Step 2: Self-review the complete feature diff**

Capture and inspect the exact feature range:

```powershell
$featureBase = git merge-base main HEAD
git diff "$featureBase...HEAD"
```

Verify:

- no endpoint, contract, OAuth, dependency, secret, filter, calendar, or card-layout drift;
- no incomplete parent response is appended;
- a failed window is retained exactly;
- only one request can run;
- all loop exits are bounded by response, error, one-day saturation, or horizon;
- `ReleaseLoadMore` remains outside date lists;
- all callbacks and observer cleanup are stable;
- logs contain only normalized public metadata.

- [ ] **Step 3: Start the integrated local environment**

Use the existing `.env.local` by path only; never print its contents. Start Vercel on a verified free port, record its PID/tree, and smoke-check:

```text
GET /lancamentos -> 200 text/html
GET /api/releases?limit=1 -> 200 application/json
```

Do not stop pre-existing listeners. Stop only the process tree started for this task after QA.

- [ ] **Step 4: Run Browser QA with the Browser plugin**

Follow `browser:control-in-app-browser` and `build-web-apps:frontend-testing-debugging`; do not substitute an external browser when the integrated Browser is available.

At 1440x1000, 1024x900, 768x1024, and 390x844 verify:

- approved 4/4/2/1-column responsive layout and 407/244 or 132/82 card geometry;
- no horizontal overflow, clipping, framework overlay, console warning, or console error;
- scrolling within 600px of the sentinel exposes `Carregando mais lançamentos…`;
- a later date group/card is appended without removing the prior first/last cards;
- the scroll position does not jump to the top;
- only one request runs for one intersection burst;
- Calendar pauses further automatic loads;
- returning to List preserves accumulated cards and re-enables the sentinel;
- completion or inline retry appears according to controlled/available API state.

If real API data cannot deterministically produce error or completion, treat the automated integration tests as the required evidence for those two states and record the Browser limitation; do not modify production or use an external fallback.

- [ ] **Step 5: Re-run gates after any QA-driven correction**

Any correction must use a new RED/GREEN cycle and a focused mutation. Then repeat Step 1 in full.

- [ ] **Step 6: Request code review and finish the branch**

Use `superpowers:requesting-code-review` against the exact feature base/head. Resolve Critical and Important findings through the prescribed review flow, run `superpowers:verification-before-completion`, then use `superpowers:finishing-a-development-branch` to present the integration options.

Do not merge or push without the user's finishing choice.
