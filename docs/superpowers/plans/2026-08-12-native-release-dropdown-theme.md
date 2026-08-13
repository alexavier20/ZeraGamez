# Native Release Dropdown Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every native platform and genre dropdown in the release filters use the Zera GameZ dark palette and Chakra Petch typography.

**Architecture:** Keep the existing generic `FilterSelect` and native `<select>` behavior. Apply the theme once inside that shared renderer so all responsive instances receive the same font and dark color scheme, then style each native `<option>` with existing Tailwind theme tokens where the browser supports option styling.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, Vitest 4, React Testing Library, Vite 8

## Global Constraints

- Keep the current native selects, option values, callbacks, responsive layouts, and accessible labels.
- Apply the Chakra Petch site font to each release-filter select.
- Request the browser's dark native control treatment with `color-scheme: dark`.
- Give the opened options the site's dark surface background and light primary text where the browser supports styling native options.
- Preserve the existing active and inactive wrapper colors, focus rings, chevron, truncation, and sizing.
- Do not add a custom listbox, animation, dependency, filtering behavior, or global form-control rule.
- Native popup hover and selected-state rendering remain controlled by the browser and operating system.
- Follow TDD: verify the new component test fails for the missing theme classes before editing production code.

---

## File Map

- Modify `src/features/releases/components/ReleaseFilters.test.tsx`: specify the theme contract for every native release-filter select and option.
- Modify `src/features/releases/components/ReleaseFilters.tsx`: apply the Chakra Petch font, dark native color scheme, and option palette in `FilterSelect`.

---

### Task 1: Theme the Native Release Dropdowns

**Files:**

- Modify: `src/features/releases/components/ReleaseFilters.test.tsx:48-59`
- Modify: `src/features/releases/components/ReleaseFilters.tsx:33-45`

**Interfaces:**

- Consumes: existing `FilterSelect<TKey>` props and the Tailwind tokens `font-body`, `bg-surface`, and `text-content-primary` declared in `src/styles/global.css`.
- Produces: the same native select DOM interface and callbacks, with a stable visual contract expressed by `font-body`, `[color-scheme:dark]`, `bg-surface`, and `text-content-primary` classes.

- [ ] **Step 1: Write the failing native-dropdown theme test**

Insert this test after the focus-ring test in `src/features/releases/components/ReleaseFilters.test.tsx`:

```tsx
it('themes every native dropdown with the site palette and typography', () => {
  setup();

  for (const dropdown of screen.getAllByRole('combobox')) {
    expect(dropdown).toHaveClass('font-body', '[color-scheme:dark]');

    for (const option of within(dropdown).getAllByRole('option')) {
      expect(option).toHaveClass('bg-surface', 'font-body', 'text-content-primary');
    }
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseFilters.test.tsx --exclude '.worktrees/**'
```

Expected: FAIL in `themes every native dropdown with the site palette and typography` because the `<select>` is missing `font-body` and `[color-scheme:dark]`.

- [ ] **Step 3: Implement the localized native theme**

Change the select and option markup inside `FilterSelect` in `src/features/releases/components/ReleaseFilters.tsx` to:

```tsx
<select
  aria-label={ariaLabel}
  className="min-w-0 max-w-full appearance-none truncate bg-transparent pr-5 font-body [color-scheme:dark] outline-none"
  onChange={(event) => {
    onChange(event.target.value as TKey);
  }}
  value={value}
>
  {options.map((option) => (
    <option
      className="bg-surface font-body text-content-primary"
      key={option.key}
      value={option.key}
    >
      {option.label}
    </option>
  ))}
</select>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/releases/components/ReleaseFilters.test.tsx --exclude '.worktrees/**'
```

Expected: PASS with 4 tests, no warnings or errors.

- [ ] **Step 5: Run the full automated verification**

Run each command from the repository root:

```powershell
npm.cmd run test:run -- --exclude '.worktrees/**'
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Expected: 27 test files and 173 tests pass; lint, formatting, type checking, build, and whitespace checks exit with code 0.

- [ ] **Step 6: Verify the native controls in the browser**

Use the `build-web-apps:frontend-testing-debugging` and `browser:control-in-app-browser` skills. Start the Vite development server with:

```powershell
npm.cmd run dev:vite -- --host 127.0.0.1
```

At `/lancamentos`, verify both `1440x900` and `390x844`:

- Open each visible native dropdown and confirm its popup uses a dark surface with light text and Chakra Petch where the platform permits native option styling.
- Confirm the closed select reports `color-scheme: dark` and a computed font family containing `Chakra Petch`.
- Select one platform and one genre and confirm the visible value and filtered-results behavior are unchanged.
- Use keyboard focus and confirm the existing red focus ring remains visible.
- Confirm no horizontal overflow and no console errors.

- [ ] **Step 7: Commit the implementation**

```powershell
git add src/features/releases/components/ReleaseFilters.test.tsx src/features/releases/components/ReleaseFilters.tsx
git commit -m "style: theme native release dropdowns"
```
