# Supabase Auth and Custom Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add passwordless Supabase authentication and private, persistent, customizable game lists while preserving public access to Home and Releases.

**Architecture:** The React app uses a singleton Supabase browser client behind small auth and list service interfaces. `AuthProvider` owns session state, `ListsProvider` owns user-scoped list caches, PostgreSQL RLS is the authorization boundary, and SQL functions perform multi-row list mutations atomically. Existing Vercel functions remain the only IGDB integration.

**Tech Stack:** Node.js 22.13+, React 19, TypeScript 6, Vite 8, React Router 8, Vitest, Testing Library, Zod, `@supabase/supabase-js`, Supabase Auth, PostgreSQL, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-24-supabase-auth-and-custom-lists-design.md`

## Global Constraints

- Home (`/`) and Releases (`/lancamentos`) remain usable without Supabase environment variables.
- Login is a dedicated `/entrar` page with six-digit email OTP and Google OAuth; no password UI is added.
- Protected routes are `/minhas-listas`, `/minhas-listas/nova`, and `/perfil`.
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` enter the browser bundle; never add a `service_role` value.
- All exposed personal tables enable RLS, use minimum grants, and compare ownership with `(select auth.uid())`.
- PostgreSQL identifiers use lowercase `snake_case`; timestamps use `timestamptz`; auth user IDs use `uuid`; list and game IDs use `bigint identity`.
- User-created lists have trimmed names from 1 through 80 characters. Description length is limited to 500 characters in SQL and TypeScript.
- `want_to_play` is the only system list key and is unique per user.
- Adding the same game to the same list is idempotent. The inclusion modal does not remove existing memberships in this increment.
- Async failures remain sanitized. Components never display Supabase messages, SQL text, tokens, or provider payloads.
- Every production behavior follows RED → confirm expected failure → GREEN → full relevant test run.

## Planned File Map

### Supabase foundation

- Create `src/shared/supabase/config.ts`: parse optional public environment configuration.
- Create `src/shared/supabase/config.test.ts`: missing, partial, and valid configuration behavior.
- Create `src/shared/supabase/client.ts`: lazy singleton browser client.
- Create `src/shared/supabase/data-error.ts`: small sanitized error taxonomy.
- Modify `package.json` and `package-lock.json`: install `@supabase/supabase-js`.
- Modify `.env.example`: document the two public values without adding secrets.

### Database

- Create `supabase/migrations/20260824000000_auth_and_lists.sql`: tables, trigger, indexes, RLS, grants, and RPC functions.
- Create `server/database/auth-and-lists-migration.test.ts`: contract checks for security-critical migration clauses.

### Authentication

- Create `src/features/auth/model/auth.ts`: public auth models and normalization helpers.
- Create `src/features/auth/model/auth.test.ts`: user metadata and OTP validation tests.
- Create `src/features/auth/model/pending-auth-intent.ts`: versioned `sessionStorage` intent codec.
- Create `src/features/auth/model/pending-auth-intent.test.ts`: single-consumption and redirect safety tests.
- Create `src/features/auth/api/auth-service.ts`: narrow Supabase Auth adapter.
- Create `src/features/auth/api/auth-service.test.ts`: adapter contract and sanitized error tests.
- Create `src/features/auth/context/AuthProvider.tsx` and test: session state and commands.
- Create `src/features/auth/components/ProtectedRoute.tsx` and test: loading/anonymous/authenticated routing.
- Create `src/pages/LoginPage.tsx` and test: OTP and Google flows.

### Lists and account pages

- Create `src/features/lists/model/lists.ts` and test: game snapshots, list summaries, and input validation.
- Create `src/features/lists/api/lists-repository.ts` and test: query/RPC mapping.
- Create `src/features/lists/context/ListsProvider.tsx` and test: user-scoped cache and mutations.
- Create `src/pages/MyListsPage.tsx`, `src/pages/CreateListPage.tsx`, `src/pages/ProfilePage.tsx` and tests.
- Modify `src/features/lists/components/AddToListsModal.tsx` and test: async loading/submission/error states.

### Application integration

- Modify `src/app/router.tsx`, `src/app/AppLayout.tsx`, and their tests: providers and protected routes.
- Modify header types/components/tests: anonymous “Entrar” versus authenticated profile.
- Modify `src/pages/ReleasesPage.tsx`, release list/card components, and tests: batched membership load and persistent mutations.
- Modify `src/app/App.test.tsx`: public access, login return, and protected-route integration.
- Modify `README.md`: Supabase dashboard, OTP template, Google redirect, migration, and Vercel setup.

---

### Task 1: Supabase Browser Foundation

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `src/shared/supabase/config.ts`
- Test: `src/shared/supabase/config.test.ts`
- Create: `src/shared/supabase/client.ts`
- Create: `src/shared/supabase/data-error.ts`

**Interfaces:**

- Produces: `readSupabaseConfig(env): SupabaseConfigState`, `getSupabaseClient(): SupabaseClient | null`, and `DataError`.
- Consumes: Vite `import.meta.env` only inside `client.ts`.

- [ ] **Step 1: Install the browser SDK**

Run:

```bash
npm install @supabase/supabase-js
```

Expected: dependency and lockfile entries are added without changing the Node engine.

- [ ] **Step 2: Write failing configuration tests**

