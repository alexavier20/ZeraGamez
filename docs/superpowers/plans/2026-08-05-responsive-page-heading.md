# Responsive Page Heading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, responsive `PageHeading` component from the selected Pencil title-and-subtitle block and render it on `/lancamentos`.

**Architecture:** Keep typography and title/subtitle spacing inside a focused shared component with required string properties. Keep viewport padding and the page landmark inside `ReleasesPage`, then verify the reusable component independently before adding route-level integration and responsive visual QA.

**Tech Stack:** React 19, TypeScript 6 strict mode, Tailwind CSS 4, React Router 8, Vitest, Testing Library, user-event, Pencil design source, in-app Browser.

## Global Constraints

- Use the exact copy `Próximos lançamentos` and `Descubra os games que estão chegando` on `/lancamentos`.
- Expose `PageHeading` through required `title: string` and `subtitle: string` properties; do not add variants, optional properties, a `className` escape hatch, or a barrel file.
- Use one semantic `h1` followed by one visible supporting `p`.
- Use Oxanium 700 for the title and Chakra Petch 400 for the subtitle.
- Use Pencil `$text` (`#F5F3FF`) for the title and the existing `$muted` match (`#A8A3B3`) for the subtitle.
- Use mobile/tablet/desktop title sizes of 27/30/38 px, subtitle sizes of 13/14/16 px, and title-subtitle gaps of 18/22/8 px.
- Normalize the Pencil mobile title weight of 720 to the loaded Oxanium 700 face.
- Use mobile/tablet/desktop page top padding of 22/28/36 px and horizontal padding of 16/20/32 px.
- Keep the content width fluid up to 1440 px and allow text to wrap naturally.
- Preserve the named Releases `main`, Header routing, active navigation, fixed mobile bottom navigation, wildcard redirect, and Header → main → mobile-navigation DOM order.
- Do not add filters, cards, view controls, search, fetching, state, or release data.
- Use direct imports through the existing `@/` alias and `npm.cmd` in PowerShell.

---

## File Map

### Create

- `src/shared/components/page-heading/PageHeading.tsx` — reusable semantic title/subtitle block and responsive typography.
- `src/shared/components/page-heading/PageHeading.test.tsx` — component contract, reuse, and responsive-style coverage.

### Modify

- `src/styles/global.css` — semantic Tailwind color token for Pencil `$text`.
- `src/pages/ReleasesPage.tsx` — responsive page container and configured `PageHeading` instance.
- `src/app/App.test.tsx` — Releases navigation, content, layout, active state, and shell integration coverage.

---

### Task 1: Add the reusable responsive PageHeading

**Files:**

- Create: `src/shared/components/page-heading/PageHeading.tsx`
- Create: `src/shared/components/page-heading/PageHeading.test.tsx`
- Modify: `src/styles/global.css`
- Test: `src/shared/components/page-heading/PageHeading.test.tsx`

**Interfaces:**

- Produces: `PageHeading({ title, subtitle }: Readonly<{ title: string; subtitle: string }>): JSX.Element`.
- Produces: Tailwind color utility `text-content-primary` backed by `--color-content-primary: #f5f3ff`.
- Consumes: the existing `font-heading` and `text-text-muted` Tailwind utilities and the body-level Chakra Petch font.
- Preserves: content-sized width, natural wrapping, left alignment, and no page-specific copy in the shared component.

- [ ] **Step 1: Write the failing component contract test**

Create `src/shared/components/page-heading/PageHeading.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeading } from '@/shared/components/page-heading/PageHeading';

describe('PageHeading', () => {
  it('renderiza título e apoio recebidos com semântica e estilos responsivos', () => {
    render(<PageHeading title="Título reutilizável" subtitle="Texto de apoio" />);

    const title = screen.getByRole('heading', { level: 1, name: 'Título reutilizável' });
    const subtitle = screen.getByText('Texto de apoio');
    const container = title.closest('header');

    expect(container).toHaveClass('flex', 'flex-col', 'gap-[18px]', 'sm:gap-[22px]', 'lg:gap-2');
    expect(title).toHaveClass(
      'font-heading',
      'text-[27px]',
      'leading-[34px]',
      'font-bold',
      'text-content-primary',
      'sm:text-[30px]',
      'sm:leading-[38px]',
      'lg:text-[38px]',
      'lg:leading-[48px]',
    );
    expect(subtitle.tagName).toBe('P');
    expect(subtitle).toHaveClass(
      'text-[13px]',
      'leading-[17px]',
      'text-text-muted',
      'sm:text-sm',
      'sm:leading-[18px]',
      'lg:text-base',
      'lg:leading-[21px]',
    );
    expect(screen.queryByText('Próximos lançamentos')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```powershell
npm.cmd run test:run -- src/shared/components/page-heading/PageHeading.test.tsx
```

Expected: FAIL because `@/shared/components/page-heading/PageHeading` does not exist.

- [ ] **Step 3: Add the Pencil title color to the Tailwind theme**

Add the following token inside the existing `@theme` block in `src/styles/global.css`, immediately after `--color-text-primary`:

```css
--color-content-primary: #f5f3ff;
```

- [ ] **Step 4: Implement the minimal reusable component**

Create `src/shared/components/page-heading/PageHeading.tsx`:

```tsx
type PageHeadingProps = Readonly<{
  title: string;
  subtitle: string;
}>;

