# IGDB Releases Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Disponibilizar lançamentos futuros consolidados por uma Vercel Function segura e registrar o DTO validado no console da página de lançamentos, sem criar novos componentes visuais.

**Architecture:** Uma função HTTP fina compõe um caso de uso que depende de uma porta ReleaseRepository e de um Clock. Adaptadores isolados cuidam do OAuth Twitch e da consulta IGDB; um contrato Zod compartilhado separa a API própria do formato externo e um cliente/hook React consome somente esse contrato.

**Tech Stack:** Node.js 22.13+, TypeScript 6 estrito, React 19, Vite 8, Vitest 4, Zod 4.4.3, Vercel CLI 58.0.0 e Web APIs fetch/Request/Response.

## Global Constraints

- Usar uma Vercel Function TypeScript nativa no diretório api.
- Manter IGDB_CLIENT_ID, IGDB_CLIENT_SECRET e o token exclusivamente no servidor.
- O período padrão é hoje em America/Sao_Paulo até 90 dias depois; o máximo é 366 dias.
- O limite público padrão é 50 e o máximo é 100 jogos consolidados.
- Priorizar Brasil por jogo/plataforma, usar mundial como fallback e manter somente a data futura mais próxima do jogo.
- Consultar no máximo 500 registros brutos e sinalizar sourceTruncated quando esse teto for atingido.
- Não criar cards, listas visuais, calendário funcional ou filtros interativos nesta etapa.
- Não permitir consulta Apicalypse arbitrária enviada pelo cliente.
- Não fazer rede real nos testes automatizados.
- Preservar a alteração local pré-existente de package-lock.json: 84 linhas libc removidas. Ela não deve ser revertida nem incluída como autoria da integração.
- Seguir TDD: cada comportamento de produção nasce de um teste que falha pela razão esperada.

---

## File Map

- package.json — scripts e dependências diretas.
- package-lock.json — lock de Zod/Vercel, preservando as remoções libc existentes.
- tsconfig.json — referência adicional ao projeto server-side.
- tsconfig.server.json — verificação estrita de api, server e shared.
- eslint.config.js — globals Node para código server-side.
- .env.example — nomes das credenciais sem valores.
- shared/contracts/releases.ts — schemas e tipos do DTO público.
- shared/contracts/releases.test.ts — contrato válido e rejeições.
- server/releases/domain/release.ts — candidatos, itens e consolidação pura.
- server/releases/domain/release.test.ts — regras Brasil/mundial, datas, deduplicação e ordem.
- server/releases/application/releases-query.ts — parsing/defaults de query.
- server/releases/application/releases-query.test.ts — datas, limites, listas e parâmetros desconhecidos.
- server/releases/application/list-upcoming-releases.ts — porta, Clock e caso de uso.
- server/releases/application/list-upcoming-releases.test.ts — integração aplicação/domínio e metadados.
- server/releases/infrastructure/upstream-errors.ts — erros internos tipados.
- server/releases/infrastructure/env.ts — validação das credenciais.
- server/releases/infrastructure/twitch-token-provider.ts — OAuth, expiração e single-flight.
- server/releases/infrastructure/twitch-token-provider.test.ts — comportamento do token.
- server/releases/infrastructure/igdb-release-repository.ts — query, validação, retry e adaptação.
- server/releases/infrastructure/igdb-release-repository.test.ts — contrato da IGDB e falhas externas.
- api/releases.ts — handler, cache, erros e composition root.
- api/releases.test.ts — contrato HTTP.
- src/features/releases/api/releases-client.ts — cliente same-origin.
- src/features/releases/api/releases-client.test.ts — URL, DTO, erros e cancelamento.
- src/features/releases/hooks/use-releases-console.ts — efeito temporário e logger injetável.
- src/features/releases/hooks/use-releases-console.test.tsx — StrictMode, sucesso, erro e unmount.
- src/pages/ReleasesPage.tsx — ativação do hook, sem markup novo.
- src/app/App.test.tsx — garantia de que a rota continua visualmente inalterada.
- README.md — execução local e configuração.

---

### Task 1: Tooling and shared public contract

**Files:**

- Modify: package.json
- Modify: package-lock.json
- Modify: tsconfig.json
- Create: tsconfig.server.json
- Modify: eslint.config.js
- Create: shared/contracts/releases.test.ts
- Create: shared/contracts/releases.ts

**Interfaces:**

- Produces: releasesResponseSchema, apiErrorResponseSchema, ReleasesResponse, ApiErrorResponse e ApiErrorCode.
- Consumes: Zod 4.4.3.

- [ ] **Step 1: Write the failing contract test**

Create shared/contracts/releases.test.ts:

```ts
// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { apiErrorResponseSchema, releasesResponseSchema } from './releases';

const validResponse = {
  data: [
    {
      id: 42,
      slug: 'eclipse-protocol',
      name: 'Eclipse Protocol',
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cover.jpg',
      releaseDate: '2026-08-08',
      platforms: [{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' }],
      genres: [{ id: 12, name: 'Role-playing (RPG)' }],
    },
  ],
  meta: {
    from: '2026-08-07',
    to: '2026-11-05',
    count: 1,
    limit: 50,
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceTruncated: false,
  },
};

describe('releasesResponseSchema', () => {
  it('aceita o DTO público aprovado', () => {
    expect(releasesResponseSchema.parse(validResponse)).toEqual(validResponse);
  });

  it('rejeita data civil inválida e URL não HTTPS', () => {
    const invalid = {
      ...validResponse,
      data: [{ ...validResponse.data[0], releaseDate: '2026-02-30', coverUrl: 'http://cover' }],
    };

    expect(() => releasesResponseSchema.parse(invalid)).toThrow();
  });
});

describe('apiErrorResponseSchema', () => {
  it('rejeita códigos de erro não publicados', () => {
    expect(() =>
      apiErrorResponseSchema.parse({ error: { code: 'IGDB_SECRET', message: 'detalhes' } }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```powershell
npm.cmd test -- shared/contracts/releases.test.ts --run
```

Expected: FAIL because shared/contracts/releases.ts does not exist.

- [ ] **Step 3: Install pinned dependencies and add server tooling**

Run:

```powershell
npm.cmd install zod@4.4.3
npm.cmd install --save-dev vercel@58.0.0
```

Add this package.json script:

```json
"dev:vercel": "vercel dev"
```

Create tsconfig.server.json:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.server.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "types": ["node"]
  },
  "include": ["api", "server", "shared"]
}
```

Set the root references to:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.server.json" }
  ]
}
```

Append this ESLint override after the existing TypeScript block:

```js
{
  files: ['api/**/*.ts', 'server/**/*.ts', 'shared/**/*.ts'],
  languageOptions: {
    globals: globals.node,
  },
},
```

Before staging, run git diff -- package-lock.json and confirm the original libc deletions are still present. When staging package-lock.json, use git add -p and reject hunks that contain only the pre-existing libc deletions; accept the root dependency and newly generated package hunks. Verify with git diff --cached that no libc-only hunk was staged.

- [ ] **Step 4: Implement the shared schemas**

Create shared/contracts/releases.ts:

```ts
import { z } from 'zod';

const civilDateSchema = z.string().refine((value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}, 'Data civil inválida');

const httpsUrlSchema = z.string().url().startsWith('https://');

export const releasePlatformSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  abbreviation: z.string().trim().min(1).nullable(),
});

export const releaseGenreSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
});

