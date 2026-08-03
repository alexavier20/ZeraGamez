# Responsive Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable Zera GameZ Header system with desktop, tablet, default mobile, contextual mobile, and fixed mobile-bottom-navigation compositions from the approved design.

**Architecture:** `Header` is the public orchestrator and receives all data and behavior through typed props. Focused sibling components own branding, primary navigation, search, actions, contextual mobile states, and bottom navigation; stable route and copy data live in one module. Tailwind breakpoints select layouts without viewport state or JavaScript listeners.

**Tech Stack:** React 19, React Router 8, TypeScript 6 strict mode, Tailwind CSS 4, Lucide React, Fontsource, Vitest, Testing Library, user-event.

## Global Constraints

- Use mobile below `640px`, tablet from `640px` through `1023px`, and desktop at `1024px` or wider.
- Keep the upper Header in normal document flow; only `MobileBottomNav` is fixed.
- Use the exact routes `/`, `/lancamentos`, `/minhas-listas`, `/minhas-listas/nova`, and `/perfil`.
- Map the mobile “Explorar” item to `/lancamentos`.
- Do not create placeholder route pages.
- Do not introduce global state or viewport listeners.
- Support mobile variants `default`, `detail`, and `form` through a discriminated TypeScript union.
- Bundle `Oxanium` and `Chakra Petch` locally and load only weights used by the Header.
- Reuse `C:\Users\alex.brq\Documents\ZeraGamez\assets\images\zera-gamez-z-icon-white-header.png` as `public/assets/images/zera-gamez-z-icon-white-header.png`.
- Keep recurring colors and typography in Tailwind theme tokens; do not scatter design hex values through JSX.
- Use semantic `header`, `nav`, `form`, `input`, and `button` elements with visible focus states and accessible labels.
- Ignore whitespace-only searches after `trim()` and never throw when an optional callback is absent.
- Do not start the development server or browser audit without explicit user permission.
- Use direct file imports through the existing `@/` alias and avoid new barrel files.
- Use `npm.cmd` in PowerShell because the system execution policy blocks `npm.ps1`.

---

## File Map

### Create

- `public/assets/images/zera-gamez-z-icon-white-header.png` — local logo asset.
- `src/shared/components/header/header.types.ts` — public and shared Header types.
- `src/shared/components/header/header.config.ts` — routes, copy, and navigation item data.
- `src/shared/components/header/HeaderBrand.tsx` — linked logo and name.
- `src/shared/components/header/DesktopNavigation.tsx` — desktop links and active state.
- `src/shared/components/header/GlobalSearch.tsx` — accessible search form and local input state.
- `src/shared/components/header/HeaderActions.tsx` — notifications, profile, and create-list CTA.
- `src/shared/components/header/MobileContextHeader.tsx` — default/detail/form mobile header states.
- `src/shared/components/header/MobileBottomNav.tsx` — fixed mobile route navigation.
- `src/shared/components/header/Header.tsx` — responsive public orchestrator.
- `src/shared/components/header/HeaderNavigation.test.tsx` — brand and desktop navigation tests.
- `src/shared/components/header/HeaderControls.test.tsx` — search and action tests.
- `src/shared/components/header/MobileHeader.test.tsx` — mobile state and bottom-navigation tests.
- `src/shared/components/header/Header.test.tsx` — orchestrator and responsive-composition tests.

### Modify

- `package.json` and `package-lock.json` — add Lucide and local font packages.
- `src/styles/global.css` — import fonts and expose design tokens.
- `index.html` — synchronize the browser theme color with the design background.
- `src/app/App.tsx` — render the new Header and reserve mobile-bottom-nav space.
- `src/app/App.test.tsx` — verify application-level Header integration.

---

### Task 1: Establish Header types, design tokens, branding, and route navigation

**Files:**

- Create: `public/assets/images/zera-gamez-z-icon-white-header.png`
- Create: `src/shared/components/header/header.types.ts`
- Create: `src/shared/components/header/header.config.ts`
- Create: `src/shared/components/header/HeaderBrand.tsx`
- Create: `src/shared/components/header/DesktopNavigation.tsx`
- Create: `src/shared/components/header/HeaderNavigation.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/styles/global.css`
- Modify: `index.html`

**Interfaces:**

