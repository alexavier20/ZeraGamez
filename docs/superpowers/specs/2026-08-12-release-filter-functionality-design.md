# Functional Release Filters Design

**Date:** 2026-08-12

## Context

The Releases page already renders responsive platform, genre, and period chips. They are static presentation elements: the component exposes no controls, owns no selection state, and does not pass filters to the existing releases API. The API client, query parser, and IGDB repository already support `platformIds` and `genreIds`.

This change makes platform and genre filtering functional and removes the period control from the component. Date windows remain an internal part of release pagination and are not removed from the API.

## Goals

- Let the user select one platform and one genre independently.
- Query the server with the selected platform and genre so results are complete rather than limited to releases already loaded in the browser.
- Restart release scanning when either filter changes.
- Remove the period filter at every breakpoint.
- Preserve the established chip styling and responsive spacing.
- Keep filtering accessible by keyboard and assistive technology.

## Non-goals

- Multiple selections within platform or genre.
- A user-configurable date range.
- Persisting filters in the URL or browser storage.
- Loading filter options dynamically from IGDB.
- Backend contract or repository changes.

## Chosen Approach

Filtering happens through the existing API. Client-only filtering was rejected because it would omit matching games in release windows that have not been loaded. A hybrid local/server flow was rejected because it adds transient, potentially misleading results and unnecessary state.

Each filter change starts a new `useReleases` session. The hook cancels the active request, discards the previous response and pagination queues, and sends the chosen IDs with the new initial request. Every split-window request, later pagination request, and retry in that session reuses the same filters.

## Fixed Filter Catalog

Platform choices map directly to IGDB platform IDs:

| Label | IDs sent to the API |
| --- | --- |
| Todas as plataformas | none |
| PC | `6` |
| PlayStation 5 | `167` |
| Xbox Series X\|S | `169` |
| Nintendo Switch | `130` |

Genre choices are fixed UI categories. Most map to one native IGDB genre. `Ação` is an explicit umbrella for the native Fighting and Hack and slash/Beat 'em up genres so the approved Portuguese label is not incorrectly represented by a single unrelated IGDB ID.

| Label | IDs sent to the API |
| --- | --- |
| Todos os gêneros | none |
| Ação | `4,25` |
| Aventura | `31` |
| RPG | `12` |
| Estratégia | `15` |
| Tiro | `5` |
| Indie | `32` |

The user still selects exactly one genre option; an option may map to more than one API ID.

## Component Boundaries

### Filter catalog

A focused `release-filter-options.ts` module owns the immutable labels and IGDB ID mappings. Both responsive filter variants and query construction consume the same typed definitions.

### `ReleaseFilters`

`ReleaseFilters` becomes a controlled presentation component. It receives the selected platform and genre keys plus callbacks for platform change, genre change, and clearing both filters. It does not fetch data or maintain a second copy of selection state.

Desktop platform chips are buttons with `aria-pressed`. The desktop genre control is a styled native select. Tablet and mobile use styled native selects for both platform and genre so every fixed option remains available without horizontal overflow. The clear action is a real button and is disabled when both filters are at their defaults.

The period label, calendar icon, and period dropdown are removed from all variants. Decorative icons remain hidden from assistive technology.

### `ReleasesPage`

`ReleasesPage` owns the selected platform and genre keys. It passes them to `ReleaseFilters` and resolves their ID arrays for `useReleases`. Clearing filters restores both defaults in one state transition.

### `useReleases`

`useReleases` accepts an immutable filter query separately from injectable test dependencies. Its session-reset effect depends on stable primitive filter values or a stable serialized key, preventing request loops caused by object identity.

Every call to the loader combines the current release window and limit with the session's platform and genre IDs. Empty arrays are omitted by the existing API client.

## Data Flow

1. The user selects a platform or genre.
2. `ReleaseFilters` emits the selected catalog key.
3. `ReleasesPage` updates its single filter state.
4. `useReleases` invalidates the previous session and aborts its active request.
5. The hook clears accumulated results, failed windows, and pagination state, then shows the existing loading state.
6. The initial API request includes `platformIds` and `genreIds` when selected.
7. Split scans, incremental pages, and retries reuse the same IDs.
8. The existing success, empty, and error UI renders the filtered result.

Responses from an invalidated or aborted session are ignored and cannot overwrite the current filtered state.

## Responsive Interaction

- **Desktop:** one button chip per platform, one styled genre select, and the clear button.
- **Tablet and mobile:** one compact platform select, one compact genre select, and the clear button.
- Selected controls use the existing active border, background, and text tokens.
- Inactive controls preserve the current surface, border, typography, height, radius, and spacing language.
- No filter row introduces horizontal page overflow at `390px`, `768px`, or `1440px` widths.

Native selects provide keyboard navigation and familiar mobile pickers. Each select has an accessible name independent of the currently selected option. Visible focus styles are retained. Platform buttons announce their pressed state, and the disabled clear button exposes native disabled semantics.

## Loading, Empty, and Error Behavior

Changing a filter immediately replaces the old results with the existing loading state. This prevents stale, unfiltered games from appearing under a newly selected control.

If the initial filtered request fails, the selection remains visible and the existing retry action repeats that filtered request. If a later page fails, already loaded filtered releases remain visible and retry uses the exact failed date window plus the current filters. Selecting another filter while a request is active cancels the old session and starts the new one.

The existing empty-state copy remains valid and its clear-filters guidance becomes actionable through the filter component.

## Testing Strategy

Tests are written before production changes and cover real observable behavior:

- Catalog tests verify approved labels and ID mappings.
- `ReleaseFilters` tests verify selection callbacks, active and disabled states, responsive controls, keyboard-accessible semantics, clearing, and the complete absence of period UI.
- `useReleases` tests verify initial filter forwarding, propagation to split and incremental windows, retry preservation, cancellation, stale-response protection, and a full session reset when filters change.
- Releases page integration tests select platform and genre controls, assert the resulting API queries, clear filters, and verify loading, success, empty, and retry flows.
- Existing API client and server query tests continue proving serialization, validation, and IGDB query construction.
- Browser QA covers functional selection, clearing, console output, focus behavior, and horizontal overflow at mobile, tablet, and desktop widths.

## Acceptance Criteria

- Selecting a platform reloads releases with the corresponding IGDB platform ID.
- Selecting a genre reloads releases with the corresponding fixed genre ID mapping.
- Platform and genre selections combine and each category allows one visible selection.
- Changing or clearing filters cancels stale work and restarts pagination from the initial release window.
- All subsequent pages and retries retain the active filters.
- The period control and calendar icon do not appear at any breakpoint.
- Every platform and genre option is reachable on desktop, tablet, and mobile.
- Clear filters restores the unfiltered query and is disabled when no filter is active.
- Loading, empty, and error states remain coherent with the selected filters.
- Focus, pressed, selected, and disabled semantics are accessible.
- Focused tests, the complete test suite, lint, formatting, type checking, production build, and browser QA pass.