export function PageHeading({ title, subtitle }: PageHeadingProps) {
  return (
    <header className="flex flex-col gap-[18px] sm:gap-[22px] lg:gap-2">
      <h1 className="font-heading text-[27px] leading-[34px] font-bold text-content-primary sm:text-[30px] sm:leading-[38px] lg:text-[38px] lg:leading-[48px]">
        {title}
      </h1>
      <p className="text-[13px] leading-[17px] text-text-muted sm:text-sm sm:leading-[18px] lg:text-base lg:leading-[21px]">
        {subtitle}
      </p>
    </header>
  );
}
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```powershell
npm.cmd run test:run -- src/shared/components/page-heading/PageHeading.test.tsx
```

Expected: the single `PageHeading` test PASS.

- [ ] **Step 6: Format and run focused static checks**

Run:

```powershell
npm.cmd exec prettier -- --write src/shared/components/page-heading/PageHeading.tsx src/shared/components/page-heading/PageHeading.test.tsx src/styles/global.css
npm.cmd exec eslint -- src/shared/components/page-heading/PageHeading.tsx src/shared/components/page-heading/PageHeading.test.tsx
npm.cmd run typecheck
```

Expected: Prettier completes, ESLint exits with code 0, and TypeScript exits with code 0.

- [ ] **Step 7: Commit the shared component**

```powershell
git add src/shared/components/page-heading/PageHeading.tsx src/shared/components/page-heading/PageHeading.test.tsx src/styles/global.css
git commit -m "feat: add responsive page heading"
```

---

### Task 2: Render PageHeading on Releases and verify responsive integration

**Files:**

- Modify: `src/pages/ReleasesPage.tsx`
- Modify: `src/app/App.test.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**

- Consumes: `PageHeading({ title: string, subtitle: string })` from Task 1.
- Produces: `ReleasesPage(): JSX.Element` with the named `main`, responsive Pencil padding, and exact Portuguese title/subtitle copy.
- Preserves: `/lancamentos`, Header and mobile active state, wildcard routing, shell DOM order, and mobile bottom clearance.

- [ ] **Step 1: Replace the empty-page assertion with a failing content and layout contract**

In `src/app/App.test.tsx`, replace the current Releases test with:

```tsx
it('abre Lançamentos com o título responsivo selecionado no Pencil', async () => {
  const user = userEvent.setup();
  render(<AppRouter />);

  const releasesLink = screen.getByRole('link', { name: 'Lançamentos' });
  await user.click(releasesLink);

  const main = screen.getByRole('main', { name: 'Lançamentos' });

  expect(window.location.pathname).toBe('/lancamentos');
  expect(
    screen.getByRole('heading', { level: 1, name: 'Próximos lançamentos' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Descubra os games que estão chegando')).toBeInTheDocument();
  expect(main).toHaveClass(
    'mx-auto',
    'max-w-[1440px]',
    'px-4',
    'pt-[22px]',
    'sm:px-5',
    'sm:pt-7',
    'lg:px-8',
    'lg:pt-9',
  );
  expect(releasesLink).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeInTheDocument();
  expect(screen.queryByText('Em construção')).not.toBeInTheDocument();
  expectShellOrder();
});
```

- [ ] **Step 2: Run the integration test and verify the missing-content failure**

Run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx
```

Expected: the Releases test FAILS because the page does not render `Próximos lançamentos`; the Home and wildcard tests PASS.

- [ ] **Step 3: Configure PageHeading inside the responsive Releases container**

Replace `src/pages/ReleasesPage.tsx` with:

```tsx
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

export function ReleasesPage() {
  return (
    <main
      aria-label="Lançamentos"
      className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pt-[22px] pb-28 sm:px-5 sm:pt-7 sm:pb-12 lg:px-8 lg:pt-9"
    >
      <PageHeading title="Próximos lançamentos" subtitle="Descubra os games que estão chegando" />
    </main>
  );
}
```

- [ ] **Step 4: Format and verify the focused integration**

Run:

```powershell
npm.cmd exec prettier -- --write src/pages/ReleasesPage.tsx src/app/App.test.tsx
npm.cmd run test:run -- src/app/App.test.tsx src/shared/components/page-heading/PageHeading.test.tsx
```

Expected: all Home, Releases, PageHeading, active-navigation, shell-order, and wildcard tests PASS.

- [ ] **Step 5: Run the complete automated quality gate**

Run in order:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: every command exits with code 0; Vitest reports all application and Header tests passing; Vite emits the production bundle into ignored `dist/`.

- [ ] **Step 6: Verify the three Pencil breakpoints in the in-app Browser**

Start the local application:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/lancamentos` with the in-app Browser and inspect these viewports:

- 390 × 844: title 27 px, subtitle 13 px, 18 px gap, 16 px horizontal inset, 22 px top inset, no horizontal overflow, mobile bottom navigation visible;
- 768 × 1024: title 30 px, subtitle 14 px, 22 px gap, 20 px horizontal inset, 28 px top inset, tablet Header visible;
- 1440 × 1000: title 38 px, subtitle 16 px, 8 px gap, 32 px horizontal inset, 36 px top inset, desktop Header visible.

Expected: the title and subtitle match the selected Pencil block and its responsive Releases canvases; text is left-aligned, uncropped, and naturally wrapping; the browser console has no errors.

- [ ] **Step 7: Commit the Releases integration**

```powershell
git add src/pages/ReleasesPage.tsx src/app/App.test.tsx
git commit -m "feat: show page heading on releases"
```