export const releaseItemSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  coverUrl: httpsUrlSchema.nullable(),
  releaseDate: civilDateSchema,
  platforms: z.array(releasePlatformSchema).min(1),
  genres: z.array(releaseGenreSchema),
});

export const releasesResponseSchema = z.object({
  data: z.array(releaseItemSchema),
  meta: z.object({
    from: civilDateSchema,
    to: civilDateSchema,
    count: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100),
    generatedAt: z.string().datetime({ offset: true }),
    sourceTruncated: z.boolean(),
  }),
});

export const apiErrorCodes = [
  'INVALID_QUERY',
  'METHOD_NOT_ALLOWED',
  'INVALID_UPSTREAM_RESPONSE',
  'SERVICE_UNAVAILABLE',
  'UPSTREAM_TIMEOUT',
  'INTERNAL_ERROR',
] as const;

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(apiErrorCodes),
    message: z.string().trim().min(1),
  }),
});

export type ReleasesResponse = z.infer<typeof releasesResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type ApiErrorCode = ApiErrorResponse['error']['code'];
```

- [ ] **Step 5: Run focused and static checks**

Run:

```powershell
npm.cmd test -- shared/contracts/releases.test.ts --run
npm.cmd run typecheck
npm.cmd run lint
```

Expected: contract tests PASS; TypeScript and ESLint exit 0.

- [ ] **Step 6: Commit only Task 1-owned changes**

Stage the files listed in Task 1, using partial staging for package-lock.json as described above. Then run:

```powershell
git diff --cached --check
git commit -m "build: prepare IGDB server integration"
```

Expected: the dependency/configuration commit succeeds and git diff -- package-lock.json still shows the user's libc-only working-tree changes.

---

### Task 2: Pure release consolidation domain

**Files:**

- Create: server/releases/domain/release.test.ts
- Create: server/releases/domain/release.ts

**Interfaces:**

- Produces: CandidateRelease, ReleaseItem and consolidateReleases(candidates, limit).
- Consumes: ReleaseItem type from shared/contracts/releases.ts.

- [ ] **Step 1: Write failing domain tests**

Create server/releases/domain/release.test.ts with a helper candidate(overrides) and these exact cases:

```ts
// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { consolidateReleases, type CandidateRelease } from './release';

function candidate(overrides: Partial<CandidateRelease> = {}): CandidateRelease {
  return {
    game: {
      id: 1,
      slug: 'game',
      name: 'Game',
      coverUrl: null,
      genres: [{ id: 12, name: 'RPG' }],
    },
    platform: { id: 6, name: 'PC', abbreviation: 'PC' },
    releaseDate: '2026-08-10',
    region: 'worldwide',
    ...overrides,
  };
}

