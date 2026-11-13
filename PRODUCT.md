# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who play games and want to follow upcoming releases, organize personal game lists, and record ratings and reviews.

## Product Purpose

Help players discover upcoming games and keep their personal game activity organized through lists, hype, and reviews.

## Positioning

Zera GameZ combines IGDB release discovery with personal game curation—custom lists, hype, and public or private reviews—in one product. The user confirmed this combination as its differentiator.

## Operating Context

- The product is a Portuguese-language web application.
- Players browse release information and game details, search the catalog, and organize games in their personal collections.
- Authentication supports email codes and Google. Personal features require an authenticated account.
- Production is hosted on Vercel and uses the hosted Supabase project. Development uses a separate local Supabase instance through Docker at no recurring database cost.

## Capabilities and Constraints

- Upcoming release data, game search, and game details come from IGDB.
- Players can create personal lists, including a “Quero jogar” list, and interact with game hype and rankings.
- Reviews support ratings from 1 to 10, written analysis, and public or private visibility. The rating vocabulary includes “Flopou”, “Excelente”, and “GOTY”.
- A dedicated page for discovering public reviews is planned for the future; the current reviews page should not add a public-reviews discovery section before that page is built.
- IGDB credentials and OAuth tokens stay server-side in Vercel Functions; never expose them in the browser bundle.
- Supabase Auth, Postgres, and Row Level Security handle accounts and user-owned data. Production and development databases must remain separate; do not point local development at production.

## Brand Commitments

- Product name: **Zera GameZ**.
- User-facing interface language: Brazilian Portuguese.

## Evidence on Hand

- The repository contains the current Zera GameZ mark and game imagery under `public/assets/images/`.
- The existing README documents the implemented stack, development workflow, IGDB integration, and Supabase setup.

## Product Principles

- Keep game discovery and personal game organization connected in one workflow.
- Let players control whether each review is private or public.
- Keep the distinction between production data and local development data clear and safe.
- Preserve Portuguese terminology in user-facing product flows.
