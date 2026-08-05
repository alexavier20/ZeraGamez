# Empty Releases Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visually empty `/lancamentos` page that opens from the existing Header navigation while preserving the shared Header and mobile bottom navigation.

**Architecture:** Extract the application chrome into a route layout that renders `Header`, React Router's `Outlet`, and `MobileBottomNav` once. Keep Home and Releases as focused page components that own only their semantic `<main>` regions, then nest both routes under the shared layout.

**Tech Stack:** React 19, React Router 8, TypeScript 6 strict mode, Tailwind CSS 4, Vitest, Testing Library, user-event.

## Global Constraints

- Keep the Header and fixed mobile bottom navigation visible on Home and Releases.
- Use the exact route `/lancamentos`; the desktop `Lançamentos` and mobile `Explorar` links must resolve to it.
- Keep the Releases main-content region visually empty: no cards, loading state, fetching, filters, placeholder copy, hidden heading, or global state.
- Expose the empty content as `<main aria-label="Lançamentos">`.
- Preserve DOM focus order: Header, page main, mobile bottom navigation.
- Preserve the wildcard redirect to `/`.
- Reuse `headerRoutes.releases`; do not duplicate the route string.
- Use direct imports through the existing `@/` alias; do not add barrel files.
- Use `npm.cmd` in PowerShell.

---

## File Map

### Create

- `src/app/AppLayout.tsx` — shared route shell and static Header user.
- `src/app/AppLayout.test.tsx` — shared shell composition and DOM-order contract.
- `src/pages/HomePage.tsx` — current Home main content.
- `src/pages/ReleasesPage.tsx` — named, visually empty Releases main content.

### Modify

- `src/app/router.tsx` — nested layout, Home index, and Releases route.
- `src/app/App.test.tsx` — Home, Releases navigation, active state, emptiness, and fallback integration coverage.

### Delete

- `src/app/App.tsx` — responsibilities move to `AppLayout` and `HomePage`.

---

### Task 1: Extract the shared route layout and Home page

**Files:**

- Create: `src/app/AppLayout.tsx`
- Create: `src/app/AppLayout.test.tsx`
- Create: `src/pages/HomePage.tsx`
- Modify: `src/app/router.tsx`
- Delete: `src/app/App.tsx`
- Test: `src/app/AppLayout.test.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**

- Produces: `AppLayout(): JSX.Element`, a pathless route layout containing `Header`, `Outlet`, and `MobileBottomNav` in that DOM order.
- Produces: `HomePage(): JSX.Element`, containing the existing Home `<main>` and visible construction copy.
- Consumes: `Header`, `MobileBottomNav`, `HeaderUser`, and React Router's `Outlet`.
- Preserves: `/` and wildcard redirect behavior in `AppRouter()`.

- [ ] **Step 1: Write the failing shared-layout test**

Create `src/app/AppLayout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '@/app/AppLayout';

