# Empty Releases Page Design

## Goal

Add a visually empty Releases page at `/lancamentos` and make the existing Header navigation open it without losing the shared application shell.

## Scope

- Keep the Header visible on Home and Releases.
- Keep the fixed mobile bottom navigation visible on both routes.
- Render an empty main-content region on Releases.
- Preserve the existing wildcard redirect to `/`.
- Do not add release cards, loading states, data fetching, filters, placeholder copy, or global state.

## Architecture

Use a nested React Router layout so the shared chrome is rendered once:

```text
BrowserRouter
└── AppLayout
    ├── Header
    ├── Outlet
    │   ├── /              -> HomePage
    │   └── /lancamentos   -> ReleasesPage
    └── MobileBottomNav
```

`AppLayout` owns the current static user data and composes `Header`, `Outlet`, and `MobileBottomNav` in DOM focus order. Page components own only their `<main>` content.

## Components and Files

- Create `src/app/AppLayout.tsx` for the shared shell.
- Create `src/pages/HomePage.tsx` with the current Home `<main>` content.
- Create `src/pages/ReleasesPage.tsx` with an empty `<main aria-label="Lançamentos">`.
- Update `src/app/router.tsx` to nest `/` and `/lancamentos` under `AppLayout`.
- Remove the obsolete `src/app/App.tsx` after its responsibilities are split.
- Update the application integration test to cover Home and Releases navigation.

The Releases `<main>` keeps the same minimum-height and responsive bottom spacing as Home so the fixed mobile navigation never covers future content. It contains no visible placeholder.

## Navigation Behavior

- The desktop `Lançamentos` link already targets `/lancamentos`.
- The mobile `Explorar` link already targets `/lancamentos`.
- React Router navigation changes the URL without a full-page reload.
- Existing `NavLink` behavior marks the corresponding desktop and mobile entries with `aria-current="page"`.
- Unknown routes continue to redirect to `/`.

## Accessibility

- The empty page still exposes a semantic `main` landmark named `Lançamentos` through `aria-label`.
- DOM focus order remains Header, page content, then fixed mobile navigation.
- No hidden heading or placeholder text is added solely to make the page appear non-empty.

## Testing

Add integration coverage that:

1. renders the Home route with its existing content;
2. clicks the desktop `Lançamentos` link;
3. observes `/lancamentos` in `window.location.pathname`;
4. finds the named empty `main` landmark;
5. confirms Header and mobile navigation remain mounted;
6. confirms the Releases desktop link is active;
7. confirms the Releases page has no placeholder content;
8. preserves the Header → main → mobile-navigation DOM order.

The existing Header component tests remain responsible for the mobile `Explorar` destination and responsive composition.

## Acceptance Criteria

- Clicking `Lançamentos` opens `/lancamentos`.
- Clicking mobile `Explorar` targets the same route.
- The page is visually empty while retaining Header and mobile navigation.
- The active navigation state is correct.
- Unknown routes still return to Home.
- Lint, formatting, TypeScript, tests, and production build pass.
