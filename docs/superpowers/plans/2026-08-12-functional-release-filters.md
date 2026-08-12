# Functional Release Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Releases page filter by one platform and one fixed genre through the existing API, while removing the period control from every responsive variant.

**Architecture:** A typed catalog maps stable UI keys to IGDB IDs. `ReleasesPage` owns the controlled selection, `ReleaseFilters` renders accessible responsive controls, and `useReleases` treats the selected IDs as part of a cancellable loading session so initial, split, paginated, and retried requests remain consistent.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, Lucide React, Vitest, React Testing Library, user-event, Vite 8

## Global Constraints

- Allow one selected platform and one selected genre independently.
- Use the existing `/api/releases` `platformIds` and `genreIds` support; do not change the backend contract or IGDB repository.
- Platform options are All, PC `6`, PlayStation 5 `167`, Xbox Series X|S `169`, and Nintendo Switch `130`.
- Genre options are All, Action `4,25`, Adventure `31`, RPG `12`, Strategy `15`, Shooter `5`, and Indie `32`.
- Treat Action as one UI option that maps to the IGDB Fighting and Hack and slash/Beat 'em up IDs.
- Remove the period label, period dropdown, and calendar icon from mobile, tablet, and desktop variants.
- Keep the current chip palette, typography, heights, radii, spacing, and responsive top margin.
- Use native selects for compact platform/genre controls and the desktop genre control.
- Desktop platform chips are buttons with `aria-pressed`; clear filters is a button disabled at the default selection.
- Changing filters must cancel stale requests, clear accumulated pagination state, and show the existing loading state.
- Every split window, later page, and retry must retain the session's platform and genre IDs.
- Do not persist filters in the URL or browser storage and do not add dependencies.
- Use named exports and the existing `@/` import alias.
- Follow TDD: add each failing test, run it and confirm the expected failure, then write only enough production code to pass.

---

## File Map

- Create `src/features/releases/model/release-filter-options.ts`: immutable labels, stable selection keys, IGDB ID mappings, default selection, and conversion to request IDs.
- Create `src/features/releases/model/release-filter-options.test.ts`: catalog and conversion coverage.
- Modify `src/features/releases/components/ReleaseFilters.tsx`: controlled, interactive responsive filters with no period UI.
- Modify `src/features/releases/components/ReleaseFilters.test.tsx`: responsive structure, semantics, callbacks, active state, and clear behavior.
- Modify `src/features/releases/hooks/use-releases.ts`: accept filter IDs and bind them to each cancellable loading session.
- Modify `src/features/releases/hooks/use-releases.test.tsx`: filter propagation, reset, cancellation, stale settlement, split, pagination, and retry coverage.
- Modify `src/pages/ReleasesPage.tsx`: own filter selection and connect component to hook.
- Modify `src/app/App.test.tsx`: end-to-end page interaction and API query assertions.

---

### Task 1: Add the Typed Fixed Filter Catalog

**Files:**

- Create: `src/features/releases/model/release-filter-options.test.ts`
- Create: `src/features/releases/model/release-filter-options.ts`

**Interfaces:**

- Consumes: no feature-local production code.
- Produces: `releasePlatformOptions`, `releaseGenreOptions`, `ReleasePlatformFilterKey`, `ReleaseGenreFilterKey`, `ReleaseFilterSelection`, `defaultReleaseFilterSelection`, and `toReleaseFilterIds(selection)`.

- [ ] **Step 1: Write the failing catalog tests**