- Produces: `HeaderUser`, `HeaderContextAction`, `HeaderProps`, `NavigationItem`, and `MobileNavigationItem` from `header.types.ts`.
- Produces: `headerRoutes`, `headerCopy`, `desktopNavItems`, and `mobileNavItems` from `header.config.ts`.
- Produces: `HeaderBrand({ compact?: boolean })` and `DesktopNavigation()`.
- Consumes: existing React Router context and the existing `@/` alias.

- [ ] **Step 1: Write the failing brand and navigation tests**

Create `src/shared/components/header/HeaderNavigation.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { DesktopNavigation } from '@/shared/components/header/DesktopNavigation';
import { HeaderBrand } from '@/shared/components/header/HeaderBrand';

describe('Header navigation', () => {
  it('leva a marca para o início', () => {
    render(
      <MemoryRouter>
        <HeaderBrand />
      </MemoryRouter>,
    );

    const brandLink = screen.getByRole('link', { name: 'Zera GameZ' });
    expect(brandLink).toHaveAttribute('href', '/');
    expect(brandLink.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/images/zera-gamez-z-icon-white-header.png',
    );
  });

  it('marca a rota principal ativa', () => {
    render(
      <MemoryRouter initialEntries={['/lancamentos']}>
        <DesktopNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Lançamentos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Minhas listas' })).toHaveAttribute(
      'href',
      '/minhas-listas',
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```powershell
npm.cmd run test:run -- src/shared/components/header/HeaderNavigation.test.tsx
```

Expected: FAIL because `HeaderBrand.tsx` and `DesktopNavigation.tsx` do not exist.

- [ ] **Step 3: Install the exact feature dependencies and copy the logo**

Run:

```powershell
npm.cmd install lucide-react @fontsource/oxanium @fontsource/chakra-petch
New-Item -ItemType Directory -Force -Path 'C:\Projects\zera-gamez\public\assets\images'
Copy-Item -LiteralPath 'C:\Users\alex.brq\Documents\ZeraGamez\assets\images\zera-gamez-z-icon-white-header.png' -Destination 'C:\Projects\zera-gamez\public\assets\images\zera-gamez-z-icon-white-header.png'
Get-Item -LiteralPath 'C:\Projects\zera-gamez\public\assets\images\zera-gamez-z-icon-white-header.png'
```

Expected: `Get-Item` reports a non-zero `Length` for the copied PNG.

- [ ] **Step 4: Define the shared types**

Create `src/shared/components/header/header.types.ts`:

```ts
export interface HeaderUser {
  readonly name: string;
  readonly initials: string;
}

interface IconHeaderContextAction {
  readonly kind: 'share' | 'menu';
  readonly label: string;
  readonly onClick: () => void;
}

interface TextHeaderContextAction {
  readonly kind: 'text';
  readonly label: string;
  readonly text: string;
  readonly onClick: () => void;
}

export type HeaderContextAction = Readonly<IconHeaderContextAction | TextHeaderContextAction>;

interface HeaderBaseProps {
  readonly user: HeaderUser;
  readonly onSearch?: (query: string) => void;
  readonly onNotificationsClick?: () => void;
  readonly onProfileClick?: () => void;
  readonly onTabletMenuClick?: () => void;
  readonly showMobileBottomNav?: boolean;
}

interface DefaultHeaderProps extends HeaderBaseProps {
  readonly variant?: 'default';
  readonly title?: never;
  readonly onBack?: never;
  readonly onClose?: never;
  readonly contextAction?: never;
}

interface DetailHeaderProps extends HeaderBaseProps {
  readonly variant: 'detail';
  readonly title: string;
  readonly onBack: () => void;
  readonly onClose?: never;
  readonly contextAction?: HeaderContextAction;
}

interface FormHeaderProps extends HeaderBaseProps {
  readonly variant: 'form';
  readonly title: string;
  readonly onBack?: never;
  readonly onClose: () => void;
  readonly contextAction: HeaderContextAction;
}

export type HeaderProps = Readonly<DefaultHeaderProps | DetailHeaderProps | FormHeaderProps>;

export interface NavigationItem {
  readonly label: string;
  readonly to: string;
}

