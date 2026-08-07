# Release Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the selected Pencil release-filters component to the Releases page with exact desktop, tablet, and mobile visual variants and no filtering behavior.

**Architecture:** Create one prop-free `ReleaseFilters` React component containing three breakpoint-specific static variants. Add two theme tokens for the selected-chip colors, then render the component immediately after the existing heading/switcher wrapper while leaving the functional list/calendar switcher unchanged.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, Lucide React, Vitest, React Testing Library, user-event, Vite 8

## Global Constraints

- Use the approved Pencil file `/C:/Projects/ZeraGamez/Design/ZeraGamez` and nodes `drwDo`, `DENQb`, and `nJ5n3` as the visual source of truth.
- Keep the feature presentation-only: no clicks, menus, filtering state, focus behavior, or data changes.
- Do not add the separate mobile search field, release cards, or game data.
- Preserve the existing `ReleaseViewSwitcher` behavior.
- Use Tailwind CSS v4 classes exclusively in the component; do not use inline styles.
- Use the exact labels, order, icons, dimensions, spacing, colors, borders, radii, and responsive visibility from the specification.
- Add no dependencies.
- Keep the unrelated local `package-lock.json` modification untouched and outside every feature commit.
- Use named exports and the existing `@/` import alias.

---

## File Map

- Create `src/features/releases/components/ReleaseFilters.tsx`: static responsive filters component and private chip markup.
- Create `src/features/releases/components/ReleaseFilters.test.tsx`: focused structure, copy, icon, responsive-class, and non-interactivity coverage.
- Modify `src/styles/global.css`: add the two missing selected-chip theme colors.
- Modify `src/pages/ReleasesPage.tsx`: render `ReleaseFilters` after the heading/switcher wrapper.
- Modify `src/app/App.test.tsx`: verify page integration, DOM order, and responsive top spacing.

---

### Task 1: Build the Responsive Static Filters Component

**Files:**

- Create: `src/features/releases/components/ReleaseFilters.test.tsx`
- Create: `src/features/releases/components/ReleaseFilters.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**

- Consumes: existing Tailwind tokens `brand`, `brand-bright`, `bg-secondary`, `surface`, `text-muted`, `content-primary`, and `border-brand`; Lucide exports `CalendarDays`, `ChevronDown`, `Gamepad2`, and `SlidersHorizontal`.
- Produces: named React component `ReleaseFilters(): JSX.Element`; theme utilities `bg-filter-active` and `text-filter-active-text`.

- [ ] **Step 1: Write the failing component test**

Create `src/features/releases/components/ReleaseFilters.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseFilters } from '@/features/releases/components/ReleaseFilters';