Create `src/features/releases/model/release-filter-options.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  defaultReleaseFilterSelection,
  releaseGenreOptions,
  releasePlatformOptions,
  toReleaseFilterIds,
} from './release-filter-options';

describe('release filter options', () => {
  it('exposes the approved fixed platform and genre catalogs', () => {
    expect(releasePlatformOptions).toEqual([
      { key: 'all', label: 'Todas as plataformas', ids: [] },
      { key: 'pc', label: 'PC', ids: [6] },
      { key: 'ps5', label: 'PlayStation 5', ids: [167] },
      { key: 'xbox-series', label: 'Xbox Series X|S', ids: [169] },
      { key: 'switch', label: 'Nintendo Switch', ids: [130] },
    ]);
    expect(releaseGenreOptions).toEqual([
      { key: 'all', label: 'Todos os gêneros', ids: [] },
      { key: 'action', label: 'Ação', ids: [4, 25] },
      { key: 'adventure', label: 'Aventura', ids: [31] },
      { key: 'rpg', label: 'RPG', ids: [12] },
      { key: 'strategy', label: 'Estratégia', ids: [15] },
      { key: 'shooter', label: 'Tiro', ids: [5] },
      { key: 'indie', label: 'Indie', ids: [32] },
    ]);
  });

  it('converts one platform and one genre selection to copied request IDs', () => {
    const ids = toReleaseFilterIds({ platform: 'ps5', genre: 'action' });

    expect(ids).toEqual({ platformIds: [167], genreIds: [4, 25] });
    expect(ids.platformIds).not.toBe(releasePlatformOptions[2].ids);
    expect(ids.genreIds).not.toBe(releaseGenreOptions[1].ids);
    expect(toReleaseFilterIds(defaultReleaseFilterSelection)).toEqual({
      platformIds: [],
      genreIds: [],
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/model/release-filter-options.test.ts
```

Expected: FAIL because `./release-filter-options` does not exist.

- [ ] **Step 3: Implement the immutable catalog and conversion**

Create `src/features/releases/model/release-filter-options.ts`:

```ts
export const releasePlatformOptions = [
  { key: 'all', label: 'Todas as plataformas', ids: [] },
  { key: 'pc', label: 'PC', ids: [6] },
  { key: 'ps5', label: 'PlayStation 5', ids: [167] },
  { key: 'xbox-series', label: 'Xbox Series X|S', ids: [169] },
  { key: 'switch', label: 'Nintendo Switch', ids: [130] },
] as const;

export const releaseGenreOptions = [
  { key: 'all', label: 'Todos os gêneros', ids: [] },
  { key: 'action', label: 'Ação', ids: [4, 25] },
  { key: 'adventure', label: 'Aventura', ids: [31] },
  { key: 'rpg', label: 'RPG', ids: [12] },
  { key: 'strategy', label: 'Estratégia', ids: [15] },
  { key: 'shooter', label: 'Tiro', ids: [5] },
  { key: 'indie', label: 'Indie', ids: [32] },
] as const;

export type ReleasePlatformFilterKey = (typeof releasePlatformOptions)[number]['key'];
export type ReleaseGenreFilterKey = (typeof releaseGenreOptions)[number]['key'];

export interface ReleaseFilterSelection {
  readonly platform: ReleasePlatformFilterKey;
  readonly genre: ReleaseGenreFilterKey;
}

export interface ReleaseFilterIds {
  readonly platformIds: number[];
  readonly genreIds: number[];
}

export const defaultReleaseFilterSelection = {
  platform: 'all',
  genre: 'all',
} as const satisfies ReleaseFilterSelection;

export function toReleaseFilterIds(selection: ReleaseFilterSelection): ReleaseFilterIds {
  const platform = releasePlatformOptions.find(({ key }) => key === selection.platform);
  const genre = releaseGenreOptions.find(({ key }) => key === selection.genre);

  if (!platform || !genre) throw new Error('Invalid release filter selection');

  return { platformIds: [...platform.ids], genreIds: [...genre.ids] };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/model/release-filter-options.test.ts
```

Expected: `1` test file passes with `2` passing tests.

- [ ] **Step 5: Run focused static checks**

Run:

```powershell
npx.cmd prettier --check src/features/releases/model/release-filter-options.ts src/features/releases/model/release-filter-options.test.ts
npm.cmd run typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit the catalog**

```powershell
git add -- src/features/releases/model/release-filter-options.ts src/features/releases/model/release-filter-options.test.ts
git commit -m "feat: define release filter options"
```

---

### Task 2: Turn `ReleaseFilters` into Accessible Controlled Controls

**Files:**

- Modify: `src/features/releases/components/ReleaseFilters.test.tsx`
- Modify: `src/features/releases/components/ReleaseFilters.tsx`

**Interfaces:**

- Consumes: the catalog and selection types from Task 1.
- Produces: `ReleaseFilters(props)` with `value`, `onPlatformChange`, `onGenreChange`, and `onClear` props.

- [ ] **Step 1: Replace the static component test with failing behavior tests**

Replace `src/features/releases/components/ReleaseFilters.test.tsx` with:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReleaseFilters } from '@/features/releases/components/ReleaseFilters';
import {
  defaultReleaseFilterSelection,
  type ReleaseFilterSelection,
} from '@/features/releases/model/release-filter-options';

function setup(
  value: ReleaseFilterSelection = defaultReleaseFilterSelection,
  callbacks = {
    onPlatformChange: vi.fn(),
    onGenreChange: vi.fn(),
    onClear: vi.fn(),
  },
) {
  const view = render(<ReleaseFilters {...callbacks} value={value} />);
  return { ...callbacks, ...view };
}

describe('ReleaseFilters', () => {
  it('renders accessible controls for every breakpoint without period UI', () => {
    setup();

    const region = screen.getByRole('region', { name: 'Filtros de lançamentos' });
    expect(within(region).getByTestId('release-filters-mobile')).toHaveClass('flex', 'sm:hidden');
    expect(within(region).getByTestId('release-filters-tablet')).toHaveClass(
      'hidden',
      'sm:flex',
      'lg:hidden',
    );
    expect(within(region).getByTestId('release-filters-desktop')).toHaveClass('hidden', 'lg:flex');

    expect(screen.getAllByRole('combobox', { name: 'Plataforma' })).toHaveLength(2);
    expect(screen.getAllByRole('combobox', { name: 'Gênero' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'PC' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('button', { name: 'Limpar filtros' })).toHaveLength(3);
    for (const clear of screen.getAllByRole('button', { name: 'Limpar filtros' })) {
      expect(clear).toBeDisabled();
    }

    expect(within(region).queryByText('Período')).not.toBeInTheDocument();
    expect(region.querySelector('svg.lucide-calendar-days')).not.toBeInTheDocument();
  });

  it('emits one platform, one genre, and clear actions with active semantics', async () => {
    const user = userEvent.setup();
    const callbacks = {
      onPlatformChange: vi.fn(),
      onGenreChange: vi.fn(),
      onClear: vi.fn(),
    };
    const { rerender } = setup({ platform: 'ps5', genre: 'rpg' }, callbacks);

    expect(screen.getByRole('button', { name: 'PlayStation 5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'PlayStation 5' })).toHaveClass(
      'border-brand',
      'bg-filter-active',
      'text-filter-active-text',
    );
    for (const genre of screen.getAllByRole('combobox', { name: 'Gênero' })) {
      expect(genre).toHaveValue('rpg');
    }

    await user.click(screen.getByRole('button', { name: 'PC' }));
    expect(callbacks.onPlatformChange).toHaveBeenCalledWith('pc');

    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Plataforma' })[0], 'switch');
    expect(callbacks.onPlatformChange).toHaveBeenLastCalledWith('switch');

    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Gênero' })[0], 'indie');
    expect(callbacks.onGenreChange).toHaveBeenCalledWith('indie');

    await user.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);
    expect(callbacks.onClear).toHaveBeenCalledTimes(1);

    rerender(<ReleaseFilters {...callbacks} value={defaultReleaseFilterSelection} />);
    for (const clear of screen.getAllByRole('button', { name: 'Limpar filtros' })) {
      expect(clear).toBeDisabled();
    }
  });
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseFilters.test.tsx
```

Expected: FAIL because the current prop-free component has no buttons, selects, callbacks, or controlled state and still renders `Período`.

- [ ] **Step 3: Implement the controlled responsive component**

Replace `src/features/releases/components/ReleaseFilters.tsx` with:

```tsx
import { ChevronDown, X } from 'lucide-react';

import {
  releaseGenreOptions,
  releasePlatformOptions,
  type ReleaseFilterSelection,
  type ReleaseGenreFilterKey,
  type ReleasePlatformFilterKey,
} from '@/features/releases/model/release-filter-options';

const desktopChipClassName =
  'flex h-[38px] items-center gap-[7px] rounded-[11px] border px-[13px] text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
const compactChipClassName =
  'relative flex h-9 min-w-0 items-center rounded-[10px] border px-[11px] text-[11px] font-semibold focus-within:ring-2 focus-within:ring-brand';

interface FilterSelectProps<TKey extends string> {
  readonly ariaLabel: string;
  readonly className: string;
  readonly onChange: (value: TKey) => void;
  readonly options: readonly { readonly key: TKey; readonly label: string }[];
  readonly value: TKey;
}

function FilterSelect<TKey extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  value,
}: FilterSelectProps<TKey>) {
  return (
    <span className={className}>
      <select
        aria-label={ariaLabel}
        className="min-w-0 max-w-full appearance-none truncate bg-transparent pr-5 outline-none"
        onChange={(event) => onChange(event.target.value as TKey)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2" size={13} />
    </span>
  );
}

export interface ReleaseFiltersProps {
  readonly value: ReleaseFilterSelection;
  readonly onPlatformChange: (value: ReleasePlatformFilterKey) => void;
  readonly onGenreChange: (value: ReleaseGenreFilterKey) => void;
  readonly onClear: () => void;
}

export function ReleaseFilters({
  value,
  onPlatformChange,
  onGenreChange,
  onClear,
}: ReleaseFiltersProps) {
  const hasActiveFilters = value.platform !== 'all' || value.genre !== 'all';
  const clearClassName =
    'shrink-0 font-semibold text-brand-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <section aria-label="Filtros de lançamentos" className="mt-[18px] sm:mt-[22px] lg:mt-7">
      <div className="flex items-center gap-2 sm:hidden" data-testid="release-filters-mobile">
        <FilterSelect
          ariaLabel="Plataforma"
          className={`${compactChipClassName} max-w-[148px] ${value.platform === 'all' ? 'border-border-brand bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onPlatformChange}
          options={releasePlatformOptions}
          value={value.platform}
        />
        <FilterSelect
          ariaLabel="Gênero"
          className={`${compactChipClassName} max-w-[132px] ${value.genre === 'all' ? 'border-border-brand bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onGenreChange}
          options={releaseGenreOptions}
          value={value.genre}
        />
        <button
          aria-label="Limpar filtros"
          className={`${clearClassName} grid size-9 place-items-center rounded-[10px]`}
          disabled={!hasActiveFilters}
          onClick={onClear}
          type="button"
        >
          <X aria-hidden="true" size={15} />
        </button>
      </div>

      <div
        className="hidden items-center gap-2 sm:flex lg:hidden"
        data-testid="release-filters-tablet"
      >
        <FilterSelect
          ariaLabel="Plataforma"
          className={`${compactChipClassName} max-w-[190px] ${value.platform === 'all' ? 'border-border-brand bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onPlatformChange}
          options={releasePlatformOptions}
          value={value.platform}
        />
        <FilterSelect
          ariaLabel="Gênero"
          className={`${compactChipClassName} max-w-[170px] ${value.genre === 'all' ? 'border-border-brand bg-surface text-text-muted' : 'border-brand bg-filter-active text-filter-active-text'}`}
          onChange={onGenreChange}
          options={releaseGenreOptions}
          value={value.genre}
        />
        <button
          aria-label="Limpar filtros"
          className={`${clearClassName} px-2 text-xs`}
          disabled={!hasActiveFilters}
          onClick={onClear}
          type="button"
        >
          Limpar filtros
        </button>
      </div>

      <div className="hidden items-center gap-[10px] lg:flex" data-testid="release-filters-desktop">
        {releasePlatformOptions.map((option) => {
          const selected = option.key === value.platform;
          return (
            <button
              aria-pressed={selected}
              className={`${desktopChipClassName} ${selected ? 'border-brand bg-filter-active font-semibold text-filter-active-text' : 'border-border-brand bg-bg-secondary font-medium text-text-muted'}`}
              key={option.key}
              onClick={() => onPlatformChange(option.key)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
        <FilterSelect
          ariaLabel="Gênero"
          className={`${desktopChipClassName} relative ${value.genre === 'all' ? 'border-border-brand bg-bg-secondary font-medium text-text-muted' : 'border-brand bg-filter-active font-semibold text-filter-active-text'}`}
          onChange={onGenreChange}
          options={releaseGenreOptions}
          value={value.genre}
        />
        <button
          aria-label="Limpar filtros"
          className={`${clearClassName} text-xs`}
          disabled={!hasActiveFilters}
          onClick={onClear}
          type="button"
        >
          Limpar filtros
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the component test and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseFilters.test.tsx
```

Expected: `1` test file passes with `2` passing tests.

- [ ] **Step 5: Run focused static checks**

Run:

```powershell
npx.cmd prettier --check src/features/releases/components/ReleaseFilters.tsx src/features/releases/components/ReleaseFilters.test.tsx
npm.cmd run lint
npm.cmd run typecheck
```

Expected: all three commands exit `0` with no warnings.

- [ ] **Step 6: Commit the controlled component**

```powershell
git add -- src/features/releases/components/ReleaseFilters.tsx src/features/releases/components/ReleaseFilters.test.tsx
git commit -m "feat: add interactive release filter controls"
```

---

### Task 3: Bind Filters to Cancellable Release Loading Sessions

**Files:**

- Modify: `src/features/releases/hooks/use-releases.test.tsx`
- Modify: `src/features/releases/hooks/use-releases.ts`

**Interfaces:**

- Consumes: `ReleasesClientQuery` and the existing `ReleasesDependencies` loader.
- Produces: `ReleasesFilters` and `useReleases(filters?, dependencies?)`, where filter ID arrays define the request session.

- [ ] **Step 1: Update existing test calls to the new explicit signature**

In `src/features/releases/hooks/use-releases.test.tsx`, update every existing dependency-injected call from:

```tsx
useReleases({ load, logger: log });
useReleases({ load, logger: logger() });
```

to:

```tsx
useReleases({}, { load, logger: log });
useReleases({}, { load, logger: logger() });
```

Do the same for every local logger variable in the file. Do not change assertions in existing tests.

- [ ] **Step 2: Add failing session propagation and reset tests**

Add these tests inside the existing `describe('useReleases', ...)` block:

```tsx
it('keeps platform and genre IDs on initial, incremental, and retry requests', async () => {
  const filters = { platformIds: [167], genreIds: [12] };
  const load = vi
    .fn<ReleasesDependencies['load']>()
    .mockResolvedValueOnce(responseWithOneRelease)
    .mockRejectedValueOnce(new Error('temporary'))
    .mockResolvedValueOnce(nextResponse);
  const { result } = renderHook(() => useReleases(filters, { load, logger: logger() }));

  await waitFor(() => expect(result.current.state.status).toBe('success'));
  expect(load.mock.calls[0]?.[0]).toEqual({
    platformIds: [167],
    genreIds: [12],
    limit: 100,
  });

  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.pagination.status).toBe('error'));
  const filteredWindow = {
    from: '2026-11-10',
    to: '2027-02-08',
    platformIds: [167],
    genreIds: [12],
    limit: 100,
  };
  expect(load.mock.calls[1]?.[0]).toEqual(filteredWindow);

  act(() => result.current.retryMore());
  await waitFor(() => expect(result.current.pagination.status).toBe('idle'));
  expect(load.mock.calls[2]?.[0]).toEqual(filteredWindow);
});

it('keeps filters when a saturated response splits into smaller windows', async () => {
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

  const { result } = renderHook(() =>
    useReleases({ platformIds: [6], genreIds: [31] }, { load, logger: logger() }),
  );

  await waitFor(() => expect(result.current.state.status).toBe('success'));
  expect(load.mock.calls.map(([query]) => query)).toEqual([
    { platformIds: [6], genreIds: [31], limit: 100 },
    {
      from: '2026-08-11',
      to: '2026-08-15',
      platformIds: [6],
      genreIds: [31],
      limit: 100,
    },
  ]);
});

it('aborts the old session and ignores its late result when filters change', async () => {
  const first = deferred<ReleasesResponse>();
  const filteredResponse = page([release(2, '2026-08-15')]);
  const load = vi
    .fn<ReleasesDependencies['load']>()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(filteredResponse);
  const log = logger();
  const { result, rerender } = renderHook(
    ({ platformIds }) => useReleases({ platformIds }, { load, logger: log }),
    { initialProps: { platformIds: [] as number[] } },
  );

  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  const firstSignal = load.mock.calls[0]?.[1];

  rerender({ platformIds: [167] });

  expect(firstSignal?.aborted).toBe(true);
  expect(result.current.state.status).toBe('loading');
  await waitFor(() => expect(result.current.state.status).toBe('success'));
  expect(load.mock.calls[1]?.[0]).toEqual({ platformIds: [167], limit: 100 });
  expect(successData(result.current.state).map(({ id }) => id)).toEqual([2]);

  await act(async () => {
    first.resolve(responseWithOneRelease);
    await first.promise;
  });
  expect(successData(result.current.state).map(({ id }) => id)).toEqual([2]);
  expect(log.error).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the hook test and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/hooks/use-releases.test.tsx
```

Expected: FAIL at TypeScript transform or new query assertions because `useReleases` still accepts dependencies as its first and only argument and does not propagate filter IDs.

- [ ] **Step 4: Add filter types and a stable session key**

In `src/features/releases/hooks/use-releases.ts`, add after `ReleasesDependencies`:

```ts
export interface ReleasesFilters {
  readonly platformIds?: readonly number[];
  readonly genreIds?: readonly number[];
}

function idsFromKey(key: string): number[] {
  return key === '' ? [] : key.split(',').map(Number);
}

function filtersFromKeys(platformIdsKey: string, genreIdsKey: string): ReleasesClientQuery {
  const platformIds = idsFromKey(platformIdsKey);
  const genreIds = idsFromKey(genreIdsKey);
  return {
    ...(platformIds.length > 0 ? { platformIds } : {}),
    ...(genreIds.length > 0 ? { genreIds } : {}),
  };
}
```

Change the hook signature and dependency initialization to:

```ts
export function useReleases(
  filters: ReleasesFilters = {},
  dependencies: ReleasesDependencies = defaultDependencies,
): UseReleasesResult {
  const { load, logger } = dependencies;
  const platformIdsKey = filters.platformIds?.join(',') ?? '';
  const genreIdsKey = filters.genreIds?.join(',') ?? '';
```

Add beside the existing refs:

```ts
const filtersRef = useRef<ReleasesClientQuery>({});
```

- [ ] **Step 5: Merge the session filters into every load call**

In `consumePendingWindow`, replace the incremental loader query with:

```ts
const page = await loadRef.current(
  { ...window, ...filtersRef.current, limit: PAGE_LIMIT },
  controller.signal,
);
```

At the beginning of the session-reset effect, before incrementing `sessionRef`, create and store the immutable session filters:

```ts
const sessionFilters = filtersFromKeys(platformIdsKey, genreIdsKey);
filtersRef.current = sessionFilters;
```

Replace the initial loader query with:

```ts
const page = await load({ ...sessionFilters, limit: PAGE_LIMIT }, controller.signal);
```

Add `platformIdsKey` and `genreIdsKey` to the session-reset effect dependency array:

```ts
}, [attempt, consumePendingWindow, genreIdsKey, load, platformIdsKey]);
```

The existing session counter, cleanup abort, and stale-session checks remain unchanged.

- [ ] **Step 6: Run the hook test and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/hooks/use-releases.test.tsx
```

Expected: the complete hook test file passes, including the three new filter tests and every pre-existing pagination/cancellation test.

- [ ] **Step 7: Run focused regression tests and static checks**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/hooks/use-releases.test.tsx src/features/releases/api/releases-client.test.ts server/releases/application/releases-query.test.ts server/releases/infrastructure/igdb-release-repository.test.ts
npm.cmd run lint
npm.cmd run typecheck
```

Expected: all selected tests and both static checks pass with no warnings.

- [ ] **Step 8: Commit session-aware filtering**

```powershell
git add -- src/features/releases/hooks/use-releases.ts src/features/releases/hooks/use-releases.test.tsx
git commit -m "feat: bind release filters to loading sessions"
```

---

### Task 4: Connect Filters on the Releases Page

**Files:**

- Modify: `src/app/App.test.tsx`
- Modify: `src/pages/ReleasesPage.tsx`

**Interfaces:**

- Consumes: Task 1 selection/catalog conversion, Task 2 controlled component, and Task 3 `useReleases(filters)`.
- Produces: a functional `/lancamentos` filter flow from user control to API query.

- [ ] **Step 1: Add a failing page integration test**

Add this test inside `describe('Zera GameZ', ...)` in `src/app/App.test.tsx`:

```tsx
it('filters releases by one platform and one genre and clears both', async () => {
  const user = userEvent.setup();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  window.history.replaceState({}, '', '/lancamentos');
  render(<AppRouter />);

  expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
  expect(fetchReleasesMock.mock.calls[0]?.[0]).toEqual({ limit: 100 });

  await user.click(screen.getByRole('button', { name: 'PC' }));
  await waitFor(() => {
    expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({
      platformIds: [6],
      limit: 100,
    });
  });

  await user.selectOptions(screen.getAllByRole('combobox', { name: 'Gênero' })[0], 'rpg');
  await waitFor(() => {
    expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({
      platformIds: [6],
      genreIds: [12],
      limit: 100,
    });
  });

  const clearButtons = screen.getAllByRole('button', { name: 'Limpar filtros' });
  expect(clearButtons.every((button) => !button.hasAttribute('disabled'))).toBe(true);
  await user.click(clearButtons[0]);
  await waitFor(() => {
    expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({ limit: 100 });
  });

  expect(screen.getByRole('button', { name: 'Todas as plataformas' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const genre of screen.getAllByRole('combobox', { name: 'Gênero' })) {
    expect(genre).toHaveValue('all');
  }
  expect(screen.queryByText('Período')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the page test and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx
```

Expected: FAIL because `ReleasesPage` still renders the old prop-free `ReleaseFilters` and calls `useReleases()` without selected IDs.

- [ ] **Step 3: Own and connect the filter selection in `ReleasesPage`**

Add these model imports to `src/pages/ReleasesPage.tsx`:

```tsx
import {
  defaultReleaseFilterSelection,
  toReleaseFilterIds,
  type ReleaseFilterSelection,
} from '@/features/releases/model/release-filter-options';
```

Replace the start of `ReleasesPage` with:

```tsx
export function ReleasesPage() {
  const [filters, setFilters] = useState<ReleaseFilterSelection>(defaultReleaseFilterSelection);
  const { loadMore, pagination, retry, retryMore, state } = useReleases(
    toReleaseFilterIds(filters),
  );
  const [view, setView] = useState<ReleaseView>('list');
```

Replace the prop-free filter component with:

```tsx
<ReleaseFilters
  onClear={() => setFilters(defaultReleaseFilterSelection)}
  onGenreChange={(genre) => setFilters((current) => ({ ...current, genre }))}
  onPlatformChange={(platform) => setFilters((current) => ({ ...current, platform }))}
  value={filters}
/>
```

Do not change the existing list/calendar state, results region, state branches, or `ReleaseLoadMore` props.

- [ ] **Step 4: Run focused page and component tests and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx src/features/releases/components/ReleaseFilters.test.tsx src/features/releases/hooks/use-releases.test.tsx
```

Expected: all three files pass; the integration test observes unfiltered, platform-filtered, combined, and cleared API queries.

- [ ] **Step 5: Run the full automated verification suite**

Run each command separately:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: every command exits `0`; Vitest reports all files and tests passing; Vite produces the production bundle.

- [ ] **Step 6: Commit page integration**

```powershell
git add -- src/pages/ReleasesPage.tsx src/app/App.test.tsx
git commit -m "feat: filter releases from page controls"
```

---

### Task 5: Verify Responsive Interaction in the Browser

**Files:**

- Verify: `src/features/releases/components/ReleaseFilters.tsx`
- Verify: `src/pages/ReleasesPage.tsx`
- Save temporary screenshots outside the repository under `C:/Users/alex_/.codex/visualizations/2026/08/12/019ff785-16b8-72b2-a67b-836228e3f580/release-filters/`

**Interfaces:**

- Consumes: the completed functional page and local API environment.
- Produces: responsive, interaction, accessibility, console, and overflow evidence.

- [ ] **Step 1: Read the Browser testing skill before QA**

Read the installed `browser:control-in-app-browser` skill completely and use its prescribed runtime. Do not substitute raw HTTP checks for rendered UI verification.

- [ ] **Step 2: Start the local app with the API route available**

Run:

```powershell
npm.cmd run dev -- --listen 127.0.0.1:3000
```

If the local Vercel CLI rejects `--listen`, run the repository's plain `npm.cmd run dev` command and use the exact URL it prints. Keep the process running in a yielded shell cell rather than starting a visible terminal window.

- [ ] **Step 3: Verify desktop behavior at `1440x900`**

Open `/lancamentos`, set the viewport to `1440x900`, and verify:

1. All five platform buttons, the genre select, and clear button are visible.
2. `Período` and the calendar icon are absent.
3. Selecting PlayStation 5 marks only that platform button pressed and shows the existing loading state before results settle.
4. Selecting RPG retains PlayStation 5 and marks the genre control active.
5. Clearing restores All platforms, All genres, and disables clear.
6. Keyboard Tab reaches every visible control and the focus ring is visible.
7. Console warnings/errors contain no relevant app entry.
8. `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
9. Save `desktop-1440.png` in the temporary evidence directory.

- [ ] **Step 4: Verify tablet behavior at `768x1024`**

Set the viewport to `768x1024`, reload, and verify:

1. Only the tablet platform select, genre select, and clear text button are visible.
2. Every platform and genre option is available from the selects.
3. Selecting Nintendo Switch and Indie updates both displayed values and reloads the list.
4. Clear restores both default values and becomes disabled.
5. The row remains inside the page width with no clipping or horizontal overflow.
6. Save `tablet-768.png` in the temporary evidence directory.

- [ ] **Step 5: Verify mobile behavior at `390x844`**

Set the viewport to `390x844`, reload, and verify:

1. Only the mobile platform select, genre select, and icon-only clear button are visible.
2. The controls retain the approved compact height, radius, gap, palette, and typography.
3. Selecting Xbox Series X|S and Action updates both displayed values without clipping.
4. The clear icon has the accessible name `Limpar filtros`, clears both values, and becomes disabled.
5. The page has no horizontal overflow and the results remain usable below the controls.
6. Save `mobile-390.png` in the temporary evidence directory.

- [ ] **Step 6: Correct any material browser mismatch with TDD**

For each mismatch, add or tighten the nearest focused test first, run it to confirm RED, make the smallest component/page change, rerun to GREEN, and repeat the affected viewport. Commit only verified corrections:

```powershell
git add -- src/features/releases/components/ReleaseFilters.tsx src/features/releases/components/ReleaseFilters.test.tsx src/pages/ReleasesPage.tsx src/app/App.test.tsx
git commit -m "fix: refine responsive release filters"
```

Skip this commit when no source or test correction is needed.

- [ ] **Step 7: Run final verification on the exact handoff tree**

Run each command separately:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git status --short --branch
```

Expected: all quality commands exit `0`; the browser checks pass at all three widths; Git reports no uncommitted implementation changes.