```ts
import { describe, expect, it } from 'vitest';

import { readSupabaseConfig } from './config';

describe('readSupabaseConfig', () => {
  it('keeps public pages available when both values are absent', () => {
    expect(readSupabaseConfig({})).toEqual({ status: 'missing' });
  });

  it('rejects partial configuration without exposing its value', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://project.supabase.co' })).toEqual({
      status: 'invalid',
      message: 'A autenticação ainda não está configurada.',
    });
  });

  it('accepts a valid URL and publishable key', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toEqual({
      status: 'available',
      config: {
        url: 'https://project.supabase.co',
        publishableKey: 'sb_publishable_example',
      },
    });
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `npm run test:run -- src/shared/supabase/config.test.ts`

Expected: FAIL because `./config` does not exist.

- [ ] **Step 4: Implement config, lazy client, and sanitized errors**

```ts
export interface SupabaseConfig {
  readonly publishableKey: string;
  readonly url: string;
}

export type SupabaseConfigState =
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly message: string }
  | { readonly status: 'available'; readonly config: SupabaseConfig };

export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfigState {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !publishableKey) return { status: 'missing' };
  if (!url || !publishableKey || !URL.canParse(url)) {
    return { status: 'invalid', message: 'A autenticação ainda não está configurada.' };
  }
  return { status: 'available', config: { url, publishableKey } };
}
```

`client.ts` calls `createClient(config.url, config.publishableKey)` only for `available`, caches the result in a module variable, enables session persistence and callback detection, and returns `null` for missing/invalid configuration. `data-error.ts` defines codes `configuration | unauthenticated | permission | conflict | network | unexpected` and maps unknown SDK errors to fixed Portuguese copy.

- [ ] **Step 5: Document public variables**

Append to `.env.example`:

```dotenv
# Configuração pública do Supabase. A autorização continua protegida por RLS.
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- [ ] **Step 6: Verify GREEN and project compatibility**

Run:

```bash
npm run test:run -- src/shared/supabase/config.test.ts
npm run typecheck
```

Expected: PASS; public app modules can import `getSupabaseClient` with no environment values.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/shared/supabase
git commit -m "feat: add Supabase browser foundation"
```

### Task 2: Secure Database Migration

**Files:**

- Create: `supabase/migrations/20260824000000_auth_and_lists.sql`
- Create: `server/database/auth-and-lists-migration.test.ts`

**Interfaces:**

- Produces RPCs: `get_my_lists()`, `get_want_to_play_igdb_ids(bigint[])`, `add_game_to_lists(bigint,text,text,date,bigint[])`, and `toggle_want_to_play(bigint,text,text,date)`.
- Produces tables: `profiles`, `games`, `lists`, and `list_items`.

- [ ] **Step 1: Write the failing migration contract test**

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../supabase/migrations/20260824000000_auth_and_lists.sql',
  import.meta.url,
);

describe('auth and lists migration', () => {
  it('contains ownership policies, indexed foreign keys, and locked-down definer functions', async () => {
    const sql = (await readFile(fileURLToPath(migrationUrl), 'utf8')).toLowerCase();
    for (const table of ['profiles', 'games', 'lists', 'list_items']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain('lists_user_id_created_at_idx');
    expect(sql).toContain('list_items_game_id_idx');
    expect(sql).toContain('(select auth.uid())');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('revoke all on function');
    expect(sql).toContain('grant execute on function');
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- server/database/auth-and-lists-migration.test.ts`

Expected: FAIL with `ENOENT` for the absent migration.

- [ ] **Step 3: Create tables, constraints, trigger, and indexes**

The migration must use the following concrete shapes:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id bigint generated always as identity primary key,
  igdb_id bigint not null unique,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  cover_url text,
  release_date date,
  created_at timestamptz not null default now()
);