describe('AppLayout', () => {
  it('mantém header, conteúdo e navegação móvel na ordem do foco', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<main aria-label="Conteúdo da página" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    const main = screen.getByRole('main', { name: 'Conteúdo da página' });
    const mobileNavigation = screen.getByRole('navigation', { name: 'Navegação móvel' });

    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(main.compareDocumentPosition(mobileNavigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```powershell
npm.cmd run test:run -- src/app/AppLayout.test.tsx
```

Expected: FAIL because `@/app/AppLayout` does not exist.

- [ ] **Step 3: Implement the shared layout**

Create `src/app/AppLayout.tsx`:

```tsx
import { Outlet } from 'react-router';

import { Header } from '@/shared/components/header/Header';
import { MobileBottomNav } from '@/shared/components/header/MobileBottomNav';

import type { HeaderUser } from '@/shared/components/header/header.types';

const appUser = {
  name: 'Alex',
  initials: 'AB',
} as const satisfies HeaderUser;

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-app text-text-primary">
      <Header user={appUser} />
      <Outlet />
      <MobileBottomNav />
    </div>
  );
}
```

- [ ] **Step 4: Extract the Home page**

Create `src/pages/HomePage.tsx`:

```tsx
export function HomePage() {
  return (
    <main className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center px-6 py-12 pb-28 text-center sm:pb-12">
      <div>
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">Zera GameZ</h1>
        <div className="mx-auto my-5 h-1 w-12 rounded-full bg-brand" aria-hidden="true" />
        <p className="text-base text-text-muted sm:text-lg">Em construção</p>
      </div>
    </main>
  );
}
```

Delete `src/app/App.tsx` after moving all of its responsibilities into `AppLayout` and `HomePage`.

- [ ] **Step 5: Point the Home route at the new layout and page**

Replace `src/app/router.tsx` with:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import { HomePage } from '@/pages/HomePage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Format and run the focused regression checks**

Run:

```powershell
npm.cmd exec prettier -- --write src/app/AppLayout.tsx src/app/AppLayout.test.tsx src/pages/HomePage.tsx src/app/router.tsx
npm.cmd run test:run -- src/app/AppLayout.test.tsx src/app/App.test.tsx
npm.cmd run typecheck
```

Expected: the layout test and existing Home integration test PASS; TypeScript exits with code 0.

- [ ] **Step 7: Commit the layout extraction**

```powershell
git add src/app/AppLayout.tsx src/app/AppLayout.test.tsx src/pages/HomePage.tsx src/app/router.tsx src/app/App.tsx
git commit -m "refactor: extract shared application layout"
```

---

### Task 2: Add the empty Releases route and Header navigation flow

**Files:**

- Create: `src/pages/ReleasesPage.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/App.test.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**

- Produces: `ReleasesPage(): JSX.Element`, an empty named main landmark.
- Consumes: `AppLayout`, `HomePage`, `headerRoutes.releases`, and the Header's existing `NavLink` targets.
- Preserves: wildcard redirect to `/` and Header → main → mobile-navigation DOM order.

- [ ] **Step 1: Add the failing Releases navigation integration test**

Replace `src/app/App.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppRouter } from '@/app/router';

function expectShellOrder() {
  const header = screen.getByRole('banner');
  const main = screen.getByRole('main');
  const mobileNavigation = screen.getByRole('navigation', { name: 'Navegação móvel' });

  expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(main.compareDocumentPosition(mobileNavigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe('Zera GameZ', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renderiza a página inicial', () => {
    render(<AppRouter />);

    expect(screen.getByRole('heading', { level: 1, name: 'Zera GameZ' })).toBeInTheDocument();
    expect(screen.getByText('Em construção')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { hidden: true, name: 'Navegação principal' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeInTheDocument();
    expectShellOrder();
  });

  it('abre a página vazia de Lançamentos pelo Header', async () => {
    const user = userEvent.setup();
    render(<AppRouter />);

    const releasesLink = screen.getByRole('link', { name: 'Lançamentos' });
    await user.click(releasesLink);

    expect(window.location.pathname).toBe('/lancamentos');
    expect(screen.getByRole('main', { name: 'Lançamentos' })).toBeEmptyDOMElement();
    expect(releasesLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeInTheDocument();
    expect(screen.queryByText('Em construção')).not.toBeInTheDocument();
    expectShellOrder();
  });

  it('redireciona rotas desconhecidas para o início', async () => {
    window.history.replaceState({}, '', '/rota-inexistente');
    render(<AppRouter />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Zera GameZ' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
```

- [ ] **Step 2: Run the integration test and verify the route failure**

Run:

```powershell
npm.cmd run test:run -- src/app/App.test.tsx
```

Expected: the Releases test FAILS because `/lancamentos` still matches the wildcard redirect and returns to `/`; Home and wildcard tests PASS.

- [ ] **Step 3: Create the visually empty Releases page**

Create `src/pages/ReleasesPage.tsx`:

```tsx
export function ReleasesPage() {
  return (
    <main
      aria-label="Lançamentos"
      className="min-h-[calc(100dvh-4.5rem)] px-6 py-12 pb-28 sm:pb-12"
    />
  );
}
```

- [ ] **Step 4: Register the centralized Releases route**

Replace `src/app/router.tsx` with:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { ReleasesPage } from '@/pages/ReleasesPage';
import { headerRoutes } from '@/shared/components/header/header.config';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path={headerRoutes.releases} element={<ReleasesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Format and verify the Releases flow**

Run:

```powershell
npm.cmd exec prettier -- --write src/pages/ReleasesPage.tsx src/app/router.tsx src/app/App.test.tsx
npm.cmd run test:run -- src/app/App.test.tsx src/app/AppLayout.test.tsx
```

Expected: all Home, layout, Releases, active-navigation, empty-content, DOM-order, and wildcard tests PASS.

- [ ] **Step 6: Run the complete quality gate**

Run in order:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: every command exits with code 0; Vitest reports all application and Header tests passing; Vite emits the production bundle into ignored `dist/`.

- [ ] **Step 7: Commit the Releases page**

```powershell
git add src/pages/ReleasesPage.tsx src/app/router.tsx src/app/App.test.tsx
git commit -m "feat: add empty releases page"
```