describe('ReleaseFilters', () => {
  it('renderiza as três variantes visuais responsivas do Pencil', () => {
    render(<ReleaseFilters />);

    const region = screen.getByRole('region', { name: 'Filtros de lançamentos' });
    const mobile = within(region).getByTestId('release-filters-mobile');
    const tablet = within(region).getByTestId('release-filters-tablet');
    const desktop = within(region).getByTestId('release-filters-desktop');

    expect(mobile).toHaveClass('flex', 'sm:hidden');
    expect(mobile).toHaveTextContent(/^Filtros \(2\)PeríodoPS5$/);
    expect(mobile.querySelectorAll('svg.lucide-sliders-horizontal')).toHaveLength(1);
    expect(mobile.querySelectorAll('svg.lucide-calendar-days')).toHaveLength(1);
    expect(mobile.querySelectorAll('svg.lucide-gamepad-2')).toHaveLength(1);

    expect(tablet).toHaveClass('hidden', 'sm:flex', 'lg:hidden');
    expect(tablet).toHaveTextContent(/^TodasPS5PCGêneroPeríodo$/);
    expect(tablet.querySelector('svg')).not.toBeInTheDocument();

    expect(desktop).toHaveClass('hidden', 'lg:flex');
    expect(desktop).toHaveTextContent(
      /^Todas as plataformasPCPlayStation 5Xbox Series X\|SNintendo SwitchGêneroPeríodoLimpar filtros$/,
    );
    expect(desktop.querySelectorAll('svg.lucide-chevron-down')).toHaveLength(2);

    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
    expect(within(desktop).getByText('Todas as plataformas').parentElement).toHaveClass(
      'border-brand',
      'bg-filter-active',
      'text-filter-active-text',
    );
    expect(within(desktop).getByText('PC').parentElement).toHaveClass(
      'border-border-brand',
      'bg-bg-secondary',
      'text-text-muted',
    );
    expect(within(mobile).getByText('Filtros (2)').parentElement).toHaveClass(
      'border-brand',
      'bg-brand',
      'text-content-primary',
    );

    for (const icon of region.querySelectorAll('svg')) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
```

- [ ] **Step 2: Run the test and verify the RED state**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseFilters.test.tsx
```

Expected: FAIL because `@/features/releases/components/ReleaseFilters` does not exist.

- [ ] **Step 3: Add the selected-chip theme tokens**

In `src/styles/global.css`, add these lines inside the existing `@theme` block after `--color-surface-hover`:

```css
--color-filter-active: #ff304029;
--color-filter-active-text: #ffd6da;
```

Do not change any existing token.

- [ ] **Step 4: Implement the component**

Create `src/features/releases/components/ReleaseFilters.tsx`:

```tsx
import { CalendarDays, ChevronDown, Gamepad2, SlidersHorizontal } from 'lucide-react';

const desktopChipClassName =
  'flex h-[38px] items-center gap-[7px] rounded-[11px] border px-[13px] text-xs';
const compactChipClassName =
  'flex items-center rounded-[10px] border px-[11px] text-[11px] font-semibold';
const mobileChipClassName =
  'flex h-[38px] items-center gap-[7px] rounded-[11px] border px-[11px] text-[11px] font-semibold';

export function ReleaseFilters() {
  return (
    <section aria-label="Filtros de lançamentos" className="mt-[18px] sm:mt-[22px] lg:mt-7">
      <div className="flex items-center gap-2 sm:hidden" data-testid="release-filters-mobile">
        <span className={`${mobileChipClassName} border-brand bg-brand text-content-primary`}>
          <SlidersHorizontal aria-hidden="true" size={15} />
          <span>Filtros (2)</span>
        </span>
        <span className={`${mobileChipClassName} border-border-brand bg-surface text-text-muted`}>
          <CalendarDays aria-hidden="true" size={15} />
          <span>Período</span>
        </span>
        <span className={`${mobileChipClassName} border-border-brand bg-surface text-text-muted`}>
          <Gamepad2 aria-hidden="true" size={15} />
          <span>PS5</span>
        </span>
      </div>

      <div
        className="hidden items-center gap-2 sm:flex lg:hidden"
        data-testid="release-filters-tablet"
      >
        <span
          className={`${compactChipClassName} h-9 border-brand bg-filter-active text-filter-active-text`}
        >
          <span>Todas</span>
        </span>
        {['PS5', 'PC', 'Gênero', 'Período'].map((label) => (
          <span
            className={`${compactChipClassName} h-9 border-border-brand bg-surface text-text-muted`}
            key={label}
          >
            <span>{label}</span>
          </span>
        ))}
      </div>

      <div className="hidden items-center gap-[10px] lg:flex" data-testid="release-filters-desktop">
        <span
          className={`${desktopChipClassName} border-brand bg-filter-active font-semibold text-filter-active-text`}
        >
          <span>Todas as plataformas</span>
        </span>
        {['PC', 'PlayStation 5', 'Xbox Series X|S', 'Nintendo Switch'].map((label) => (
          <span
            className={`${desktopChipClassName} border-border-brand bg-bg-secondary font-medium text-text-muted`}
            key={label}
          >
            <span>{label}</span>
          </span>
        ))}
        <span
          className={`${desktopChipClassName} border-border-brand bg-bg-secondary font-medium text-text-muted`}
        >
          <span>Gênero</span>
          <ChevronDown aria-hidden="true" size={13} />
        </span>
        <span
          className={`${desktopChipClassName} border-border-brand bg-bg-secondary font-medium text-text-muted`}
        >
          <span>Período</span>
          <ChevronDown aria-hidden="true" size={13} />
        </span>
        <span className="text-xs font-semibold text-brand-bright">Limpar filtros</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the focused test and verify the GREEN state**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseFilters.test.tsx
```

Expected: `1` test file passes with `1` passing test.

- [ ] **Step 6: Run focused static checks**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npx.cmd prettier --check src/features/releases/components/ReleaseFilters.tsx src/features/releases/components/ReleaseFilters.test.tsx src/styles/global.css
```

Expected: all three commands exit with code `0`.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add -- src/features/releases/components/ReleaseFilters.tsx src/features/releases/components/ReleaseFilters.test.tsx src/styles/global.css
git commit -m "feat: add responsive release filters"
```

Before committing, confirm `package-lock.json` is not staged with `git status --short`.

---

### Task 2: Integrate Filters into the Releases Page

**Files:**

- Modify: `src/app/App.test.tsx`
- Modify: `src/pages/ReleasesPage.tsx`

**Interfaces:**

- Consumes: named prop-free component `ReleaseFilters` from `@/features/releases/components/ReleaseFilters`.
- Produces: Releases page DOM order `heading/switcher wrapper -> filters region`, with responsive top spacing owned by `ReleaseFilters`.

- [ ] **Step 1: Add the failing page integration assertions**

In the existing Releases navigation test in `src/app/App.test.tsx`, add these assertions after the `ReleaseViewSwitcher` interaction assertions:

```tsx
const headingAndSwitcher = pageHeading.parentElement?.parentElement;
const filters = screen.getByRole('region', { name: 'Filtros de lançamentos' });

expect(
  headingAndSwitcher?.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING,
).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
expect(filters).toHaveClass('mt-[18px]', 'sm:mt-[22px]', 'lg:mt-7');
```

- [ ] **Step 2: Run the integration test and verify the RED state**

Run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx
```

Expected: FAIL because the named `Filtros de lançamentos` region is absent from `/lancamentos`.

- [ ] **Step 3: Render `ReleaseFilters` on the page**

Update `src/pages/ReleasesPage.tsx` to import the component:

```tsx
import { ReleaseFilters } from '@/features/releases/components/ReleaseFilters';
```

Render it immediately after the existing heading/switcher wrapper:

```tsx
      <div className="lg:flex lg:items-end lg:justify-between">
        <PageHeading title="Próximos lançamentos" subtitle="Descubra os games que estão chegando" />
        <ReleaseViewSwitcher onChange={setView} value={view} />
      </div>
      <ReleaseFilters />
```

Do not change the `view` state, the `ReleaseViewSwitcher` props, or the page container classes.

- [ ] **Step 4: Run focused tests and verify the GREEN state**

Run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx src/features/releases/components/ReleaseFilters.test.tsx src/features/releases/components/ReleaseViewSwitcher.test.tsx
```

Expected: all selected test files pass.

- [ ] **Step 5: Run the complete automated verification suite**

Run:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: every command exits with code `0`; Vitest reports all test files and tests passing; Vite produces the production bundle.

- [ ] **Step 6: Commit Task 2**

Run:

```powershell
git add -- src/app/App.test.tsx src/pages/ReleasesPage.tsx
git commit -m "feat: show release filters on releases page"
```

Before committing, confirm `package-lock.json` is not staged with `git status --short`.

---

### Task 3: Verify Responsive Fidelity and the Existing Interaction

**Files:**

- Verify: `src/features/releases/components/ReleaseFilters.tsx`
- Verify: `src/pages/ReleasesPage.tsx`
- Reference: Pencil nodes `drwDo`, `DENQb`, and `nJ5n3`
- Save temporary evidence outside the repository under `C:/Users/alex_/.codex/visualizations/2026/08/06/019fd8d2-cdea-76d0-8cbc-e4189139fce9/release-filters/`

**Interfaces:**

- Consumes: production build and `/lancamentos` route.
- Produces: desktop, tablet, and mobile screenshots; DOM, console, overflow, interaction, and fidelity evidence.

- [ ] **Step 1: Export the three Pencil references outside the repository**

Use Pencil `export_nodes` with:

```json
{
  "filePath": "/C:/Projects/ZeraGamez/Design/ZeraGamez",
  "nodeIds": ["drwDo", "DENQb", "nJ5n3"],
  "outputDir": "C:/Users/alex_/.codex/visualizations/2026/08/06/019fd8d2-cdea-76d0-8cbc-e4189139fce9/release-filters/reference",
  "format": "png",
  "scale": 2
}
```

Expected: three PNG files named after their Pencil node IDs.

- [ ] **Step 2: Start the Vite development server**

Run the server on the exact QA URL:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Expected: Vite serves `http://127.0.0.1:5173/` without startup errors.

- [ ] **Step 3: Open the Browser plugin and define the target flow**

Use the Browser runtime required by the Browser skill. Name the session `Zera GameZ release filters QA`, acquire a tab, and navigate to:

```text
http://127.0.0.1:5173/lancamentos
```

The flow under test is: `/lancamentos` loads -> the breakpoint-appropriate static filters render below the heading -> the existing `Calendário` switch still updates its pressed state.

- [ ] **Step 4: Verify desktop at `1440x900`**

Using Browser APIs:

1. Set the viewport to `1440x900`.
2. Confirm `tab.url()` ends with `/lancamentos` and `tab.title()` is `Zera GameZ`.
3. Confirm `domSnapshot()` contains `Próximos lançamentos`, the full desktop filter copy, and no framework error overlay.
4. Confirm `dev.logs({ levels: ['error', 'warn'], limit: 50 })` has no relevant app entries.
5. Inspect computed layout: desktop row visible; tablet/mobile rows hidden; filter height `38px`; row gap `10px`; selected chip background, text, border, and `11px` radius match the Pencil values.
6. Confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
7. Click `Calendário` and verify its `aria-pressed` becomes `true` while `Lista` becomes `false`.
8. Save `release-filters-desktop-1440.png` in the temporary evidence directory.

- [ ] **Step 5: Verify tablet at `768x1024`**

Using the same tab:

1. Set the viewport to `768x1024` and reload.
2. Confirm only `Todas`, `PS5`, `PC`, `Gênero`, and `Período` are visibly rendered in the filter row.
3. Confirm the tablet row height is `36px`, gap is `8px`, radius is `10px`, dropdown icons are not visible, and `Limpar filtros` is not visible.
4. Confirm no horizontal overflow and no relevant console warnings/errors.
5. Save `release-filters-tablet-768.png` in the temporary evidence directory.

- [ ] **Step 6: Verify mobile at `390x844`**

Using the same tab:

1. Set the viewport to `390x844` and reload.
2. Confirm only `Filtros (2)`, `Período`, and `PS5` are visibly rendered in the filter row.
3. Confirm the corresponding sliders, calendar, and gamepad icons are visible at `15px`.
4. Confirm the chips are `38px` high with `11px` radius and the row gap is `8px`.
5. Confirm no horizontal overflow, clipping, framework overlay, or relevant console warnings/errors.
6. Save `release-filters-mobile-390.png` in the temporary evidence directory.

- [ ] **Step 7: Compare references and renders in one visual pass**

Use `view_image` on the three Pencil reference PNGs and the three implementation screenshots in the same QA pass. Record a fidelity ledger covering at least:

1. exact label copy and order;
2. breakpoint visibility;
3. chip heights, padding, gaps, and radii;
4. selected and inactive palette/borders;
5. icon metaphor, size, color, and alignment;
6. spacing below the page heading;
7. absence of horizontal overflow.

Expected: no material mismatch remains. Fix any material mismatch, rerun its focused test and relevant viewport, then commit only the corrected source/test files with a specific `fix:` message.

- [ ] **Step 8: Run final verification on the exact tree to hand off**

Run:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git status --short --branch
```

Expected: every quality command exits with code `0`; only the pre-existing unstaged `package-lock.json` modification remains outside the feature commits.
