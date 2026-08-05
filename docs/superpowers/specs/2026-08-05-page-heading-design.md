# Responsive Page Heading Design

## Goal

Implement the title-and-supporting-text block selected in the ZeraGamez Pencil file as a reusable React component, then render it at the top of the Releases page.

## Source of Truth

The selected Pencil node is `JlNbM` (`Título e Apoio`) in the Releases desktop screen. Its content and resolved design values are:

- title: `Próximos lançamentos`, Oxanium, 38 px, weight 700, `$text` (`#F5F3FF`);
- subtitle: `Descubra os games que estão chegando`, Chakra Petch, 16 px, weight 400, `$muted` (`#A8A3B3`);
- vertical layout with an 8 px desktop gap.

The related responsive Releases canvases define these adaptations:

| Viewport                   | Title       | Subtitle    | Gap   |
| -------------------------- | ----------- | ----------- | ----- |
| Mobile, below 640 px       | 27 px / 700 | 13 px / 400 | 18 px |
| Tablet, 640-1023 px        | 30 px / 700 | 14 px / 400 | 22 px |
| Desktop, 1024 px and above | 38 px / 700 | 16 px / 400 | 8 px  |

The Pencil mobile weight of 720 is normalized to the loaded Oxanium 700 face. This avoids synthetic font interpolation while preserving the intended bold appearance.

## Component Architecture

Create `src/shared/components/page-heading/PageHeading.tsx` with a deliberately small public API:

```ts
type PageHeadingProps = Readonly<{
  title: string;
  subtitle: string;
}>;
```

The component renders a semantic page-heading block containing one `h1` followed by one supporting `p`. It owns typography, color, and responsive spacing, but it does not own page padding, maximum width, navigation, or release-specific content.

The title uses a new semantic Tailwind theme token, `--color-content-primary: #F5F3FF`, exposed through `text-content-primary`. The subtitle reuses the existing `text-text-muted` token because it already matches Pencil `$muted`. Both font families reuse the existing `font-heading` and body defaults.

Do not add alignment, heading-level, class-name, or optional-subtitle variants until a real caller requires them. Keeping the component strict prevents page-specific styling from leaking into a shared primitive.

## Releases Page Integration

Update `ReleasesPage` to render:

```tsx
<PageHeading title="Próximos lançamentos" subtitle="Descubra os games que estão chegando" />
```

The page remains responsible for its `main` landmark and layout. Its content container is capped at 1440 px and receives the Pencil screen padding:

- mobile: 16 px horizontal, 22 px top;
- tablet: 20 px horizontal, 28 px top;
- desktop: 32 px horizontal, 36 px top.

Existing bottom padding is retained so the fixed mobile navigation does not cover future page content. No filters, cards, view switcher, search, or release data are introduced by this task.

## Responsive Behavior

Use mobile-first Tailwind utilities with the project's existing breakpoints:

- base styles represent the 390 px mobile canvas;
- `sm` represents the 768 px tablet canvas;
- `lg` represents the 1440 px desktop canvas.

Text remains left-aligned and content-sized at all widths. The component must not impose a fixed width, allowing long or translated copy to wrap naturally without overflow.

## Accessibility

- Use a real `h1`, not a styled generic element.
- Preserve the existing named `main` landmark on Releases.
- Keep the subtitle as visible paragraph content directly after the heading.
- Do not duplicate the page name through hidden text or additional headings.

## Testing

Add focused component coverage that verifies:

1. the supplied title is exposed as a level-one heading;
2. the supplied subtitle is rendered as paragraph text;
3. no release-specific copy is embedded in the reusable component.

Update the Releases page integration coverage to verify that navigating to `/lancamentos` renders the Pencil title and subtitle while preserving the shared Header and mobile navigation.

Run formatting, lint, TypeScript, unit/integration tests, and the production build before completion.

## Acceptance Criteria

- `/lancamentos` displays the exact selected Pencil title and subtitle.
- Typography, colors, spacing, and page padding adapt across mobile, tablet, and desktop as specified.
- `PageHeading` is reusable through required `title` and `subtitle` properties.
- The page exposes exactly one level-one heading.
- Header routing and mobile bottom navigation continue to work.
- No out-of-scope Releases content is added.
- All verification commands pass.