export interface MobileNavigationItem extends NavigationItem {
  readonly icon: 'home' | 'explore' | 'lists' | 'profile';
}
```

- [ ] **Step 5: Centralize routes, navigation data, and accessible copy**

Create `src/shared/components/header/header.config.ts`:

```ts
import type { MobileNavigationItem, NavigationItem } from './header.types';

export const headerRoutes = {
  home: '/',
  releases: '/lancamentos',
  lists: '/minhas-listas',
  createList: '/minhas-listas/nova',
  profile: '/perfil',
} as const;

export const headerCopy = {
  brand: 'Zera GameZ',
  searchLabel: 'Buscar jogos',
  searchPlaceholder: 'Buscar jogos...',
  searchButtonLabel: 'Executar busca',
  notificationsLabel: 'Abrir notificações',
  tabletMenuLabel: 'Abrir menu',
  createList: 'Criar lista',
  mobileNavigationLabel: 'Navegação móvel',
  desktopNavigationLabel: 'Navegação principal',
} as const;

export const desktopNavItems: readonly NavigationItem[] = [
  { label: 'Início', to: headerRoutes.home },
  { label: 'Lançamentos', to: headerRoutes.releases },
  { label: 'Minhas listas', to: headerRoutes.lists },
];

export const mobileNavItems: readonly MobileNavigationItem[] = [
  { label: 'Início', to: headerRoutes.home, icon: 'home' },
  { label: 'Explorar', to: headerRoutes.releases, icon: 'explore' },
  { label: 'Listas', to: headerRoutes.lists, icon: 'lists' },
  { label: 'Perfil', to: headerRoutes.profile, icon: 'profile' },
];
```

- [ ] **Step 6: Add locally bundled fonts and the approved Header theme tokens**

Update `src/styles/global.css` so imports remain at the top and the existing tokens stay available:

```css
@import '@fontsource/chakra-petch/400.css';
@import '@fontsource/chakra-petch/600.css';
@import '@fontsource/chakra-petch/700.css';
@import '@fontsource/oxanium/700.css';
@import 'tailwindcss';

@theme {
  --color-brand: #e70012;
  --color-brand-bright: #f52b3a;
  --color-app: #09070f;
  --color-bg-secondary: #12101a;
  --color-surface: #191624;
  --color-surface-hover: #2a171b;
  --color-text-primary: #f5f3ff;
  --color-text-muted: #a8a3b3;
  --color-header-text: #ffe5e8;
  --color-border-brand: #e7001233;
  --color-header-border: #ffffff22;
  --color-header-field-border: #ffffff2e;
  --color-header-field: #09070fcc;
  --color-header-overlay: #09070f4d;
  --color-avatar-start: #a855f7;
  --color-avatar-end: #2563eb;
  --font-heading: 'Oxanium', sans-serif;
  --font-body: 'Chakra Petch', sans-serif;
}

@layer base {
  html {
    color-scheme: dark;
  }

  body {
    min-width: 20rem;
    min-height: 100vh;
    margin: 0;
    background: var(--color-app);
    font-family: var(--font-body);
  }

  button,
  input {
    font: inherit;
  }

  #root {
    min-height: 100vh;
  }
}
```

Update `index.html` to use `<meta name="theme-color" content="#09070f" />`.

- [ ] **Step 7: Implement the brand and desktop navigation**

Create `HeaderBrand.tsx` with a decorative image and one accessible linked name:

```tsx
import { Link } from 'react-router';

import { headerCopy, headerRoutes } from './header.config';

interface HeaderBrandProps {
  readonly compact?: boolean;
}

export function HeaderBrand({ compact = false }: Readonly<HeaderBrandProps>) {
  return (
    <Link
      className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-primary"
      to={headerRoutes.home}
    >
      <img
        alt=""
        className={compact ? 'size-8 object-contain' : 'h-10 w-[54px] object-contain'}
        height={compact ? 32 : 40}
        src="/assets/images/zera-gamez-z-icon-white-header.png"
        width={compact ? 32 : 54}
      />
      <span className="font-heading text-lg font-bold text-text-primary">{headerCopy.brand}</span>
    </Link>
  );
}
```

Create `DesktopNavigation.tsx`:

```tsx
import { NavLink } from 'react-router';

import { desktopNavItems, headerCopy, headerRoutes } from './header.config';

