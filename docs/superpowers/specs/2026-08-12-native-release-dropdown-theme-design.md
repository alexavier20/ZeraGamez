# Native Release Dropdown Theme Design

## Objective

Make the native platform and genre dropdowns match the Zera GameZ dark theme and typography without replacing the existing `<select>` controls.

## Scope

- Keep the current native selects, option values, callbacks, responsive layouts, and accessible labels.
- Apply the Chakra Petch site font to each release-filter select.
- Request the browser's dark native control treatment with `color-scheme: dark`.
- Give the opened options the site's dark surface background and light primary text where the browser supports styling native options.
- Preserve the existing active and inactive wrapper colors, focus rings, chevron, truncation, and sizing.

Custom listbox behavior, new animations, filtering logic, and changes to unrelated form controls are out of scope.

## Implementation Design

The shared `FilterSelect` component will own the dropdown theme because every release-filter select already passes through it. Its `<select>` will receive the site body font, dark color scheme, and option color utilities. This keeps the change local to release filters and avoids changing future selects elsewhere in the application.

The control remains native. Consequently, the browser and operating system retain responsibility for opening, positioning, hover feedback, selection, keyboard navigation, and screen-reader semantics. Native popup styling can vary by platform; the dark color scheme is the baseline signal, while explicit option background, text, and font styles provide the intended appearance where supported.

## Accessibility

- Existing `aria-label` values remain unchanged.
- Keyboard interaction and focus behavior remain native.
- The option foreground and background use existing high-contrast site tokens.
- No decorative element becomes interactive or enters the accessibility tree.

## Verification

- Add a component test that fails until every release-filter select exposes the dark theme, Chakra Petch font, and themed options.
- Run the focused component test, then the full suite while excluding the repository's internal `.worktrees` directory from Vitest discovery.
- Run lint, formatting, type checking, and build checks.
- Verify the platform and genre dropdowns in the browser at desktop and mobile widths, including opening the native menu, selecting an option, focus visibility, and console output.