describe('consolidateReleases', () => {
  it('prioriza Brasil por jogo e plataforma mesmo quando a data mundial é anterior', () => {
    const result = consolidateReleases(
      [
        candidate({ releaseDate: '2026-08-08', region: 'worldwide' }),
        candidate({ releaseDate: '2026-08-10', region: 'brazil' }),
      ],
      50,
    );

    expect(result[0]?.releaseDate).toBe('2026-08-10');
  });

  it('reúne plataformas da menor data selecionada e ignora plataformas posteriores', () => {
    const result = consolidateReleases(
      [
        candidate(),
        candidate({
          platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
          region: 'brazil',
        }),
        candidate({
          platform: { id: 169, name: 'Xbox Series X|S', abbreviation: 'Series' },
          releaseDate: '2026-08-12',
          region: 'brazil',
        }),
      ],
      50,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.platforms.map(({ id }) => id)).toEqual([6, 167]);
  });

  it('deduplica, ordena deterministicamente e aplica limite depois de consolidar', () => {
    const secondGame = candidate({
      game: { id: 2, slug: 'alpha', name: 'Alpha', coverUrl: null, genres: [] },
    });

    const input = [candidate(), candidate(), secondGame];
    const snapshot = structuredClone(input);
    const result = consolidateReleases(input, 1);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Alpha');
    expect(input).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run and verify the missing implementation failure**

Run:

```powershell
npm.cmd test -- server/releases/domain/release.test.ts --run
```

Expected: FAIL because server/releases/domain/release.ts is missing.

- [ ] **Step 3: Implement the minimal pure algorithm**

Create server/releases/domain/release.ts with:

```ts
import type { ReleasesResponse } from '../../../shared/contracts/releases';

export type ReleaseItem = ReleasesResponse['data'][number];

export interface CandidateRelease {
  game: Omit<ReleaseItem, 'releaseDate' | 'platforms'>;
  platform: ReleaseItem['platforms'][number];
  releaseDate: string;
  region: 'brazil' | 'worldwide';
}

function compareName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name, 'pt-BR');
}

function preferCandidate(current: CandidateRelease | undefined, next: CandidateRelease) {
  if (!current) return next;
  if (current.region !== next.region) return next.region === 'brazil' ? next : current;
  return next.releaseDate < current.releaseDate ? next : current;
}

export function consolidateReleases(candidates: readonly CandidateRelease[], limit: number) {
  const byGameAndPlatform = new Map<string, CandidateRelease>();

  for (const candidate of candidates) {
    const key = String(candidate.game.id) + ':' + String(candidate.platform.id);
    byGameAndPlatform.set(key, preferCandidate(byGameAndPlatform.get(key), candidate));
  }

  const byGame = new Map<number, CandidateRelease[]>();
  for (const candidate of byGameAndPlatform.values()) {
    const entries = byGame.get(candidate.game.id) ?? [];
    entries.push(candidate);
    byGame.set(candidate.game.id, entries);
  }

  const releases: ReleaseItem[] = [];
  for (const entries of byGame.values()) {
    const releaseDate = entries.reduce(
      (earliest, entry) => (entry.releaseDate < earliest ? entry.releaseDate : earliest),
      entries[0]!.releaseDate,
    );
    const selected = entries.filter((entry) => entry.releaseDate === releaseDate);
    const game = selected[0]!.game;
    const platforms = [
      ...new Map(selected.map(({ platform }) => [platform.id, platform])).values(),
    ];
    const genres = [...new Map(game.genres.map((genre) => [genre.id, genre])).values()];

    releases.push({
      ...game,
      genres: genres.sort(compareName),
      platforms: platforms.sort(compareName),
      releaseDate,
    });
  }

  return releases
    .sort(
      (left, right) =>
        left.releaseDate.localeCompare(right.releaseDate) || compareName(left, right),
    )
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the domain tests**

Run:

```powershell
npm.cmd test -- server/releases/domain/release.test.ts --run
```

Expected: all domain cases PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/releases/domain
git commit -m "feat: consolidate upcoming game releases"
```

---

### Task 3: Query parsing and application use case

**Files:**

- Create: server/releases/application/releases-query.test.ts
- Create: server/releases/application/releases-query.ts
- Create: server/releases/application/list-upcoming-releases.test.ts
- Create: server/releases/application/list-upcoming-releases.ts

**Interfaces:**

- Produces: ReleaseQuery, InvalidQueryError, parseReleasesQuery(searchParams, clock), Clock, ReleaseRepository and listUpcomingReleases(query, dependencies).
- Consumes: CandidateRelease, consolidateReleases and ReleasesResponse.

- [ ] **Step 1: Write failing query parser tests**

Create releases-query.test.ts:

```ts
// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { InvalidQueryError, parseReleasesQuery } from './releases-query';

const clock = { now: () => new Date('2026-08-08T02:30:00.000Z') };

describe('parseReleasesQuery', () => {
  it('usa a data de São Paulo, 90 dias e limite 50 como defaults', () => {
    expect(parseReleasesQuery(new URLSearchParams(), clock)).toEqual({
      from: '2026-08-07',
      to: '2026-11-05',
      limit: 50,
      platformIds: [],
      genreIds: [],
    });
  });

  it('aceita período, limite, plataformas e gêneros válidos', () => {
    expect(
      parseReleasesQuery(
        new URLSearchParams('from=2026-08-10&to=2026-08-20&limit=25&platforms=6,167&genres=12'),
        clock,
      ),
    ).toEqual({
      from: '2026-08-10',
      to: '2026-08-20',
      limit: 25,
      platformIds: [6, 167],
      genreIds: [12],
    });
  });

  it.each([
    'from=2026-02-30',
    'from=2026-08-10&to=2026-08-09',
    'from=2026-01-01&to=2027-01-03',
    'limit=0',
    'limit=101',
    'limit=abc',
    'platforms=6,6',
    'genres=0',
    'limit=1&limit=2',
    'unknown=1',
  ])('rejeita query inválida: %s', (query) => {
    expect(() => parseReleasesQuery(new URLSearchParams(query), clock)).toThrow(InvalidQueryError);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd test -- server/releases/application/releases-query.test.ts --run
```

Expected: FAIL because parseReleasesQuery is unavailable.

- [ ] **Step 3: Implement query parsing**

Create releases-query.ts with:

```ts
import type { Clock } from './list-upcoming-releases';

export interface ReleaseQuery {
  from: string;
  to: string;
  limit: number;
  platformIds: number[];
  genreIds: number[];
}

export class InvalidQueryError extends Error {}

const allowedKeys = new Set(['from', 'to', 'limit', 'platforms', 'genres']);

function parseCivilDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new InvalidQueryError('Data inválida.');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new InvalidQueryError('Data inválida.');
  return value;
}

function addDays(value: string, days: number) {
  const date = new Date(value + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateInSaoPaulo(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return values.year + '-' + values.month + '-' + values.day;
}

function parseIdList(value: string | null) {
  if (value === null) return [];
  if (!/^\d+(,\d+)*$/.test(value)) throw new InvalidQueryError('Lista de IDs inválida.');
  const ids = value.split(',').map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    throw new InvalidQueryError('Lista de IDs inválida.');
  }
  return ids;
}

export function parseReleasesQuery(params: URLSearchParams, clock: Clock): ReleaseQuery {
  for (const key of params.keys()) {
    if (!allowedKeys.has(key) || params.getAll(key).length !== 1) {
      throw new InvalidQueryError('Parâmetro inválido.');
    }
  }

  const from = parseCivilDate(params.get('from') ?? dateInSaoPaulo(clock.now()));
  const to = parseCivilDate(params.get('to') ?? addDays(from, 90));
  const difference = (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000;
  if (difference < 0 || difference > 366) throw new InvalidQueryError('Período inválido.');

  const limitValue = params.get('limit') ?? '50';
  if (!/^\d+$/.test(limitValue)) throw new InvalidQueryError('Limite inválido.');
  const limit = Number(limitValue);
  if (limit < 1 || limit > 100) throw new InvalidQueryError('Limite inválido.');

  return {
    from,
    to,
    limit,
    platformIds: parseIdList(params.get('platforms')),
    genreIds: parseIdList(params.get('genres')),
  };
}

export { addDays };
```

- [ ] **Step 4: Write the failing use-case test**

Create list-upcoming-releases.test.ts:

```ts
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { listUpcomingReleases, type Clock, type ReleaseRepository } from './list-upcoming-releases';

import type { CandidateRelease } from '../domain/release';
import type { ReleaseQuery } from './releases-query';

const query: ReleaseQuery = {
  from: '2026-08-07',
  to: '2026-11-05',
  limit: 1,
  platformIds: [],
  genreIds: [],
};
const clock: Clock = { now: () => new Date('2026-08-07T12:00:00.000Z') };
const candidates: CandidateRelease[] = [
  {
    game: { id: 2, slug: 'zeta', name: 'Zeta', coverUrl: null, genres: [] },
    platform: { id: 6, name: 'PC', abbreviation: 'PC' },
    releaseDate: '2026-08-08',
    region: 'worldwide',
  },
  {
    game: { id: 1, slug: 'alpha', name: 'Alpha', coverUrl: null, genres: [] },
    platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
    releaseDate: '2026-08-08',
    region: 'brazil',
  },
];

describe('listUpcomingReleases', () => {
  it('consulta a porta, consolida e cria os metadados públicos', async () => {
    const findUpcoming = vi.fn<ReleaseRepository['findUpcoming']>().mockResolvedValue({
      candidates,
      sourceTruncated: true,
    });

    const response = await listUpcomingReleases(query, {
      clock,
      repository: { findUpcoming },
    });

    expect(findUpcoming).toHaveBeenCalledWith(query);
    expect(response.data.map(({ name }) => name)).toEqual(['Alpha']);
    expect(response.meta).toEqual({
      from: query.from,
      to: query.to,
      count: 1,
      limit: 1,
      generatedAt: '2026-08-07T12:00:00.000Z',
      sourceTruncated: true,
    });
  });
});
```

- [ ] **Step 5: Run and verify failure**

```powershell
npm.cmd test -- server/releases/application/list-upcoming-releases.test.ts --run
```

Expected: FAIL because the use case is missing.

- [ ] **Step 6: Implement the use case and ports**

Create list-upcoming-releases.ts:

```ts
import { consolidateReleases, type CandidateRelease } from '../domain/release';

import type { ReleasesResponse } from '../../../shared/contracts/releases';
import type { ReleaseQuery } from './releases-query';

export interface Clock {
  now(): Date;
}

export interface ReleaseRepositoryResult {
  candidates: CandidateRelease[];
  sourceTruncated: boolean;
}

export interface ReleaseRepository {
  findUpcoming(query: ReleaseQuery): Promise<ReleaseRepositoryResult>;
}

export interface ListUpcomingReleasesDependencies {
  clock: Clock;
  repository: ReleaseRepository;
}

export async function listUpcomingReleases(
  query: ReleaseQuery,
  dependencies: ListUpcomingReleasesDependencies,
): Promise<ReleasesResponse> {
  const result = await dependencies.repository.findUpcoming(query);
  const data = consolidateReleases(result.candidates, query.limit);

  return {
    data,
    meta: {
      from: query.from,
      to: query.to,
      count: data.length,
      limit: query.limit,
      generatedAt: dependencies.clock.now().toISOString(),
      sourceTruncated: result.sourceTruncated,
    },
  };
}
```

- [ ] **Step 7: Run focused tests and commit**

```powershell
npm.cmd test -- server/releases/application --run
git add server/releases/application
git commit -m "feat: add upcoming releases use case"
```

---

### Task 4: OAuth token provider

**Files:**

- Create: server/releases/infrastructure/upstream-errors.ts
- Create: server/releases/infrastructure/env.ts
- Create: server/releases/infrastructure/twitch-token-provider.test.ts
- Create: server/releases/infrastructure/twitch-token-provider.ts

**Interfaces:**

- Produces: IgdbEnvironment, readIgdbEnvironment, AccessTokenProvider, TwitchTokenProvider, InvalidUpstreamResponseError, ServiceUnavailableError e UpstreamTimeoutError.
- Consumes: fetch, Clock and environment variables.

- [ ] **Step 1: Write failing token-provider tests**

Create twitch-token-provider.test.ts. The file uses this setup and tests:

```ts
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { readIgdbEnvironment } from './env';
import { TwitchTokenProvider } from './twitch-token-provider';
import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from './upstream-errors';

function tokenResponse(token = 'token', expiresIn = 3_600) {
  return Response.json({ access_token: token, expires_in: expiresIn, token_type: 'bearer' });
}

function setup(fetcher: typeof fetch, initial = '2026-08-07T12:00:00.000Z') {
  let now = new Date(initial);
  const provider = new TwitchTokenProvider({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    clock: { now: () => now },
    fetcher,
  });
  return {
    provider,
    advance: (milliseconds: number) => (now = new Date(now.getTime() + milliseconds)),
  };
}

describe('readIgdbEnvironment', () => {
  it('retorna somente as credenciais validadas', () => {
    expect(
      readIgdbEnvironment({
        IGDB_CLIENT_ID: 'client-id',
        IGDB_CLIENT_SECRET: 'client-secret',
      }),
    ).toEqual({ clientId: 'client-id', clientSecret: 'client-secret' });
  });

  it('rejeita configuração incompleta sem expor valores', () => {
    expect(() =>
      readIgdbEnvironment({
        IGDB_CLIENT_ID: '',
        IGDB_CLIENT_SECRET: 'raw-secret',
      }),
    ).toThrow(ServiceUnavailableError);
    try {
      readIgdbEnvironment({ IGDB_CLIENT_ID: '', IGDB_CLIENT_SECRET: 'raw-secret' });
    } catch (error) {
      expect(String(error)).not.toContain('raw-secret');
    }
  });
});

describe('TwitchTokenProvider', () => {
  it('envia credenciais no formulário e reutiliza o token válido', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(tokenResponse());
    const { provider } = setup(fetcher);

    await expect(provider.getToken()).resolves.toBe('token');
    await expect(provider.getToken()).resolves.toBe('token');

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe('https://id.twitch.tv/oauth2/token');
    expect(String(url)).not.toContain('client-secret');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(String(init?.body)).toBe(
      'client_id=client-id&client_secret=client-secret&grant_type=client_credentials',
    );
  });

  it('compartilha a renovação simultânea', async () => {
    let resolveResponse!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => (resolveResponse = resolve));
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(pending);
    const { provider } = setup(fetcher);

    const first = provider.getToken();
    const second = provider.getToken();
    resolveResponse(tokenResponse());

    await expect(Promise.all([first, second])).resolves.toEqual(['token', 'token']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('renova na margem de segurança e após invalidação', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse('first', 120))
      .mockResolvedValueOnce(tokenResponse('second', 120))
      .mockResolvedValueOnce(tokenResponse('third', 120));
    const { provider, advance } = setup(fetcher);

    await expect(provider.getToken()).resolves.toBe('first');
    advance(60_000);
    await expect(provider.getToken()).resolves.toBe('second');
    provider.invalidate();
    await expect(provider.getToken()).resolves.toBe('third');
  });

  it.each([
    {
      response: new Response('{', { status: 200 }),
      error: InvalidUpstreamResponseError,
    },
    {
      response: new Response(null, { status: 503 }),
      error: ServiceUnavailableError,
    },
  ])('normaliza resposta OAuth inválida', async ({ response, error }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(setup(fetcher).provider.getToken()).rejects.toBeInstanceOf(error);
  });

  it('normaliza timeout', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('timeout', 'TimeoutError'));

    await expect(setup(fetcher).provider.getToken()).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd test -- server/releases/infrastructure/twitch-token-provider.test.ts --run
```

Expected: FAIL because TwitchTokenProvider is missing.

- [ ] **Step 3: Implement typed errors and environment validation**

Create upstream-errors.ts:

```ts
export class InvalidUpstreamResponseError extends Error {}
export class ServiceUnavailableError extends Error {}
export class UpstreamTimeoutError extends Error {}

export function isTimeoutError(error: unknown) {
  return error instanceof DOMException && error.name === 'TimeoutError';
}
```

Create env.ts:

```ts
import { z } from 'zod';

import { ServiceUnavailableError } from './upstream-errors';

const environmentSchema = z.object({
  IGDB_CLIENT_ID: z.string().trim().min(1),
  IGDB_CLIENT_SECRET: z.string().trim().min(1),
});

export interface IgdbEnvironment {
  clientId: string;
  clientSecret: string;
}

export function readIgdbEnvironment(environment: NodeJS.ProcessEnv): IgdbEnvironment {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new ServiceUnavailableError('Configuração da integração indisponível.');
  }
  return {
    clientId: result.data.IGDB_CLIENT_ID,
    clientSecret: result.data.IGDB_CLIENT_SECRET,
  };
}
```

- [ ] **Step 4: Implement the token provider**

Create twitch-token-provider.ts with the complete provider:

```ts
import { z } from 'zod';

import {
  InvalidUpstreamResponseError,
  isTimeoutError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from './upstream-errors';

import type { Clock } from '../application/list-upcoming-releases';

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.literal('bearer'),
});

export interface AccessTokenProvider {
  getToken(): Promise<string>;
  invalidate(): void;
}

interface TwitchTokenProviderOptions {
  clientId: string;
  clientSecret: string;
  clock: Clock;
  fetcher: typeof fetch;
  timeoutMs?: number;
}

export class TwitchTokenProvider implements AccessTokenProvider {
  private cachedToken?: { token: string; expiresAt: number };
  private readonly options: TwitchTokenProviderOptions;
  private pendingToken?: Promise<string>;

  constructor(options: TwitchTokenProviderOptions) {
    this.options = options;
  }

  getToken() {
    if (this.cachedToken && this.options.clock.now().getTime() < this.cachedToken.expiresAt) {
      return Promise.resolve(this.cachedToken.token);
    }
    if (!this.pendingToken) {
      this.pendingToken = this.requestToken().finally(() => {
        this.pendingToken = undefined;
      });
    }
    return this.pendingToken;
  }

  invalidate() {
    this.cachedToken = undefined;
  }

  private async requestToken() {
    const body = new URLSearchParams({
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      grant_type: 'client_credentials',
    });

    let response: Response;
    try {
      response = await this.options.fetcher('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 5_000),
      });
    } catch (error) {
      if (isTimeoutError(error)) throw new UpstreamTimeoutError('OAuth excedeu o timeout.');
      throw new ServiceUnavailableError('OAuth indisponível.');
    }

    if (!response.ok) throw new ServiceUnavailableError('OAuth indisponível.');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new InvalidUpstreamResponseError('Resposta OAuth inválida.');
    }

    const result = tokenResponseSchema.safeParse(payload);
    if (!result.success) throw new InvalidUpstreamResponseError('Resposta OAuth inválida.');

    this.cachedToken = {
      token: result.data.access_token,
      expiresAt: this.options.clock.now().getTime() + result.data.expires_in * 1_000 - 60_000,
    };
    return this.cachedToken.token;
  }
}
```

- [ ] **Step 5: Run tests and commit**

```powershell
npm.cmd test -- server/releases/infrastructure/twitch-token-provider.test.ts --run
git add server/releases/infrastructure/upstream-errors.ts server/releases/infrastructure/env.ts server/releases/infrastructure/twitch-token-provider.ts server/releases/infrastructure/twitch-token-provider.test.ts
git commit -m "feat: manage IGDB OAuth tokens"
```

---

### Task 5: IGDB release repository

**Files:**

- Create: server/releases/infrastructure/igdb-release-repository.test.ts
- Create: server/releases/infrastructure/igdb-release-repository.ts

**Interfaces:**

- Produces: IgdbReleaseRepository implementing ReleaseRepository.
- Consumes: AccessTokenProvider, fetch and ReleaseQuery.

- [ ] **Step 1: Write failing repository tests**

Create igdb-release-repository.test.ts:

```ts
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { IgdbReleaseRepository } from './igdb-release-repository';
import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from './upstream-errors';

import type { ReleaseQuery } from '../application/releases-query';

const query: ReleaseQuery = {
  from: '2026-08-07',
  to: '2026-08-10',
  limit: 50,
  platformIds: [6, 167],
  genreIds: [12],
};
const fixture = {
  id: 100,
  date: Date.parse('2026-08-08T00:00:00Z') / 1_000,
  release_region: { id: 10, region: 'brazil' },
  game: {
    id: 1,
    name: 'Game',
    slug: 'game',
    cover: { image_id: 'cover-id' },
    genres: [{ id: 12, name: 'RPG' }],
  },
  platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
};

function setup(fetcher: typeof fetch) {
  const tokenProvider = {
    getToken: vi.fn().mockResolvedValue('token'),
    invalidate: vi.fn(),
  };
  return {
    repository: new IgdbReleaseRepository({
      clientId: 'client-id',
      fetcher,
      tokenProvider,
    }),
    tokenProvider,
  };
}

describe('IgdbReleaseRepository', () => {
  it('envia a consulta fixa e converte a resposta externa', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([fixture]));
    const { repository } = setup(fetcher);

    const result = await repository.findUpcoming(query);

    const [url, init] = fetcher.mock.calls[0]!;
    const body = String(init?.body);
    expect(url).toBe('https://api.igdb.com/v4/release_dates');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer token',
      'Client-ID': 'client-id',
    });
    expect(body).toContain('date_format = 0');
    expect(body).toContain('release_region = (8,10)');
    expect(body).toContain('platform = (6,167)');
    expect(body).toContain('game.genres = (12)');
    expect(body).toContain('sort date asc;');
    expect(body).toContain('limit 500;');
    expect(result).toEqual({
      candidates: [
        {
          game: {
            id: 1,
            name: 'Game',
            slug: 'game',
            coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cover-id.jpg',
            genres: [{ id: 12, name: 'RPG' }],
          },
          platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
          releaseDate: '2026-08-08',
          region: 'brazil',
        },
      ],
      sourceTruncated: false,
    });
  });

  it('sinaliza o teto bruto de 500 registros', async () => {
    const payload = Array.from({ length: 500 }, (_, index) => ({ ...fixture, id: index + 1 }));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload));

    await expect(setup(fetcher).repository.findUpcoming(query)).resolves.toMatchObject({
      sourceTruncated: true,
    });
  });

  it('invalida o token e repete uma vez após 401', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json([fixture]));
    const { repository, tokenProvider } = setup(fetcher);
    tokenProvider.getToken.mockResolvedValueOnce('old').mockResolvedValueOnce('new');

    await repository.findUpcoming(query);

    expect(tokenProvider.invalidate).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([401, 429, 500])('normaliza status externo %i', async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    await expect(setup(fetcher).repository.findUpcoming(query)).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    expect(fetcher).toHaveBeenCalledTimes(status === 401 ? 2 : 1);
  });

  it('rejeita JSON externo inválido', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{', { status: 200 }));
    await expect(setup(fetcher).repository.findUpcoming(query)).rejects.toBeInstanceOf(
      InvalidUpstreamResponseError,
    );
  });

  it('normaliza timeout', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    await expect(setup(fetcher).repository.findUpcoming(query)).rejects.toBeInstanceOf(
      UpstreamTimeoutError,
    );
  });
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd test -- server/releases/infrastructure/igdb-release-repository.test.ts --run
```

Expected: FAIL because IgdbReleaseRepository is missing.

- [ ] **Step 3: Implement the upstream schema and query builder**

Start igdb-release-repository.ts with the imports, upstream schema and controlled query builder:

```ts
import { z } from 'zod';

import { addDays, type ReleaseQuery } from '../application/releases-query';

import {
  InvalidUpstreamResponseError,
  isTimeoutError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from './upstream-errors';

import type {
  ReleaseRepository,
  ReleaseRepositoryResult,
} from '../application/list-upcoming-releases';
import type { CandidateRelease } from '../domain/release';
import type { AccessTokenProvider } from './twitch-token-provider';

const igdbReleaseSchema = z.object({
  id: z.number().int().positive(),
  date: z.number().int().nonnegative(),
  release_region: z.object({
    id: z.union([z.literal(8), z.literal(10)]),
    region: z.enum(['worldwide', 'brazil']),
  }),
  game: z.object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    cover: z.object({ image_id: z.string().trim().min(1) }).optional(),
    genres: z
      .array(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(1),
        }),
      )
      .optional(),
  }),
  platform: z.object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1),
    abbreviation: z.string().trim().min(1).optional(),
  }),
});

const igdbReleasesSchema = z.array(igdbReleaseSchema);
const fields = [
  'date',
  'release_region.id',
  'release_region.region',
  'game.id',
  'game.name',
  'game.slug',
  'game.cover.image_id',
  'game.genres.id',
  'game.genres.name',
  'platform.id',
  'platform.name',
  'platform.abbreviation',
].join(',');

function unixSeconds(date: string) {
  return Math.floor(Date.parse(date + 'T00:00:00.000Z') / 1_000);
}

function buildQuery(query: ReleaseQuery) {
  const filters = [
    'date >= ' + String(unixSeconds(query.from)),
    'date < ' + String(unixSeconds(addDays(query.to, 1))),
    'date_format = 0',
    'release_region = (8,10)',
  ];
  if (query.platformIds.length > 0) {
    filters.push('platform = (' + query.platformIds.join(',') + ')');
  }
  if (query.genreIds.length > 0) {
    filters.push('game.genres = (' + query.genreIds.join(',') + ')');
  }
  return [
    'fields ' + fields + ';',
    'where ' + filters.join(' & ') + ';',
    'sort date asc;',
    'limit 500;',
  ].join('\n');
}
```

The builder receives only the already validated ReleaseQuery. It never receives or concatenates raw URLSearchParams values.

- [ ] **Step 4: Implement request, retry and mapping**

Append the complete repository implementation:

```ts
interface IgdbReleaseRepositoryOptions {
  clientId: string;
  fetcher: typeof fetch;
  tokenProvider: AccessTokenProvider;
  timeoutMs?: number;
}

export class IgdbReleaseRepository implements ReleaseRepository {
  private readonly options: IgdbReleaseRepositoryOptions;

  constructor(options: IgdbReleaseRepositoryOptions) {
    this.options = options;
  }

  async findUpcoming(query: ReleaseQuery): Promise<ReleaseRepositoryResult> {
    let response = await this.request(query);
    if (response.status === 401) {
      this.options.tokenProvider.invalidate();
      response = await this.request(query);
    }

    if (response.status === 401 || !response.ok) {
      throw new ServiceUnavailableError('IGDB indisponível.');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new InvalidUpstreamResponseError('Resposta IGDB inválida.');
    }

    const result = igdbReleasesSchema.safeParse(payload);
    if (!result.success) throw new InvalidUpstreamResponseError('Resposta IGDB inválida.');

    return {
      candidates: result.data.map((entry): CandidateRelease => ({
        game: {
          id: entry.game.id,
          slug: entry.game.slug,
          name: entry.game.name,
          coverUrl: entry.game.cover
            ? 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/' +
              encodeURIComponent(entry.game.cover.image_id) +
              '.jpg'
            : null,
          genres: entry.game.genres ?? [],
        },
        platform: {
          id: entry.platform.id,
          name: entry.platform.name,
          abbreviation: entry.platform.abbreviation ?? null,
        },
        releaseDate: new Date(entry.date * 1_000).toISOString().slice(0, 10),
        region: entry.release_region.region,
      })),
      sourceTruncated: result.data.length === 500,
    };
  }

  private async request(query: ReleaseQuery) {
    const token = await this.options.tokenProvider.getToken();
    try {
      return await this.options.fetcher('https://api.igdb.com/v4/release_dates', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + token,
          'Client-ID': this.options.clientId,
        },
        body: buildQuery(query),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      });
    } catch (error) {
      if (isTimeoutError(error)) throw new UpstreamTimeoutError('IGDB excedeu o timeout.');
      throw new ServiceUnavailableError('IGDB indisponível.');
    }
  }
}
```

The first 401 invalidates the token; the second is mapped without further retry. All non-2xx statuses, including 429, become ServiceUnavailableError.

- [ ] **Step 5: Run tests and commit**

```powershell
npm.cmd test -- server/releases/infrastructure/igdb-release-repository.test.ts --run
git add server/releases/infrastructure/igdb-release-repository.ts server/releases/infrastructure/igdb-release-repository.test.ts
git commit -m "feat: fetch release dates from IGDB"
```

---

### Task 6: Vercel HTTP function and composition root

**Files:**

- Create: api/releases.test.ts
- Create: api/releases.ts
- Modify: vercel.json only if a focused local/deployment test proves the SPA rewrite shadows api/releases.

**Interfaces:**

- Produces: handleReleasesRequest(request, dependencies) and default Vercel fetch export.
- Consumes: parseReleasesQuery, listUpcomingReleases, environment, token provider and repository.

- [ ] **Step 1: Write failing handler tests**

Create api/releases.test.ts:

```ts
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from '../server/releases/infrastructure/upstream-errors';
import { apiErrorResponseSchema, type ReleasesResponse } from '../shared/contracts/releases';

import { handleReleasesRequest, type ReleaseHandlerDependencies } from './releases';

const response: ReleasesResponse = {
  data: [],
  meta: {
    from: '2026-08-07',
    to: '2026-11-05',
    count: 0,
    limit: 50,
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceTruncated: false,
  },
};

function setup(load = vi.fn().mockResolvedValue(response)): ReleaseHandlerDependencies {
  return {
    clock: { now: () => new Date('2026-08-07T12:00:00.000Z') },
    load,
  };
}

describe('handleReleasesRequest', () => {
  it('rejeita método antes de carregar dependências externas', async () => {
    const dependencies = setup();
    const result = await handleReleasesRequest(
      new Request('https://zera.test/api/releases', { method: 'POST' }),
      dependencies,
    );

    expect(result.status).toBe(405);
    expect(result.headers.get('allow')).toBe('GET');
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(dependencies.load).not.toHaveBeenCalled();
  });

  it('rejeita query inválida', async () => {
    const result = await handleReleasesRequest(
      new Request('https://zera.test/api/releases?limit=101'),
      setup(),
    );
    const body = await result.json();

    expect(result.status).toBe(400);
    expect(apiErrorResponseSchema.parse(body).error.code).toBe('INVALID_QUERY');
    expect(result.headers.get('cache-control')).toBe('no-store');
  });

  it('retorna DTO validado e cache somente na CDN', async () => {
    const result = await handleReleasesRequest(
      new Request('https://zera.test/api/releases'),
      setup(),
    );

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(response);
    expect(result.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(result.headers.get('vercel-cdn-cache-control')).toBe(
      'public, max-age=900, stale-while-revalidate=3600',
    );
  });

  it.each([
    [new InvalidUpstreamResponseError('secret'), 502, 'INVALID_UPSTREAM_RESPONSE'],
    [new ServiceUnavailableError('secret'), 503, 'SERVICE_UNAVAILABLE'],
    [new UpstreamTimeoutError('secret'), 504, 'UPSTREAM_TIMEOUT'],
    [new Error('secret'), 500, 'INTERNAL_ERROR'],
  ] as const)('normaliza erro sem expor detalhes', async (error, status, code) => {
    const result = await handleReleasesRequest(
      new Request('https://zera.test/api/releases'),
      setup(vi.fn().mockRejectedValue(error)),
    );
    const body = apiErrorResponseSchema.parse(await result.json());

    expect(result.status).toBe(status);
    expect(body.error.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd test -- api/releases.test.ts --run
```

Expected: FAIL because api/releases.ts is missing.

- [ ] **Step 3: Implement the injectable handler**

Create api/releases.ts with the injectable HTTP layer:

```ts
import {
  listUpcomingReleases,
  type Clock,
  type ListUpcomingReleasesDependencies,
} from '../server/releases/application/list-upcoming-releases';
import {
  InvalidQueryError,
  parseReleasesQuery,
  type ReleaseQuery,
} from '../server/releases/application/releases-query';
import { readIgdbEnvironment } from '../server/releases/infrastructure/env';
import { IgdbReleaseRepository } from '../server/releases/infrastructure/igdb-release-repository';
import { TwitchTokenProvider } from '../server/releases/infrastructure/twitch-token-provider';
import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from '../server/releases/infrastructure/upstream-errors';
import {
  apiErrorResponseSchema,
  releasesResponseSchema,
  type ApiErrorCode,
  type ReleasesResponse,
} from '../shared/contracts/releases';

const successHeaders = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Content-Type': 'application/json; charset=utf-8',
  'Vercel-CDN-Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
};

const errorHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

export interface ReleaseHandlerDependencies {
  clock: Clock;
  load(query: ReleaseQuery): Promise<ReleasesResponse>;
}

function json(payload: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(status: number, code: ApiErrorCode, message: string) {
  const payload = apiErrorResponseSchema.parse({ error: { code, message } });
  return json(payload, status, errorHeaders);
}

export async function handleReleasesRequest(
  request: Request,
  dependencies: ReleaseHandlerDependencies,
) {
  if (request.method !== 'GET') {
    const response = errorResponse(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    response.headers.set('Allow', 'GET');
    return response;
  }

  try {
    const query = parseReleasesQuery(new URL(request.url).searchParams, dependencies.clock);
    const payload = releasesResponseSchema.parse(await dependencies.load(query));
    return json(payload, 200, successHeaders);
  } catch (error) {
    if (error instanceof InvalidQueryError) {
      return errorResponse(400, 'INVALID_QUERY', 'Parâmetros inválidos.');
    }
    if (error instanceof InvalidUpstreamResponseError) {
      return errorResponse(502, 'INVALID_UPSTREAM_RESPONSE', 'Resposta externa inválida.');
    }
    if (error instanceof UpstreamTimeoutError) {
      return errorResponse(504, 'UPSTREAM_TIMEOUT', 'Serviço externo excedeu o tempo limite.');
    }
    if (error instanceof ServiceUnavailableError) {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível.');
    }
    return errorResponse(500, 'INTERNAL_ERROR', 'Erro interno.');
  }
}
```

The handler validates method and query before invoking load. It validates the application response again before serialization and never returns the caught error message.

- [ ] **Step 4: Add lazy production composition**

Append the lazy production composition. Environment variables are not read until a valid GET invokes load:

```ts
const systemClock: Clock = {
  now: () => new Date(),
};

let productionDependencies: ListUpcomingReleasesDependencies | undefined;

function getProductionDependencies() {
  if (productionDependencies) return productionDependencies;

  const environment = readIgdbEnvironment(process.env);
  const tokenProvider = new TwitchTokenProvider({
    clientId: environment.clientId,
    clientSecret: environment.clientSecret,
    clock: systemClock,
    fetcher: fetch,
  });
  productionDependencies = {
    clock: systemClock,
    repository: new IgdbReleaseRepository({
      clientId: environment.clientId,
      fetcher: fetch,
      tokenProvider,
    }),
  };
  return productionDependencies;
}

const productionHandlerDependencies: ReleaseHandlerDependencies = {
  clock: systemClock,
  load: (query) => listUpcomingReleases(query, getProductionDependencies()),
};

export default {
  fetch(request: Request) {
    return handleReleasesRequest(request, productionHandlerDependencies);
  },
};
```

- [ ] **Step 5: Run handler and server checks**

```powershell
npm.cmd test -- api/releases.test.ts --run
npm.cmd exec tsc -- -p tsconfig.server.json --pretty false
npm.cmd run lint
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add api server/releases shared/contracts vercel.json tsconfig.server.json tsconfig.json eslint.config.js
git commit -m "feat: expose releases Vercel function"
```

Stage vercel.json only if it actually required a fix.

---

### Task 7: Frontend API client and console probe

**Files:**

- Create: src/features/releases/api/releases-client.test.ts
- Create: src/features/releases/api/releases-client.ts
- Create: src/features/releases/hooks/use-releases-console.test.tsx
- Create: src/features/releases/hooks/use-releases-console.ts
- Modify: src/pages/ReleasesPage.tsx
- Modify: src/app/App.test.tsx

**Interfaces:**

- Produces: fetchReleases(query, options), ReleasesClientError and useReleasesConsole(dependencies?).
- Consumes: ReleasesResponse from shared/contracts/releases.ts and GET /api/releases.

- [ ] **Step 1: Write failing client tests**

Create releases-client.test.ts:

```ts
import { describe, expect, it, vi } from 'vitest';

import { fetchReleases } from './releases-client';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

const payload: ReleasesResponse = {
  data: [],
  meta: {
    from: '2026-08-07',
    to: '2026-11-05',
    count: 0,
    limit: 50,
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceTruncated: false,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('fetchReleases', () => {
  it('consulta a rota padrão e retorna DTO validado', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload));

    await expect(fetchReleases({}, { fetcher })).resolves.toEqual(payload);
    expect(fetcher).toHaveBeenCalledWith('/api/releases', {
      headers: { Accept: 'application/json' },
      signal: undefined,
    });
  });

  it('serializa filtros em ordem fixa e encaminha AbortSignal', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload));
    const controller = new AbortController();

    await fetchReleases(
      {
        from: '2026-08-10',
        to: '2026-08-20',
        limit: 25,
        platformIds: [6, 167],
        genreIds: [12],
      },
      { fetcher, signal: controller.signal },
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      '/api/releases?from=2026-08-10&to=2026-08-20&limit=25&platforms=6%2C167&genres=12',
    );
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('rejeita DTO 200 inválido', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: 'invalid' }));
    await expect(fetchReleases({}, { fetcher })).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_UPSTREAM_RESPONSE',
    });
  });

  it('preserva somente erro público normalizado', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(
          { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviço indisponível.' } },
          503,
        ),
      );
    await expect(fetchReleases({}, { fetcher })).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Serviço indisponível.',
    });
  });

  it('normaliza corpo de erro não JSON', async () => {
    const response = {
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(new Error('raw secret')),
    } as unknown as Response;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(fetchReleases({}, { fetcher })).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL_ERROR',
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd test -- src/features/releases/api/releases-client.test.ts --run
```

Expected: FAIL because releases-client.ts is missing.

- [ ] **Step 3: Implement the client**

Create releases-client.ts:

```ts
import {
  apiErrorResponseSchema,
  releasesResponseSchema,
  type ApiErrorCode,
  type ReleasesResponse,
} from '../../../../shared/contracts/releases';

export interface ReleasesClientQuery {
  from?: string;
  to?: string;
  limit?: number;
  platformIds?: number[];
  genreIds?: number[];
}

export class ReleasesClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function fetchReleases(
  query: ReleasesClientQuery = {},
  options: { fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ReleasesResponse> {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.platformIds) params.set('platforms', query.platformIds.join(','));
  if (query.genreIds) params.set('genres', query.genreIds.join(','));

  const suffix = params.size > 0 ? '?' + params.toString() : '';
  const response = await (options.fetcher ?? fetch)('/api/releases' + suffix, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ReleasesClientError(response.status, 'INTERNAL_ERROR', 'Resposta inválida.');
  }

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(payload);
    if (!parsedError.success) {
      throw new ReleasesClientError(response.status, 'INTERNAL_ERROR', 'Resposta inválida.');
    }
    throw new ReleasesClientError(
      response.status,
      parsedError.data.error.code,
      parsedError.data.error.message,
    );
  }

  const parsedResponse = releasesResponseSchema.safeParse(payload);
  if (!parsedResponse.success) {
    throw new ReleasesClientError(502, 'INVALID_UPSTREAM_RESPONSE', 'Resposta inválida.');
  }
  return parsedResponse.data;
}
```

The client returns only validated data and exposes no raw payload.

- [ ] **Step 4: Write failing hook tests**

Create use-releases-console.test.tsx:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ReleasesClientError } from '../api/releases-client';

import { useReleasesConsole } from './use-releases-console';

const payload = {
  data: [],
  meta: {
    from: '2026-08-07',
    to: '2026-11-05',
    count: 0,
    limit: 50,
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceTruncated: false,
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function logger() {
  return { info: vi.fn(), error: vi.fn() };
}

function StrictWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

describe('useReleasesConsole', () => {
  it('registra uma única resposta bem-sucedida em StrictMode', async () => {
    const request = deferred<typeof payload>();
    const log = logger();
    const dependencies = { load: vi.fn(() => request.promise), logger: log };

    renderHook(() => useReleasesConsole(dependencies), { wrapper: StrictWrapper });
    await act(async () => request.resolve(payload));

    await waitFor(() =>
      expect(log.info).toHaveBeenCalledWith('[releases] Próximos lançamentos', payload),
    );
    expect(log.info).toHaveBeenCalledTimes(1);
  });

  it('cancela no unmount e ignora resolução posterior', async () => {
    const request = deferred<typeof payload>();
    const log = logger();
    const load = vi.fn(() => request.promise);
    const { unmount } = renderHook(() => useReleasesConsole({ load, logger: log }));
    const signal = load.mock.calls[0]![0];

    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => request.resolve(payload));
    expect(log.info).not.toHaveBeenCalled();
  });

  it.each([
    [
      new ReleasesClientError(503, 'SERVICE_UNAVAILABLE', 'secret'),
      { status: 503, code: 'SERVICE_UNAVAILABLE' },
    ],
    [new Error('secret'), { status: 0, code: 'INTERNAL_ERROR' }],
  ] as const)('normaliza erro sem expor mensagem', async (error, normalized) => {
    const log = logger();
    renderHook(() => useReleasesConsole({ load: vi.fn().mockRejectedValue(error), logger: log }));

    await waitFor(() =>
      expect(log.error).toHaveBeenCalledWith(
        '[releases] Falha ao carregar lançamentos',
        normalized,
      ),
    );
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('secret');
  });

  it('ignora AbortError', async () => {
    const log = logger();
    renderHook(() =>
      useReleasesConsole({
        load: vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')),
        logger: log,
      }),
    );

    await act(async () => Promise.resolve());
    expect(log.error).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run and verify failure**

```powershell
npm.cmd test -- src/features/releases/hooks/use-releases-console.test.tsx --run
```

Expected: FAIL because use-releases-console.ts is missing.

- [ ] **Step 6: Implement the hook and page activation**

Create use-releases-console.ts:

```ts
import { useEffect } from 'react';

import { fetchReleases, ReleasesClientError } from '../api/releases-client';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

interface ReleasesConsoleDependencies {
  load(signal: AbortSignal): Promise<ReleasesResponse>;
  logger: Pick<Console, 'info' | 'error'>;
}

const defaultDependencies: ReleasesConsoleDependencies = {
  load: (signal) => fetchReleases({}, { signal }),
  logger: console,
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function normalizeError(error: unknown) {
  if (error instanceof ReleasesClientError) {
    return { status: error.status, code: error.code };
  }
  return { status: 0, code: 'INTERNAL_ERROR' as const };
}

export function useReleasesConsole(
  dependencies: ReleasesConsoleDependencies = defaultDependencies,
) {
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void dependencies
      .load(controller.signal)
      .then((response) => {
        if (active) dependencies.logger.info('[releases] Próximos lançamentos', response);
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          dependencies.logger.error(
            '[releases] Falha ao carregar lançamentos',
            normalizeError(error),
          );
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [dependencies]);
}
```

Call useReleasesConsole() at the top of ReleasesPage. Do not add markup, props, loading state or error state.

Add the import and invocation:

```tsx
import { useReleasesConsole } from '@/features/releases/hooks/use-releases-console';

export function ReleasesPage() {
  useReleasesConsole();
  const [view, setView] = useState<ReleaseView>('list');
```

In App.test.tsx, add waitFor to the Testing Library import and add afterEach plus vi to the Vitest import. Hoist a fetchReleases mock returning the same empty valid payload used above, and mock only that export while preserving the real module:

```tsx
const payload = {
  data: [],
  meta: {
    from: '2026-08-07',
    to: '2026-11-05',
    count: 0,
    limit: 50,
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceTruncated: false,
  },
};
const fetchReleasesMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/releases/api/releases-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/releases/api/releases-client')>();
  return { ...actual, fetchReleases: fetchReleasesMock };
});

beforeEach(() => {
  fetchReleasesMock.mockReset();
  fetchReleasesMock.mockResolvedValue(payload);
  window.history.replaceState({}, '', '/');
});
```

Inside the existing releases-route test, create const info = vi.spyOn(console, 'info').mockImplementation(() => undefined) before render and append:

```tsx
await waitFor(() => expect(info).toHaveBeenCalledWith('[releases] Próximos lançamentos', payload));
expect(info).toHaveBeenCalledTimes(1);
```

Keep every existing DOM assertion. Add afterEach(() => vi.restoreAllMocks()) so the console spy cannot leak.

- [ ] **Step 7: Run frontend tests and commit**

```powershell
npm.cmd test -- src/features/releases/api/releases-client.test.ts src/features/releases/hooks/use-releases-console.test.tsx src/app/App.test.tsx --run
git add src/features/releases src/pages/ReleasesPage.tsx src/app/App.test.tsx
git commit -m "feat: log upcoming releases on releases page"
```

---

### Task 8: Environment documentation and full verification

**Files:**

- Modify: .env.example
- Modify: README.md
- Verify: all feature and project files

**Interfaces:**

- Produces: documented local setup and reproducible verification evidence.
- Consumes: npm run dev:vercel and the completed endpoint.

- [ ] **Step 1: Document the environment contract**

Append to .env.example:

```dotenv
# Credenciais server-side da aplicação registrada na Twitch para acesso à IGDB.
# Nunca use o prefixo VITE_ nestas variáveis.
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
```

Append this README section, adjusting only surrounding heading placement:

```markdown
## Integração de lançamentos da IGDB

O navegador consome GET /api/releases na mesma origem. A Vercel Function mantém
as credenciais e o token OAuth no servidor, porque a IGDB não aceita chamadas
diretas do navegador e o client secret nunca pode entrar no bundle Vite.

Crie uma aplicação Confidential no Twitch Developer Portal e configure
IGDB_CLIENT_ID e IGDB_CLIENT_SECRET nos ambientes Development, Preview e
Production do projeto na Vercel. Nunca use o prefixo VITE_ e nunca registre os
valores ou o token no console.

Para desenvolvimento local, coloque os valores em .env.local, que é ignorado
pelo Git, ou baixe as variáveis Development com a CLI da Vercel.

- npm run dev inicia somente o Vite para trabalho visual.
- npm run dev:vercel inicia o frontend e as Vercel Functions.

GET /api/releases aceita from e to no formato YYYY-MM-DD, limit entre 1 e 100,
platforms e genres como listas de IDs separadas por vírgulas. Sem parâmetros, a
consulta cobre hoje em America/Sao_Paulo até 90 dias depois e retorna até 50
jogos consolidados.
```

- [ ] **Step 2: Run formatting and inspect the complete diff**

```powershell
npm.cmd exec prettier -- --write api server shared src/features/releases src/pages/ReleasesPage.tsx src/app/App.test.tsx package.json tsconfig.json tsconfig.server.json eslint.config.js .env.example README.md
git diff --check
git status --short
```

Confirm formatting did not rewrite unrelated files. Confirm the working-tree package-lock.json still contains the pre-existing libc deletions and the staged/committed history attributes only dependency additions to this feature.

- [ ] **Step 3: Run the full automated verification**

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd exec tsc -- -p tsconfig.server.json --pretty false
npm.cmd run test:run
npm.cmd run build
```

Expected: every command exits 0 with zero test failures, TypeScript errors, lint errors or formatting differences.

- [ ] **Step 4: Run the local smoke test when credentials exist**

Do not print or inspect credential values. Confirm only that the two variable names are defined. Start:

```powershell
npm.cmd run dev:vercel
```

Open /lancamentos, inspect Network for GET /api/releases and inspect the console. Expected:

```text
[releases] Próximos lançamentos
{ data: [...], meta: { from: ..., to: ..., count: ..., limit: 50, generatedAt: ..., sourceTruncated: ... } }
```

Confirm status 200, no duplicate success log, no token/secret/header output, no React warning and no visual changes to the page. If credentials are unavailable, record the smoke test as not run rather than claiming it passed.

- [ ] **Step 5: Commit documentation**

```powershell
git add .env.example README.md
git commit -m "docs: document IGDB releases setup"
```

- [ ] **Step 6: Final requirement audit**

Re-read docs/superpowers/specs/2026-08-07-igdb-releases-integration-design.md and map every acceptance criterion to a passing test, verification command or explicit smoke-test observation. Report any unavailable credential-dependent evidence separately.