create table public.lists (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  system_key text check (system_key is null or system_key = 'want_to_play'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_items (
  list_id bigint not null references public.lists(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, game_id)
);

create index lists_user_id_created_at_idx on public.lists (user_id, created_at desc);
create unique index lists_user_system_key_idx on public.lists (user_id, system_key)
  where system_key is not null;
create index list_items_game_id_idx on public.list_items (game_id);
```

Add `public.handle_new_user()` plus an `after insert` trigger on `auth.users`, then backfill missing profiles using verified metadata fields with email-local-part fallback.

- [ ] **Step 4: Add RLS, minimum grants, and atomic functions**

Policies use `(select auth.uid())`; authenticated users select/update their profile, select their lists/items, and insert custom lists only with `system_key is null`. Revoke table writes to `games`; grant its select to authenticated.

Each `security definer` function uses `set search_path = ''`, rejects a null user, schema-qualifies every table, validates list ownership before writes, and is executable only by `authenticated`. `add_game_to_lists` uses `on conflict (igdb_id) do nothing` and `on conflict (list_id, game_id) do nothing`. `toggle_want_to_play` catches the unique-list race by selecting the existing row after conflict and returns the final membership boolean.

Use these exact result contracts:

```sql
get_my_lists()
  returns table (id bigint, name text, description text, system_key text, game_count bigint, covers text[])

get_want_to_play_igdb_ids(p_igdb_ids bigint[])
  returns table (igdb_id bigint)

add_game_to_lists(
  p_igdb_id bigint,
  p_name text,
  p_cover_url text,
  p_release_date date,
  p_list_ids bigint[]
) returns bigint[]

toggle_want_to_play(
  p_igdb_id bigint,
  p_name text,
  p_cover_url text,
  p_release_date date
) returns boolean
```

`get_my_lists` orders lists by `created_at desc`, counts items, and uses a lateral subquery limited to the three newest non-null covers. `get_want_to_play_igdb_ids` intersects the supplied IDs with the current user's special list, so release membership is one batched request.

- [ ] **Step 5: Verify GREEN and optionally execute locally**

Run: `npm run test:run -- server/database/auth-and-lists-migration.test.ts`

Expected: PASS.

If `supabase --version` succeeds, also run `supabase db reset` and expect the migration to complete. If the CLI is absent, record that database execution remains an environment verification, not a unit-test failure.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260824000000_auth_and_lists.sql server/database/auth-and-lists-migration.test.ts
git commit -m "feat: add secure lists database schema"
```

### Task 3: Auth Domain, Service, and Pending Intents

**Files:**

- Create: `src/features/auth/model/auth.ts`
- Test: `src/features/auth/model/auth.test.ts`
- Create: `src/features/auth/model/pending-auth-intent.ts`
- Test: `src/features/auth/model/pending-auth-intent.test.ts`
- Create: `src/features/auth/api/auth-service.ts`
- Test: `src/features/auth/api/auth-service.test.ts`

**Interfaces:**

- Produces: `AuthenticatedUser`, `AuthService`, `createSupabaseAuthService(client)`, OTP validators, and pending-intent functions.
- Consumes: `DataError` and a narrow subset of the Supabase Auth client.

- [ ] **Step 1: Write failing model and intent tests**

```ts
it('normalizes Google metadata and falls back to the email for initials', () => {
  expect(
    toAuthenticatedUser({
      id: 'user-1',
      email: 'alex@example.com',
      user_metadata: { full_name: 'Alex Xavier', avatar_url: 'https://img.example/alex.png' },
    }),
  ).toMatchObject({ name: 'Alex Xavier', initials: 'AX' });
});

it('accepts exactly six OTP digits', () => {
  expect(normalizeOtp(' 123456 ')).toBe('123456');
  expect(() => normalizeOtp('12345a')).toThrow('Digite o código de seis dígitos.');
});

it('consumes a safe intent once and rejects external navigation', () => {
  const storage = new MemoryStorage();
  savePendingAuthIntent(storage, { version: 1, type: 'navigate', returnTo: '/minhas-listas' });
  expect(consumePendingAuthIntent(storage)?.returnTo).toBe('/minhas-listas');
  expect(consumePendingAuthIntent(storage)).toBeNull();
  storage.setItem(
    PENDING_AUTH_INTENT_KEY,
    JSON.stringify({ version: 1, type: 'navigate', returnTo: 'https://evil.example' }),
  );
  expect(consumePendingAuthIntent(storage)).toBeNull();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/features/auth/model/auth.test.ts src/features/auth/model/pending-auth-intent.test.ts`

Expected: FAIL because the model modules do not exist.

- [ ] **Step 3: Implement exact auth and intent contracts**

```ts
export interface AuthenticatedUser {
  readonly avatarUrl: string | null;
  readonly email: string;
  readonly id: string;
  readonly initials: string;
  readonly name: string;
}

export type PendingAuthIntent =
  | { readonly version: 1; readonly type: 'navigate'; readonly returnTo: string }
  | {
      readonly version: 1;
      readonly type: 'open-add-to-lists';
      readonly returnTo: '/lancamentos';
      readonly igdbId: number;
    }
  | {
      readonly version: 1;
      readonly type: 'toggle-want-to-play';
      readonly returnTo: '/lancamentos';
      readonly igdbId: number;
    };
```

Use Zod to parse stored JSON, allow only `/`, `/lancamentos`, `/minhas-listas`, `/minhas-listas/nova`, and `/perfil` as `returnTo`, remove invalid storage immediately, and expose `peekPendingAuthIntent`, `consumePendingAuthIntent`, `savePendingAuthIntent`, and `clearPendingAuthIntent`.

- [ ] **Step 4: Write failing auth-service tests**

Test these exact SDK calls through a fake port:

```ts
await service.requestEmailCode('alex@example.com');
expect(port.signInWithOtp).toHaveBeenCalledWith({
  email: 'alex@example.com',
  options: { shouldCreateUser: true },
});

await service.verifyEmailCode('alex@example.com', '123456');
expect(port.verifyOtp).toHaveBeenCalledWith({
  email: 'alex@example.com',
  token: '123456',
  type: 'email',
});

await service.signInWithGoogle('https://zera.example/entrar');
expect(port.signInWithOAuth).toHaveBeenCalledWith({
  provider: 'google',
  options: { redirectTo: 'https://zera.example/entrar' },
});
```

Also cover `getCurrentUser`, auth-state subscription cleanup, sign-out, and normalization of a raw SDK rejection to `DataError('unexpected')`.

- [ ] **Step 5: Verify service RED, then implement the adapter**

Run: `npm run test:run -- src/features/auth/api/auth-service.test.ts`

Expected: FAIL because `createSupabaseAuthService` is absent.

Implement:

```ts
export interface AuthService {
  getCurrentUser(): Promise<AuthenticatedUser | null>;
  onAuthStateChange(listener: (user: AuthenticatedUser | null) => void): () => void;
  requestEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, token: string): Promise<void>;
  signInWithGoogle(redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
}
```

Every SDK `{ error }` is checked once and passed through the sanitizer. Do not expose the provider error message.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run test:run -- src/features/auth/model/auth.test.ts src/features/auth/model/pending-auth-intent.test.ts src/features/auth/api/auth-service.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/auth
git commit -m "feat: add authentication domain services"
```

### Task 4: Auth Provider, Route Guard, and Real Header Account

**Files:**

- Create: `src/features/auth/context/AuthProvider.tsx`
- Test: `src/features/auth/context/AuthProvider.test.tsx`
- Create: `src/features/auth/components/ProtectedRoute.tsx`
- Test: `src/features/auth/components/ProtectedRoute.test.tsx`
- Modify: `src/app/AppLayout.tsx`
- Modify: `src/app/AppLayout.test.tsx`
- Modify: `src/shared/components/header/header.types.ts`
- Modify: `src/shared/components/header/Header.tsx`
- Modify: `src/shared/components/header/HeaderActions.tsx`
- Modify: `src/shared/components/header/HeaderControls.test.tsx`

**Interfaces:**

- Consumes: `AuthService` and `AuthenticatedUser` from Task 3.
- Produces: `AuthProvider`, `useAuth()`, `ProtectedRoute`, and anonymous/authenticated header account variants.

- [ ] **Step 1: Write failing provider tests**

Use a controllable fake `AuthService` and assert the observable state:

```tsx
function Probe() {
  const { state } = useAuth();
  return <output>{state.status === 'authenticated' ? state.user.email : state.status}</output>;
}

it('loads the current user and follows later auth changes', async () => {
  const service = createFakeAuthService(null);
  render(
    <AuthProvider service={service}>
      <Probe />
    </AuthProvider>,
  );
  expect(screen.getByText('loading')).toBeInTheDocument();
  expect(await screen.findByText('anonymous')).toBeInTheDocument();
  act(() => service.emit(authenticatedUser));
  expect(screen.getByText('alex@example.com')).toBeInTheDocument();
});

it('reports unavailable without blocking public descendants', async () => {
  render(
    <AuthProvider service={null}>
      <Probe />
    </AuthProvider>,
  );
  expect(await screen.findByText('unavailable')).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify provider RED**

Run: `npm run test:run -- src/features/auth/context/AuthProvider.test.tsx`

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Implement the provider with cleanup and stale-result protection**

```ts
export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated'; readonly user: AuthenticatedUser }
  | { readonly status: 'unavailable'; readonly message: string };

export interface AuthContextValue {
  readonly state: AuthState;
  readonly requestEmailCode: AuthService['requestEmailCode'];
  readonly verifyEmailCode: AuthService['verifyEmailCode'];
  readonly signInWithGoogle: AuthService['signInWithGoogle'];
  readonly signOut: AuthService['signOut'];
}
```

Subscribe before awaiting the initial user, ignore the initial promise after unmount, unsubscribe on cleanup, and expose stable callbacks. When `service` is null, set `unavailable` with “A autenticação ainda não está configurada.”

- [ ] **Step 4: Write failing route-guard tests**

```tsx
it('shows a named loading state before deciding', () => {
  renderGuard({ status: 'loading' });
  expect(screen.getByRole('status')).toHaveTextContent('Verificando sua sessão');
});

it('stores the protected route and sends anonymous users to login', () => {
  renderGuard({ status: 'anonymous' }, '/minhas-listas/nova');
  expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  expect(peekPendingAuthIntent(sessionStorage)).toEqual({
    version: 1,
    type: 'navigate',
    returnTo: '/minhas-listas/nova',
  });
});

it('renders protected children for an authenticated user', () => {
  renderGuard({ status: 'authenticated', user: authenticatedUser });
  expect(screen.getByText('Conteúdo privado')).toBeInTheDocument();
});
```

- [ ] **Step 5: Implement `ProtectedRoute` and header account variants**

`ProtectedRoute` uses `<Navigate to="/entrar" replace />` only after saving a validated navigate intent. `unavailable` also routes to Login so configuration copy has one owner.

Replace required `HeaderProps.user` with:

```ts
export type HeaderAccount =
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated'; readonly user: HeaderUser };
```

`AppLayout` derives the account from `useAuth()`. Desktop anonymous state renders a visible `Entrar` link to `/entrar`; authenticated state renders the avatar button as a link to `/perfil`, notifications, and “Criar lista”. Remove the fixed `appUser` constant. Tablet/mobile navigation remains CSS responsive and Profile continues through the protected route.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run test:run -- src/features/auth/context/AuthProvider.test.tsx src/features/auth/components/ProtectedRoute.test.tsx src/app/AppLayout.test.tsx src/shared/components/header/HeaderControls.test.tsx
npm run typecheck
```

Expected: PASS with listener cleanup asserted once.

- [ ] **Step 7: Commit**

```bash
git add src/features/auth/context src/features/auth/components src/app/AppLayout.tsx src/app/AppLayout.test.tsx src/shared/components/header
git commit -m "feat: connect session state to app shell"
```

### Task 5: Dedicated OTP and Google Login Page

**Files:**

- Create: `src/pages/LoginPage.tsx`
- Test: `src/pages/LoginPage.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**

- Consumes: `useAuth`, OTP normalization, and pending-intent functions.
- Produces: public route `/entrar` and post-auth resume behavior.

- [ ] **Step 1: Write failing login-page tests**

```tsx
it('requests a code and verifies six digits', async () => {
  const user = userEvent.setup();
  const service = createFakeAuthService(null);
  renderLogin(service);
  await user.type(screen.getByRole('textbox', { name: 'E-mail' }), ' alex@example.com ');
  await user.click(screen.getByRole('button', { name: 'Enviar código' }));
  expect(service.requestEmailCode).toHaveBeenCalledWith('alex@example.com');
  await user.type(screen.getByRole('textbox', { name: 'Código de verificação' }), '123456');
  await user.click(screen.getByRole('button', { name: 'Confirmar código' }));
  expect(service.verifyEmailCode).toHaveBeenCalledWith('alex@example.com', '123456');
});

it('starts Google with the dedicated callback', async () => {
  const user = userEvent.setup();
  const service = createFakeAuthService(null);
  renderLogin(service);
  await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));
  expect(service.signInWithGoogle).toHaveBeenCalledWith(`${window.location.origin}/entrar`);
});

it('resumes a protected route after authentication', async () => {
  savePendingAuthIntent(sessionStorage, {
    version: 1,
    type: 'navigate',
    returnTo: '/minhas-listas',
  });
  const service = createFakeAuthService(authenticatedUser);
  renderLogin(service);
  await waitFor(() => expect(window.location.pathname).toBe('/minhas-listas'));
  expect(peekPendingAuthIntent(sessionStorage)).toBeNull();
});
```

Also test invalid email, non-six-digit code, generic request failure, retry without losing email, and an action intent that remains stored while navigating back to `/lancamentos`.

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/pages/LoginPage.test.tsx`

Expected: FAIL because `LoginPage` is absent.

- [ ] **Step 3: Implement the two-stage accessible form**

Use local state:

```ts
type LoginStage = 'email' | 'code';

const [stage, setStage] = useState<LoginStage>('email');
const [email, setEmail] = useState('');
const [code, setCode] = useState('');
const [submission, setSubmission] = useState<'idle' | 'submitting'>('idle');
const [message, setMessage] = useState<string | null>(null);
```

The email form trims and validates before calling Auth. The code input uses `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`, accepts paste, and stays one accessible input. Submission buttons disable while pending. Provider errors map to “Não foi possível concluir o acesso. Tente novamente.” The resend action calls `requestEmailCode(email)` and announces success.

When `state.status === 'authenticated'`, peek at the intent. Consume navigate intents immediately; retain release action intents, navigate to their `returnTo`, and let the matching card consume them.

- [ ] **Step 4: Add the public route without protecting public pages**

```tsx
<Route element={<AppLayout />}>
  <Route index element={<HomePage />} />
  <Route path={headerRoutes.releases} element={<ReleasesPage />} />
  <Route path="/entrar" element={<LoginPage />} />
</Route>
```

Provider wrapping belongs in `AppRouter`, not inside individual pages. Allow an optional `authService` prop for integration tests and use the real service by default.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm run test:run -- src/pages/LoginPage.test.tsx src/app/App.test.tsx
npm run typecheck
```

Expected: PASS; `/` and `/lancamentos` still render with `authService={null}`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx src/app/router.tsx src/app/App.test.tsx
git commit -m "feat: add passwordless login page"
```

### Task 6: Lists Domain and Supabase Repository

**Files:**

- Create: `src/features/lists/model/lists.ts`
- Test: `src/features/lists/model/lists.test.ts`
- Create: `src/features/lists/api/lists-repository.ts`
- Test: `src/features/lists/api/lists-repository.test.ts`

**Interfaces:**

- Produces: `GameSnapshot`, `UserListSummary`, `CreateListInput`, `ListsRepository`, and `createSupabaseListsRepository(client)`.
- Consumes: migration RPC names from Task 2 and `DataError` from Task 1.

- [ ] **Step 1: Write failing list-model tests**

```ts
it('normalizes a valid custom list input', () => {
  expect(
    normalizeCreateListInput({ name: '  RPGs  ', description: '  Para jogar em 2027  ' }),
  ).toEqual({
    name: 'RPGs',
    description: 'Para jogar em 2027',
  });
});

it('rejects names over 80 characters and descriptions over 500', () => {
  expect(() => normalizeCreateListInput({ name: 'x'.repeat(81), description: '' })).toThrow(
    'O nome deve ter no máximo 80 caracteres.',
  );
  expect(() => normalizeCreateListInput({ name: 'RPGs', description: 'x'.repeat(501) })).toThrow(
    'A descrição deve ter no máximo 500 caracteres.',
  );
});
```

- [ ] **Step 2: Verify model RED, then implement exact models**

Run: `npm run test:run -- src/features/lists/model/lists.test.ts`

Expected: FAIL because `lists.ts` is absent.

```ts
export interface GameSnapshot {
  readonly coverUrl: string | null;
  readonly igdbId: number;
  readonly name: string;
  readonly releaseDate: string;
}

export interface UserListSummary {
  readonly covers: readonly string[];
  readonly description: string | null;
  readonly gameCount: number;
  readonly id: number;
  readonly name: string;
  readonly systemKey: 'want_to_play' | null;
}

export interface CreateListInput {
  readonly description: string;
  readonly name: string;
}
```

Use Zod for unknown database rows and return immutable mapped values.

- [ ] **Step 3: Write failing repository tests**

```ts
it('maps list summaries from the RPC contract', async () => {
  const port = createListsPort({
    get_my_lists: [
      {
        id: 9,
        name: 'RPGs',
        description: null,
        system_key: null,
        game_count: 2,
        covers: ['/a.png'],
      },
    ],
  });
  const repository = createSupabaseListsRepository(port);
  await expect(repository.listSummaries()).resolves.toEqual([
    { id: 9, name: 'RPGs', description: null, systemKey: null, gameCount: 2, covers: ['/a.png'] },
  ]);
});

it('passes the exact game snapshot and selected list ids to the atomic RPC', async () => {
  const port = createListsPort({ add_game_to_lists: [9, 12] });
  const repository = createSupabaseListsRepository(port);
  await repository.addGameToLists(game, [9, 12]);
  expect(port.rpc).toHaveBeenCalledWith('add_game_to_lists', {
    p_igdb_id: game.igdbId,
    p_name: game.name,
    p_cover_url: game.coverUrl,
    p_release_date: game.releaseDate,
    p_list_ids: [9, 12],
  });
});
```

Also cover create-list insert with the authenticated `userId`, empty RPC data, duplicate list IDs normalized once, batched want-to-play IDs, toggle return value, invalid response, and sanitized SDK errors.

- [ ] **Step 4: Verify repository RED**

Run: `npm run test:run -- src/features/lists/api/lists-repository.test.ts`

Expected: FAIL because the repository is absent.

- [ ] **Step 5: Implement the repository contract**

```ts
export interface ListsRepository {
  addGameToLists(game: GameSnapshot, listIds: readonly number[]): Promise<readonly number[]>;
  createList(userId: string, input: CreateListInput): Promise<UserListSummary>;
  getWantToPlayIds(igdbIds: readonly number[]): Promise<ReadonlySet<number>>;
  listSummaries(): Promise<readonly UserListSummary[]>;
  toggleWantToPlay(game: GameSnapshot): Promise<boolean>;
}
```

Deduplicate numeric IDs with `Set`, reject an empty add selection before transport, validate every unknown payload with Zod, and convert all transport failures to `DataError`.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run test:run -- src/features/lists/model/lists.test.ts src/features/lists/api/lists-repository.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/lists/model/lists.ts src/features/lists/model/lists.test.ts src/features/lists/api
git commit -m "feat: add persistent lists repository"
```

### Task 7: User-Scoped Lists Context and Protected Pages

**Files:**

- Create: `src/features/lists/context/ListsProvider.tsx`
- Test: `src/features/lists/context/ListsProvider.test.tsx`
- Create: `src/pages/MyListsPage.tsx`
- Test: `src/pages/MyListsPage.test.tsx`
- Create: `src/pages/CreateListPage.tsx`
- Test: `src/pages/CreateListPage.test.tsx`
- Create: `src/pages/ProfilePage.tsx`
- Test: `src/pages/ProfilePage.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/shared/components/header/header.config.ts`

**Interfaces:**

- Consumes: authenticated `user.id`, `ListsRepository`, and `ProtectedRoute`.
- Produces: `ListsProvider`, `useLists()`, list pages, account page, and real protected routes.

- [ ] **Step 1: Write failing provider cache tests**

```tsx
it('deduplicates concurrent list loads and publishes one success state', async () => {
  const pending = deferred<readonly UserListSummary[]>();
  const repository = createFakeListsRepository({ listSummaries: () => pending.promise });
  const probe = renderListsProvider(repository, authenticatedUser);
  act(() => {
    void probe.result.current.loadLists();
    void probe.result.current.loadLists();
  });
  expect(repository.listSummaries).toHaveBeenCalledTimes(1);
  pending.resolve([rpgList]);
  await waitFor(() =>
    expect(probe.result.current.listsState).toEqual({ status: 'success', lists: [rpgList] }),
  );
});

it('clears personal caches when the authenticated user changes', async () => {
  const view = renderListsProvider(repository, authenticatedUser);
  await act(() => view.result.current.loadLists());
  view.rerender(otherAuthenticatedUser);
  expect(view.result.current.listsState).toEqual({ status: 'idle' });
  expect(view.result.current.wantToPlayIds.size).toBe(0);
});
```

Also cover retry after error, `createList` refresh, batched membership load, optimistic work being avoided, and toggle failure preserving the previous set.

- [ ] **Step 2: Verify provider RED**

Run: `npm run test:run -- src/features/lists/context/ListsProvider.test.tsx`

Expected: FAIL because `ListsProvider` is absent.

- [ ] **Step 3: Implement the context contract**

```ts
export type ListsState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly lists: readonly UserListSummary[] }
  | { readonly status: 'error'; readonly message: string };

export interface ListsContextValue {
  readonly listsState: ListsState;
  readonly wantToPlayIds: ReadonlySet<number>;
  addGameToLists(game: GameSnapshot, listIds: readonly number[]): Promise<void>;
  createList(input: CreateListInput): Promise<UserListSummary>;
  loadLists(options?: { readonly force?: boolean }): Promise<void>;
  loadWantToPlayIds(igdbIds: readonly number[]): Promise<void>;
  toggleWantToPlay(game: GameSnapshot): Promise<boolean>;
}
```

Cache one in-flight list promise in a ref, use functional state updates, clear all personal state on user-ID change or anonymous state, and update `wantToPlayIds` only after a successful RPC response.

`ListsProvider` accepts `repository: ListsRepository | null`. A null repository keeps descendants renderable and changes attempted private loads to the fixed configuration error. In `AppRouter`, add optional `authService` and `listsRepository` props for tests. Defaults are built from the same lazy Supabase client, and the provider order is `AuthProvider` → `ListsProvider` → `Routes`.

- [ ] **Step 4: Write failing page tests**

```tsx
it('shows list summaries and links to creation', async () => {
  renderMyLists({ status: 'success', lists: [rpgList] });
  expect(screen.getByRole('heading', { name: 'Minhas listas' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'RPGs' })).toBeInTheDocument();
  expect(screen.getByText('2 jogos')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Criar lista' })).toHaveAttribute(
    'href',
    '/minhas-listas/nova',
  );
});

it('creates a normalized list and returns to the collection', async () => {
  const user = userEvent.setup();
  const createList = vi.fn().mockResolvedValue(rpgList);
  renderCreateList({ createList });
  await user.type(screen.getByRole('textbox', { name: 'Nome da lista' }), '  RPGs  ');
  await user.type(screen.getByRole('textbox', { name: 'Descrição' }), '  Para jogar  ');
  await user.click(screen.getByRole('button', { name: 'Criar lista' }));
  expect(createList).toHaveBeenCalledWith({ name: 'RPGs', description: 'Para jogar' });
  await waitFor(() => expect(window.location.pathname).toBe('/minhas-listas'));
});

it('signs out and returns to the public home page', async () => {
  const user = userEvent.setup();
  const signOut = vi.fn().mockResolvedValue(undefined);
  renderProfile({ signOut });
  await user.click(screen.getByRole('button', { name: 'Sair' }));
  expect(signOut).toHaveBeenCalledOnce();
  expect(window.location.pathname).toBe('/');
});
```

Add separate assertions for list loading skeleton, empty call-to-action, retry after failure, field lengths, submit failure retaining values, user email/avatar fallback, and disabled logout while pending.

- [ ] **Step 5: Verify page RED, then implement pages and routes**

Run: `npm run test:run -- src/pages/MyListsPage.test.tsx src/pages/CreateListPage.test.tsx src/pages/ProfilePage.test.tsx`

Expected: FAIL because the pages are absent.

Add routes:

```tsx
<Route element={<ProtectedRoute />}>
  <Route path={headerRoutes.lists} element={<MyListsPage />} />
  <Route path={headerRoutes.createList} element={<CreateListPage />} />
  <Route path={headerRoutes.profile} element={<ProfilePage />} />
</Route>
```

`MyListsPage` calls `loadLists()` on mount and uses up to three non-null covers. `CreateListPage` runs `normalizeCreateListInput` before `createList`, keeps values on failure, and navigates only after success. `ProfilePage` clears pending intent, awaits `signOut`, then navigates home.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run test:run -- src/features/lists/context/ListsProvider.test.tsx src/pages/MyListsPage.test.tsx src/pages/CreateListPage.test.tsx src/pages/ProfilePage.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/lists/context src/pages/MyListsPage.tsx src/pages/MyListsPage.test.tsx src/pages/CreateListPage.tsx src/pages/CreateListPage.test.tsx src/pages/ProfilePage.tsx src/pages/ProfilePage.test.tsx src/app/router.tsx src/shared/components/header/header.config.ts
git commit -m "feat: add protected list and profile pages"
```

### Task 8: Persistent Release Card List Actions

**Files:**

- Modify: `src/features/lists/components/AddToListsModal.tsx`
- Modify: `src/features/lists/components/AddToListsModal.test.tsx`
- Delete: `src/features/lists/model/add-to-lists.ts`
- Modify: `src/features/releases/components/ReleaseCard.tsx`
- Modify: `src/features/releases/components/ReleaseCard.test.tsx`
- Modify: `src/features/releases/components/ReleaseList.tsx`
- Modify: `src/features/releases/components/ReleaseDateGroup.tsx`
- Modify: `src/pages/ReleasesPage.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**

- Consumes: `useAuth`, `useLists`, `GameSnapshot`, and pending release action intents.
- Produces: persisted modal inclusion, persisted “Quero jogar”, and post-login action resumption.

- [ ] **Step 1: Write failing async-modal tests**

```tsx
it('keeps the modal open and preserves selection when persistence fails', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn().mockRejectedValue(new Error('raw provider detail'));
  render(
    <AddToListsModal
      gameName="Eclipse Protocol"
      listsState={{ status: 'success', lists }}
      onClose={vi.fn()}
      onConfirm={onConfirm}
      open
    />,
  );
  await user.click(screen.getByRole('button', { name: 'RPGs' }));
  await user.click(screen.getByRole('button', { name: 'Adicionar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível adicionar o jogo. Tente novamente.',
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'RPGs' })).toHaveAttribute('aria-pressed', 'true');
});

it('closes only after confirmed persistence', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <AddToListsModal
      gameName="Eclipse Protocol"
      listsState={{ status: 'success', lists }}
      onClose={onClose}
      onConfirm={vi.fn().mockResolvedValue(undefined)}
      open
    />,
  );
  await user.click(screen.getByRole('button', { name: 'RPGs' }));
  await user.click(screen.getByRole('button', { name: 'Adicionar' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
});
```

Add loading, load error/retry, empty, disabled submitting controls, and no raw error output. Replace string demo IDs with numeric `UserListSummary.id`.

- [ ] **Step 2: Verify modal RED, then implement async states**

Run: `npm run test:run -- src/features/lists/components/AddToListsModal.test.tsx`

Expected: FAIL because `listsState` and async confirmation are unsupported.

Use this prop contract:

```ts
export interface AddToListsModalProps {
  readonly gameName: string;
  readonly listsState: ListsState;
  readonly onClose: () => void;
  readonly onConfirm: (listIds: readonly number[]) => Promise<void>;
  readonly onRetry: () => void;
  readonly open: boolean;
}
```

Await `onConfirm`, close only on resolve, map rejection to fixed copy, preserve `selectedIds`, and retain the existing focus trap/Escape/backdrop behavior.

- [ ] **Step 3: Write failing release-card persistence tests**

```tsx
it('asks for authentication instead of mutating an anonymous card', async () => {
  const user = userEvent.setup();
  renderReleaseCard({ authState: { status: 'anonymous' } });
  await user.click(
    screen.getAllByRole('button', { name: 'Marcar Eclipse Protocol como quero jogar' })[0],
  );
  expect(window.location.pathname).toBe('/entrar');
  expect(peekPendingAuthIntent(sessionStorage)).toMatchObject({
    type: 'toggle-want-to-play',
    igdbId: 42,
  });
  expect(repository.toggleWantToPlay).not.toHaveBeenCalled();
});

it('changes want-to-play only after the RPC confirms', async () => {
  const user = userEvent.setup();
  const pending = deferred<boolean>();
  repository.toggleWantToPlay.mockReturnValue(pending.promise);
  renderReleaseCard({ authState: authenticatedState, repository });
  const button = screen.getAllByRole('button', {
    name: 'Marcar Eclipse Protocol como quero jogar',
  })[0];
  await user.click(button);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-pressed', 'false');
  pending.resolve(true);
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
});

it('loads real lists on modal open and saves the selected ids', async () => {
  const user = userEvent.setup();
  renderReleaseCard({ authState: authenticatedState, listSummaries: [rpgList] });
  await user.click(
    screen.getAllByRole('button', { name: 'Adicionar Eclipse Protocol à lista' })[0],
  );
  expect(repository.listSummaries).toHaveBeenCalledOnce();
  await user.click(await screen.findByRole('button', { name: 'RPGs' }));
  await user.click(screen.getByRole('button', { name: 'Adicionar' }));
  expect(repository.addGameToLists).toHaveBeenCalledWith(expectedGameSnapshot, [rpgList.id]);
});
```

Also test RPC failure preserving the old want state, one batched `getWantToPlayIds` call per successful release response, and consumption of matching pending intents exactly once.

- [ ] **Step 4: Verify release RED**

Run: `npm run test:run -- src/features/releases/components/ReleaseCard.test.tsx src/app/App.test.tsx`

Expected: FAIL because card actions still use component state and demonstration lists.

- [ ] **Step 5: Integrate authenticated actions without request waterfalls**

Convert a release DTO with:

```ts
function toGameSnapshot(item: ReleaseItem): GameSnapshot {
  return {
    igdbId: item.id,
    name: item.name,
    coverUrl: item.coverUrl,
    releaseDate: item.releaseDate,
  };
}
```

After a successful release response and only for an authenticated user, `ReleasesPage` sends all current release IDs to `loadWantToPlayIds` once. Do not request membership from each card. `ReleaseCard` reads the shared `wantToPlayIds` set, disables both responsive copies of a mutating action together, and calls `loadLists` lazily when its one modal opens.

For anonymous actions, save the versioned intent before navigating to `/entrar`. After login, the card whose `item.id` matches the pending intent clears it before opening the modal or starting the toggle; clearing first prevents duplicate Strict Mode execution. If no matching card appears after the release request settles, clear the intent and announce “O jogo não está mais nesta lista. Tente novamente.”

Delete `demoAddToListsOptions` and its source file once no import remains.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run test:run -- src/features/lists/components/AddToListsModal.test.tsx src/features/releases/components/ReleaseCard.test.tsx src/app/App.test.tsx
npm run typecheck
```

Expected: PASS with no duplicate repository calls in Strict Mode.

- [ ] **Step 7: Commit**

```bash
git add src/features/lists src/features/releases src/pages/ReleasesPage.tsx src/app/App.test.tsx
git commit -m "feat: persist release list actions"
```

### Task 9: Setup Documentation and End-to-End Verification

**Files:**

- Modify: `README.md`
- Modify: `src/app/App.test.tsx`
- Modify: any files from Tasks 1–8 only when verification exposes a tested defect.

**Interfaces:**

- Consumes: all completed auth, database, list, and route behavior.
- Produces: reproducible Supabase setup instructions and release-quality verification evidence.

- [ ] **Step 1: Add failing integration coverage for the complete return flow**

```tsx
it('returns from login and resumes adding the release to a real list', async () => {
  const user = userEvent.setup();
  const services = createAppServices({ user: null, lists: [rpgList], releases: payload });
  window.history.replaceState({}, '', '/lancamentos');
  render(<AppRouter authService={services.auth} listsRepository={services.lists} />);
  await user.click(
    (await screen.findAllByRole('button', { name: 'Adicionar Eclipse Protocol à lista' }))[0],
  );
  expect(window.location.pathname).toBe('/entrar');
  act(() => services.auth.emit(authenticatedUser));
  await waitFor(() => expect(window.location.pathname).toBe('/lancamentos'));
  await user.click(await screen.findByRole('button', { name: 'RPGs' }));
  await user.click(screen.getByRole('button', { name: 'Adicionar' }));
  expect(services.lists.addGameToLists).toHaveBeenCalledWith(expectedGameSnapshot, [rpgList.id]);
});
```

Add a second integration test proving `/lancamentos` renders with no Supabase config and `/minhas-listas` redirects to Login with configuration copy instead of crashing.

- [ ] **Step 2: Verify RED, fix only uncovered integration seams, then verify GREEN**

Run: `npm run test:run -- src/app/App.test.tsx`

Expected before seam fixes: FAIL at the first missing provider injection or intent handoff. Expected after the smallest fixes: PASS.

- [ ] **Step 3: Document exact Supabase setup**

Add a README section with these ordered actions:

1. Create a Supabase project and apply `supabase/migrations/20260824000000_auth_and_lists.sql` through the CLI or SQL editor.
2. In Auth email templates, render the six-digit `{{ .Token }}` value.
3. Configure a production SMTP provider before public launch.
4. Enable Google, configure its client ID/secret in Supabase, and allow `http://localhost:3000/entrar` plus the production `/entrar` URL.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` locally and in Vercel.
6. State explicitly that `service_role` must never use a `VITE_` prefix or enter the frontend.

- [ ] **Step 4: Run focused and complete automated verification**

Run in order:

```bash
npm run test:run
npm run typecheck
npm run lint
npm run format:check
npm run build
git diff --check
```

Expected: every command exits 0 with no warnings introduced by this feature.

- [ ] **Step 5: Run database and browser verification when configured**

If a local Supabase CLI is available, run `supabase db reset` and execute the authenticated smoke flow against it. Otherwise, report the migration execution as the single environment-dependent verification.

Start the app with `npm run dev`, then use the in-app Browser to verify:

- `/` and `/lancamentos` without Supabase values;
- `/entrar` at mobile and desktop sizes;
- protected-route redirect;
- email-code form validation;
- Google button initiation without completing a real provider login in automated QA;
- list empty/loading/error/success views using configured test data;
- modal focus, persistence loading, and retained error state;
- console free of errors and no horizontal overflow.

- [ ] **Step 6: Inspect final diff and commit documentation/integration fixes**

Run: `git status --short && git diff --stat && git diff --check`

Then commit only files belonging to this task:

```bash
git add README.md src/app/App.test.tsx src/app/router.tsx
git commit -m "docs: add Supabase setup and integration coverage"
```

- [ ] **Step 7: Request review and finish the branch**

Use `superpowers:requesting-code-review`, resolve verified findings with a new failing test for behavioral changes, rerun the complete verification block, then use `superpowers:finishing-a-development-branch` to present integration options.
