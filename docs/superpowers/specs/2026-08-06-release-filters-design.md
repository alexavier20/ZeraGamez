# Release Filters Design

## Goal

Reproduce the Pencil `Filtros de Lançamentos` component on the Releases page with the exact desktop, tablet, and mobile visual variants defined in the design. The component is presentation-only in this iteration: it does not filter data, open menus, or change selection state.

## Design Source

- Pencil file: `/C:/Projects/ZeraGamez/Design/ZeraGamez`
- Selected desktop node: `drwDo` (`Filtros de Lançamentos`)
- Desktop screen: `FlHYJ` (`Tela 1 / Lançamentos / Desktop`)
- Tablet screen: `LSXHf` (`Responsivo / Lançamentos / Tablet 768`)
- Mobile screen: `XXde3` (`Responsivo / Lançamentos / Mobile 390`)

Only the filter bar is in scope. The mobile search field shown above the filters in the Pencil screen is a separate element and is not part of this change.

## Architecture

Create one named React component, `ReleaseFilters`, under `src/features/releases/components`. The component has no props because all content and selected visuals are fixed by the approved design and no filtering behavior is required.

The component contains three responsive visual variants:

- mobile: visible below `sm`;
- tablet: visible from `sm` through the breakpoint before `lg`;
- desktop: visible from `lg` upward.

Keeping the three variants inside one component avoids duplicating component files while allowing the labels, icons, sizing, and colors to match the distinct Pencil layouts. Each variant uses static, non-interactive elements so the markup does not promise behavior that does not exist.

## Desktop Variant

Render a single horizontal row with a `10px` gap. Each chip is `38px` high, uses `13px` horizontal padding, an `11px` corner radius, `12px` Chakra Petch text, and a `1px` border.

The labels and order are:

1. `Todas as plataformas`
2. `PC`
3. `PlayStation 5`
4. `Xbox Series X|S`
5. `Nintendo Switch`
6. `Gênero`, followed by a `13px` Lucide `ChevronDown`
7. `Período`, followed by a `13px` Lucide `ChevronDown`
8. `Limpar filtros` as unboxed accent text

`Todas as plataformas` uses the approved selected appearance: translucent red background, brand-red border, light red text, and semibold weight. The remaining boxed filters use `bg-secondary`, the existing translucent brand border, muted text, and medium weight. `Limpar filtros` uses `brand-bright` and semibold weight.

## Tablet Variant

Render a single horizontal row with an `8px` gap. Each chip is `36px` high, uses `11px` horizontal padding, a `10px` corner radius, `11px` Chakra Petch text, and a `1px` border.

The labels and order are:

1. `Todas`
2. `PS5`
3. `PC`
4. `Gênero`
5. `Período`

`Todas` uses the translucent selected appearance. The other chips use the existing `surface` background, brand border, and muted text. The tablet design does not show dropdown icons or `Limpar filtros`, so neither is rendered in this variant.

## Mobile Variant

Render a single horizontal row with an `8px` gap. Each chip is `38px` high, uses `11px` horizontal padding, an `11px` corner radius, `11px` semibold Chakra Petch text, a `7px` icon gap, and a `1px` border.

The labels, icons, and order are:

1. Lucide `SlidersHorizontal` at `15px` with `Filtros (2)`
2. Lucide `CalendarDays` at `15px` with `Período`
3. Lucide `Gamepad2` at `15px` with `PS5`

`Filtros (2)` uses the solid brand-red selected appearance with primary text. The remaining chips use the existing `surface` background, brand border, and muted icon/text color. The row remains fully visible within the mobile content width and does not introduce horizontal scrolling.

## Tokens and Styling

Use Tailwind CSS v4 classes exclusively in the component. Reuse the existing theme tokens for brand, brand-bright, bg-secondary, surface, muted text, primary content, and brand border.

Add named theme tokens only for the two selected-chip values that do not already exist in the codebase:

- filter active background: `#ff304029`;
- filter active text: `#ffd6da`.

Do not use inline styles. Preserve the existing Chakra Petch body font inherited by the page.

## Page Integration

Render `ReleaseFilters` in `ReleasesPage` immediately after the existing heading/switcher wrapper. Preserve `PageHeading` and `ReleaseViewSwitcher` without behavioral changes.

Use responsive top spacing that mirrors the Pencil content gaps:

- mobile: `18px`;
- tablet: `22px`;
- desktop: `28px`.

The filters stay inside the existing responsive page padding and max-width container.

## Accessibility

Expose the component as a named static region, `Filtros de lançamentos`. Do not use buttons, `aria-pressed`, menu semantics, or focus behavior because this iteration is explicitly visual-only. Decorative icons are hidden from assistive technology.

## Testing

Add a focused component test that verifies:

- the named filters region exists;
- all three variants are present with the intended responsive visibility classes;
- each variant contains exactly the approved labels for its breakpoint;
- the desktop dropdown and mobile filter icons render with decorative semantics;
- no interactive button is exposed;
- selected and inactive visual token classes match the design.

Extend the Releases page integration test to verify that the filter region follows the heading/switcher wrapper in DOM order and carries the approved responsive top-spacing classes.

Browser QA must compare the rendered component with the Pencil reference at desktop `1440px`, tablet `768px`, and mobile `390px`. Verify page identity, meaningful content, no framework overlay, no console warnings/errors, no horizontal overflow, and exact copy, order, sizes, colors, spacing, borders, radii, icons, and responsive visibility.

## Acceptance Criteria

- The selected Pencil filter component appears immediately below the Releases page heading.
- Desktop, tablet, and mobile variants match their corresponding Pencil screens.
- The exact labels, order, icons, dimensions, spacing, colors, borders, and radii are preserved.
- The component is visual-only and exposes no misleading interactive controls.
- The existing list/calendar switcher continues to work unchanged.
- No mobile search field, filter menus, filtering state, game data, or release cards are added.
- The unrelated local `package-lock.json` modification remains untouched and outside the feature commit.
- Lint, formatting, TypeScript, tests, production build, and rendered Browser QA pass.