export function DesktopNavigation() {
  return (
    <nav aria-label={headerCopy.desktopNavigationLabel} className="flex items-center gap-[22px]">
      {desktopNavItems.map((item) => (
        <NavLink
          className={({ isActive }) =>
            `rounded-md px-1 py-2 text-sm text-header-text transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-primary ${
              isActive ? 'font-semibold text-text-primary' : 'hover:text-text-primary'
            }`
          }
          end={item.to === headerRoutes.home}
          key={item.to}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 8: Format and run the focused test**

Run:

```powershell
npm.cmd exec prettier -- --write src/shared/components/header/header.types.ts src/shared/components/header/header.config.ts src/shared/components/header/HeaderBrand.tsx src/shared/components/header/DesktopNavigation.tsx src/shared/components/header/HeaderNavigation.test.tsx src/styles/global.css index.html
npm.cmd run test:run -- src/shared/components/header/HeaderNavigation.test.tsx
npm.cmd run typecheck
```

Expected: both focused tests PASS and TypeScript exits with code 0.

- [ ] **Step 9: Commit the foundation**

```powershell
git add package.json package-lock.json index.html src/styles/global.css public/assets/images/zera-gamez-z-icon-white-header.png src/shared/components/header/header.types.ts src/shared/components/header/header.config.ts src/shared/components/header/HeaderBrand.tsx src/shared/components/header/DesktopNavigation.tsx src/shared/components/header/HeaderNavigation.test.tsx
git commit -m "feat: add header foundation and navigation"
```

---

### Task 2: Implement accessible search and desktop user actions

**Files:**

- Create: `src/shared/components/header/GlobalSearch.tsx`
- Create: `src/shared/components/header/HeaderActions.tsx`
- Create: `src/shared/components/header/HeaderControls.test.tsx`

**Interfaces:**

- Consumes: `HeaderUser`, `headerCopy`, and `headerRoutes` from Task 1.
- Produces: `GlobalSearch({ onSearch?, className? })`.
- Produces: `HeaderActions({ user, onNotificationsClick?, onProfileClick? })`.

- [ ] **Step 1: Write failing interaction tests**

Create `src/shared/components/header/HeaderControls.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { GlobalSearch } from '@/shared/components/header/GlobalSearch';
import { HeaderActions } from '@/shared/components/header/HeaderActions';

describe('Header controls', () => {
  it('normaliza a busca e ignora consultas vazias', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<GlobalSearch onSearch={onSearch} />);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar jogos' }), '   ');
    await user.click(screen.getByRole('button', { name: 'Executar busca' }));
    expect(onSearch).not.toHaveBeenCalled();

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar jogos' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar jogos' }), '  Hollow Knight  ');
    await user.click(screen.getByRole('button', { name: 'Executar busca' }));
    expect(onSearch).toHaveBeenCalledWith('Hollow Knight');
  });

  it('expõe as ações do usuário e a rota para criar lista', async () => {
    const user = userEvent.setup();
    const onNotificationsClick = vi.fn();
    const onProfileClick = vi.fn();
    render(
      <MemoryRouter>
        <HeaderActions
          onNotificationsClick={onNotificationsClick}
          onProfileClick={onProfileClick}
          user={{ name: 'Alex', initials: 'AB' }}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir notificações' }));
    await user.click(screen.getByRole('button', { name: 'Abrir perfil de Alex' }));

    expect(onNotificationsClick).toHaveBeenCalledOnce();
    expect(onProfileClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Criar lista' })).toHaveAttribute(
      'href',
      '/minhas-listas/nova',
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm.cmd run test:run -- src/shared/components/header/HeaderControls.test.tsx
```

Expected: FAIL because `GlobalSearch.tsx` and `HeaderActions.tsx` do not exist.

- [ ] **Step 3: Implement the search form**

Create `GlobalSearch.tsx`:

```tsx
import { useId, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

import { headerCopy } from './header.config';

interface GlobalSearchProps {
  readonly className?: string;
  readonly onSearch?: (query: string) => void;
}

export function GlobalSearch({ className = '', onSearch }: Readonly<GlobalSearchProps>) {
  const inputId = useId();
  const [query, setQuery] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();

    if (normalizedQuery.length === 0) {
      return;
    }

    onSearch?.(normalizedQuery);
  }

  return (
    <form
      className={`flex h-10 items-center gap-2 rounded-xl border border-header-field-border bg-header-field px-3.5 ${className}`}
      onSubmit={handleSubmit}
      role="search"
    >
      <label className="sr-only" htmlFor={inputId}>
        {headerCopy.searchLabel}
      </label>
      <button
        aria-label={headerCopy.searchButtonLabel}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-header-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        type="submit"
      >
        <Search aria-hidden="true" size={18} />
      </button>
      <input
        className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-header-text"
        id={inputId}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={headerCopy.searchPlaceholder}
        type="search"
        value={query}
      />
    </form>
  );
}
```

- [ ] **Step 4: Implement notifications, profile, and CTA actions**

Create `HeaderActions.tsx`:

```tsx
import { Bell, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { headerCopy, headerRoutes } from './header.config';
import type { HeaderUser } from './header.types';

interface HeaderActionsProps {
  readonly user: HeaderUser;
  readonly onNotificationsClick?: () => void;
  readonly onProfileClick?: () => void;
}

export function HeaderActions({
  user,
  onNotificationsClick,
  onProfileClick,
}: Readonly<HeaderActionsProps>) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <button
        aria-label={headerCopy.notificationsLabel}
        className="grid size-10 place-items-center rounded-xl border border-header-border bg-header-overlay text-text-primary transition-colors hover:bg-header-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={onNotificationsClick}
        type="button"
      >
        <Bell aria-hidden="true" size={19} />
      </button>
      <button
        aria-label={`Abrir perfil de ${user.name}`}
        className="grid size-10 place-items-center rounded-full border border-white/25 bg-linear-to-br from-avatar-start to-avatar-end text-xs font-bold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={onProfileClick}
        title={user.name}
        type="button"
      >
        {user.initials}
      </button>
      <Link
        className="flex h-10 items-center gap-2 rounded-xl border border-white/25 bg-app px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        to={headerRoutes.createList}
      >
        <Plus aria-hidden="true" size={17} />
        {headerCopy.createList}
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: Format and verify the controls**

Run:

```powershell
npm.cmd exec prettier -- --write src/shared/components/header/GlobalSearch.tsx src/shared/components/header/HeaderActions.tsx src/shared/components/header/HeaderControls.test.tsx
npm.cmd run test:run -- src/shared/components/header/HeaderControls.test.tsx
npm.cmd run typecheck
```

Expected: two focused tests PASS and TypeScript exits with code 0.

- [ ] **Step 6: Commit the controls**

```powershell
git add src/shared/components/header/GlobalSearch.tsx src/shared/components/header/HeaderActions.tsx src/shared/components/header/HeaderControls.test.tsx
git commit -m "feat: add header search and user actions"
```

---

### Task 3: Implement contextual mobile headers and mobile bottom navigation

**Files:**

- Create: `src/shared/components/header/MobileContextHeader.tsx`
- Create: `src/shared/components/header/MobileBottomNav.tsx`
- Create: `src/shared/components/header/MobileHeader.test.tsx`

**Interfaces:**

- Consumes: `HeaderBrand`, `HeaderContextAction`, `headerCopy`, and `mobileNavItems`.
- Produces: `MobileContextHeader` with a discriminated `default | detail | form` prop union.
- Produces: `MobileBottomNav({ onProfileClick? })` with route-active highlighting.

- [ ] **Step 1: Write failing mobile interaction and navigation tests**

Create `src/shared/components/header/MobileHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { MobileBottomNav } from '@/shared/components/header/MobileBottomNav';
import { MobileContextHeader } from '@/shared/components/header/MobileContextHeader';

describe('Mobile Header', () => {
  it('renderiza a marca e aciona notificações na variante padrão', async () => {
    const user = userEvent.setup();
    const onNotificationsClick = vi.fn();
    render(
      <MemoryRouter>
        <MobileContextHeader onNotificationsClick={onNotificationsClick} variant="default" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Zera GameZ' })).toHaveAttribute('href', '/');
    await user.click(screen.getByRole('button', { name: 'Abrir notificações' }));
    expect(onNotificationsClick).toHaveBeenCalledOnce();
  });

  it('aciona voltar e compartilhar na variante de detalhes', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onShare = vi.fn();
    render(
      <MobileContextHeader
        contextAction={{ kind: 'share', label: 'Compartilhar jogo', onClick: onShare }}
        onBack={onBack}
        title="Detalhes do jogo"
        variant="detail"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Compartilhar jogo' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('aciona fechar e a ação textual na variante de formulário', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreate = vi.fn();
    render(
      <MobileContextHeader
        contextAction={{
          kind: 'text',
          label: 'Criar nova lista',
          onClick: onCreate,
          text: 'Criar',
        }}
        onClose={onClose}
        title="Criar nova lista"
        variant="form"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    await user.click(screen.getByRole('button', { name: 'Criar nova lista' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('marca a rota ativa na navegação inferior', () => {
    render(
      <MemoryRouter initialEntries={['/minhas-listas']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Listas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', '/lancamentos');
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm.cmd run test:run -- src/shared/components/header/MobileHeader.test.tsx
```

Expected: FAIL because the two mobile components do not exist.

- [ ] **Step 3: Implement the contextual mobile header**

Create `MobileContextHeader.tsx`. Keep the icon map at module scope and make all icon-only controls named:

```tsx
import { ArrowLeft, Bell, Ellipsis, Share2, X } from 'lucide-react';

import { HeaderBrand } from './HeaderBrand';
import { headerCopy } from './header.config';
import type { HeaderContextAction } from './header.types';

type MobileContextHeaderProps =
  | Readonly<{ variant: 'default'; onNotificationsClick?: () => void }>
  | Readonly<{
      variant: 'detail';
      title: string;
      onBack: () => void;
      contextAction?: HeaderContextAction;
    }>
  | Readonly<{
      variant: 'form';
      title: string;
      onClose: () => void;
      contextAction: HeaderContextAction;
    }>;

function ContextAction({ action }: Readonly<{ action: HeaderContextAction }>) {
  const content =
    action.kind === 'text' ? (
      action.text
    ) : action.kind === 'share' ? (
      <Share2 aria-hidden="true" size={20} />
    ) : (
      <Ellipsis aria-hidden="true" size={20} />
    );

  return (
    <button
      aria-label={action.label}
      className="grid min-h-10 min-w-10 place-items-center rounded-lg px-2 text-sm font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
      onClick={action.onClick}
      type="button"
    >
      {content}
    </button>
  );
}

export function MobileContextHeader(props: MobileContextHeaderProps) {
  if (props.variant === 'default') {
    return (
      <div
        className="flex h-[62px] items-center justify-between px-4"
        data-testid="mobile-context-header"
      >
        <HeaderBrand compact />
        <button
          aria-label={headerCopy.notificationsLabel}
          className="grid size-10 place-items-center rounded-lg text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
          onClick={props.onNotificationsClick}
          type="button"
        >
          <Bell aria-hidden="true" size={20} />
        </button>
      </div>
    );
  }

  const leadingAction =
    props.variant === 'detail' ? (
      <button
        aria-label="Voltar"
        className="grid size-10 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={props.onBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={21} />
      </button>
    ) : (
      <button
        aria-label="Fechar"
        className="grid size-10 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={props.onClose}
        type="button"
      >
        <X aria-hidden="true" size={21} />
      </button>
    );

  return (
    <div
      className="grid h-[58px] grid-cols-[4rem_1fr_4rem] items-center px-4 text-text-primary"
      data-testid="mobile-context-header"
    >
      {leadingAction}
      <strong className="truncate text-center font-heading text-sm">{props.title}</strong>
      {props.contextAction ? (
        <ContextAction action={props.contextAction} />
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}
```

Apply Prettier after creating the file so the long button attributes are split consistently.

- [ ] **Step 4: Implement fixed mobile bottom navigation**

Create `MobileBottomNav.tsx`:

```tsx
import { Compass, House, Library, User, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

import { headerCopy, headerRoutes, mobileNavItems } from './header.config';
import type { MobileNavigationItem } from './header.types';

const mobileIcons: Readonly<Record<MobileNavigationItem['icon'], LucideIcon>> = {
  home: House,
  explore: Compass,
  lists: Library,
  profile: User,
};

interface MobileBottomNavProps {
  readonly onProfileClick?: () => void;
}

export function MobileBottomNav({ onProfileClick }: Readonly<MobileBottomNavProps>) {
  return (
    <nav
      aria-label={headerCopy.mobileNavigationLabel}
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 grid h-[68px] grid-cols-4 rounded-2xl border border-header-border bg-bg-secondary/95 px-2 shadow-2xl backdrop-blur sm:hidden"
      data-testid="mobile-bottom-nav"
    >
      {mobileNavItems.map((item) => {
        const Icon = mobileIcons[item.icon];
        return (
          <NavLink
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${
                isActive ? 'text-brand-bright' : 'text-text-muted hover:text-text-primary'
              }`
            }
            end={item.to === headerRoutes.home}
            key={item.to}
            onClick={item.icon === 'profile' ? onProfileClick : undefined}
            to={item.to}
          >
            <Icon aria-hidden="true" size={20} />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: Format and verify all mobile behavior**

Run:

```powershell
npm.cmd exec prettier -- --write src/shared/components/header/MobileContextHeader.tsx src/shared/components/header/MobileBottomNav.tsx src/shared/components/header/MobileHeader.test.tsx
npm.cmd run test:run -- src/shared/components/header/MobileHeader.test.tsx
npm.cmd run typecheck
```

Expected: four focused tests PASS and TypeScript exits with code 0.

- [ ] **Step 6: Commit the mobile components**

```powershell
git add src/shared/components/header/MobileContextHeader.tsx src/shared/components/header/MobileBottomNav.tsx src/shared/components/header/MobileHeader.test.tsx
git commit -m "feat: add responsive mobile header navigation"
```

---

### Task 4: Compose the responsive Header and integrate it into the application

**Files:**

- Create: `src/shared/components/header/Header.tsx`
- Create: `src/shared/components/header/Header.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**

- Consumes: every focused component and `HeaderProps` from Tasks 1–3.
- Produces: `Header(props: HeaderProps)` as the only application-facing Header API.
- Produces: an application shell with correct mobile bottom padding.

- [ ] **Step 1: Write failing orchestrator and application integration tests**

Create `src/shared/components/header/Header.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { Header } from '@/shared/components/header/Header';

const user = { name: 'Alex', initials: 'AB' } as const;

describe('Header', () => {
  it('renderiza composições responsivas sem observar o viewport em JavaScript', () => {
    const onTabletMenuClick = vi.fn();
    render(
      <MemoryRouter>
        <Header onTabletMenuClick={onTabletMenuClick} user={user} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('header-desktop')).toHaveClass('lg:flex');
    expect(screen.getByTestId('header-tablet')).toHaveClass('sm:flex', 'lg:hidden');
    expect(screen.getByTestId('header-mobile')).toHaveClass('sm:hidden');
    expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Abrir menu' }));
    expect(onTabletMenuClick).toHaveBeenCalledOnce();
  });

  it('encaminha a variante contextual e permite ocultar a navegação inferior', () => {
    const onBack = vi.fn();
    render(
      <MemoryRouter>
        <Header
          onBack={onBack}
          showMobileBottomNav={false}
          title="Detalhes do jogo"
          user={user}
          variant="detail"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Detalhes do jogo')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
  });
});
```

Update `src/app/App.test.tsx` to retain the existing construction-page assertions and add:

```tsx
expect(screen.getByRole('banner')).toBeInTheDocument();
expect(
  screen.getByRole('navigation', { hidden: true, name: 'Navegação principal' }),
).toBeInTheDocument();
expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused tests and verify the Header module failure**

Run:

```powershell
npm.cmd run test:run -- src/shared/components/header/Header.test.tsx src/app/App.test.tsx
```

Expected: FAIL because `Header.tsx` does not exist and `App.tsx` does not render a banner.

- [ ] **Step 3: Implement the responsive orchestrator**

Create `src/shared/components/header/Header.tsx`:

```tsx
import { Menu } from 'lucide-react';

import { DesktopNavigation } from './DesktopNavigation';
import { GlobalSearch } from './GlobalSearch';
import { HeaderActions } from './HeaderActions';
import { HeaderBrand } from './HeaderBrand';
import { headerCopy } from './header.config';
import type { HeaderProps } from './header.types';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileContextHeader } from './MobileContextHeader';

function renderMobileHeader(props: HeaderProps) {
  if (props.variant === 'detail') {
    return (
      <MobileContextHeader
        contextAction={props.contextAction}
        onBack={props.onBack}
        title={props.title}
        variant="detail"
      />
    );
  }

  if (props.variant === 'form') {
    return (
      <MobileContextHeader
        contextAction={props.contextAction}
        onClose={props.onClose}
        title={props.title}
        variant="form"
      />
    );
  }

  return (
    <MobileContextHeader onNotificationsClick={props.onNotificationsClick} variant="default" />
  );
}

export function Header(props: HeaderProps) {
  return (
    <>
      <header className="border-b border-header-border bg-brand text-text-primary">
        <div className="mx-auto max-w-[1440px]">
          <div
            className="hidden h-[72px] items-center gap-6 px-6 lg:flex"
            data-testid="header-desktop"
          >
            <HeaderBrand />
            <DesktopNavigation />
            <GlobalSearch className="min-w-48 flex-1" onSearch={props.onSearch} />
            <HeaderActions
              onNotificationsClick={props.onNotificationsClick}
              onProfileClick={props.onProfileClick}
              user={props.user}
            />
          </div>

          <div
            className="hidden h-16 items-center gap-4 px-5 sm:flex lg:hidden"
            data-testid="header-tablet"
          >
            <HeaderBrand compact />
            <GlobalSearch className="flex-1" onSearch={props.onSearch} />
            <button
              aria-label={headerCopy.tabletMenuLabel}
              className="grid size-10 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
              onClick={props.onTabletMenuClick}
              type="button"
            >
              <Menu aria-hidden="true" size={22} />
            </button>
          </div>

          <div className="sm:hidden" data-testid="header-mobile">
            {renderMobileHeader(props)}
          </div>
        </div>
      </header>

      {props.showMobileBottomNav === false ? null : (
        <MobileBottomNav onProfileClick={props.onProfileClick} />
      )}
    </>
  );
}
```

- [ ] **Step 4: Integrate the Header into the application shell**

Update `src/app/App.tsx`:

```tsx
import { Header } from '@/shared/components/header/Header';
import type { HeaderUser } from '@/shared/components/header/header.types';

const appUser = {
  name: 'Alex',
  initials: 'AB',
} as const satisfies HeaderUser;

export function App() {
  return (
    <div className="min-h-dvh bg-app text-text-primary">
      <Header user={appUser} />
      <main className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center px-6 py-12 pb-28 text-center sm:pb-12">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">Zera GameZ</h1>
          <div className="mx-auto my-5 h-1 w-12 rounded-full bg-brand" aria-hidden="true" />
          <p className="text-base text-text-muted sm:text-lg">Em construção</p>
        </div>
      </main>
    </div>
  );
}
```

Apply the three new application-level expectations described in Step 1 to `src/app/App.test.tsx` without removing its heading and “Em construção” checks.

- [ ] **Step 5: Format and run focused integration tests**

Run:

```powershell
npm.cmd exec prettier -- --write src/shared/components/header/Header.tsx src/shared/components/header/Header.test.tsx src/app/App.tsx src/app/App.test.tsx
npm.cmd run test:run -- src/shared/components/header/Header.test.tsx src/app/App.test.tsx
```

Expected: three tests across the two files PASS.

- [ ] **Step 6: Run the complete quality gate**

Run in this order:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: every command exits with code 0; Vitest reports all Header and application tests passing; Vite emits the production bundle into ignored `dist/`.

- [ ] **Step 7: Commit the integrated responsive Header**

```powershell
git add src/shared/components/header/Header.tsx src/shared/components/header/Header.test.tsx src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: integrate responsive header system"
```

- [ ] **Step 8: Request permission before live visual verification**

Ask the user for explicit permission to start `npm.cmd run dev` and use the browser for desktop, tablet, and mobile visual checks. If approved, use the `build-web-apps:frontend-testing-debugging` skill, inspect widths `1440`, `768`, and `390`, verify the browser console, and correct only discrepancies against `C:\Projects\Design\zeragamez\ZeraGamez`. Re-run the complete quality gate after any correction and commit the visual-fidelity fixes separately as:

```powershell
git commit -m "fix: align responsive header with design"
```

Do not create this commit when the audit produces no file changes.
