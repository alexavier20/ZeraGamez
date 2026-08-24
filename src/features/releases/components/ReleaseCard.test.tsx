import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/features/auth/context/AuthProvider';
import { peekPendingAuthIntent } from '@/features/auth/model/pending-auth-intent';
import { ListsProvider } from '@/features/lists/context/ListsProvider';
import { ReleaseCard } from '@/features/releases/components/ReleaseCard';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';
import type { ListsRepository } from '@/features/lists/api/lists-repository';
import type { UserListSummary } from '@/features/lists/model/lists';
import type { ReleaseItem } from '@/features/releases/model/release-presentation';

const release: ReleaseItem = {
  id: 42,
  slug: 'eclipse-protocol',
  name: 'Eclipse Protocol',
  coverUrl: 'https://images.example.com/eclipse-protocol.jpg',
  releaseDate: '2026-08-10',
  platforms: [
    { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
    { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
    { id: 169, name: 'Xbox Series X|S', abbreviation: null },
  ],
  genres: [{ id: 31, name: 'Ação RPG' }],
};

const authenticatedUser: AuthenticatedUser = {
  avatarUrl: null,
  email: 'alex@example.com',
  id: '11111111-1111-4111-8111-111111111111',
  initials: 'AX',
  name: 'Alex Xavier',
};

const rpgList: UserListSummary = {
  covers: ['https://images.example/rpg.jpg'],
  description: 'Campanhas longas',
  gameCount: 2,
  id: 7,
  name: 'RPGs',
  systemKey: null,
};

const expectedGameSnapshot = {
  coverUrl: 'https://images.example.com/eclipse-protocol.jpg',
  igdbId: 42,
  name: 'Eclipse Protocol',
  releaseDate: '2026-08-10',
};

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function createAuthService(initialUser: AuthenticatedUser | null): AuthService {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(initialUser),
    onAuthStateChange: vi.fn(() => vi.fn()),
    requestEmailCode: vi.fn().mockResolvedValue(undefined),
    verifyEmailCode: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function createRepository(overrides: Partial<ListsRepository> = {}): ListsRepository {
  let wantToPlay = false;
  return {
    addGameToLists: vi.fn().mockResolvedValue([]),
    createList: vi.fn().mockResolvedValue(rpgList),
    getWantToPlayIds: vi.fn().mockResolvedValue(new Set<number>()),
    listSummaries: vi.fn().mockResolvedValue([rpgList]),
    toggleWantToPlay: vi.fn().mockImplementation(() => {
      wantToPlay = !wantToPlay;
      return Promise.resolve(wantToPlay);
    }),
    ...overrides,
  };
}

interface PersistentCardOptions {
  readonly authService?: AuthService | null;
  readonly onPendingActionConsumed?: () => void;
  readonly pendingAction?: React.ComponentProps<typeof ReleaseCard>['pendingAction'];
  readonly repository?: ListsRepository;
  readonly strict?: boolean;
}

function AuthStatus() {
  const { state } = useAuth();
  return <span data-testid="auth-status">{state.status}</span>;
}

function renderPersistentCard({
  authService = createAuthService(authenticatedUser),
  onPendingActionConsumed,
  pendingAction,
  repository = createRepository(),
  strict = false,
}: PersistentCardOptions = {}) {
  const card = (
    <AuthProvider service={authService}>
      <ListsProvider repository={repository}>
        <BrowserRouter>
          <AuthStatus />
          <ReleaseCard
            generatedAt="2026-08-10T12:00:00.000Z"
            item={release}
            onPendingActionConsumed={onPendingActionConsumed}
            pendingAction={pendingAction}
          />
        </BrowserRouter>
      </ListsProvider>
    </AuthProvider>
  );

  return { repository, ...render(strict ? <StrictMode>{card}</StrictMode> : card) };
}

function visualCard(item: ReleaseItem = release) {
  return (
    <BrowserRouter>
      <ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={item} />
    </BrowserRouter>
  );
}

async function waitForAuthenticated(): Promise<void> {
  expect(await screen.findByTestId('auth-status')).toHaveTextContent('authenticated');
}

describe('ReleaseCard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/lancamentos');
  });
  it('keeps CSS-selected desktop and mobile facades with their distinct cover geometry', () => {
    render(visualCard());

    const desktop = screen.getByTestId('release-card-desktop-42');
    const mobile = screen.getByTestId('release-card-mobile-42');

    expect(desktop).toHaveClass('hidden', 'h-[407px]', 'sm:flex', 'sm:flex-col', 'sm:gap-2');
    expect(desktop).not.toHaveClass('overflow-hidden');
    expect(mobile).toHaveClass('grid', 'grid-cols-[82px_minmax(0,1fr)]', 'sm:hidden');

    const desktopCover = within(desktop).getByRole('img', { name: 'Capa de Eclipse Protocol' });
    const mobileCover = within(mobile).getByRole('img', { name: 'Capa de Eclipse Protocol' });

    expect(desktopCover).toHaveAttribute('loading', 'lazy');
    expect(desktopCover).toHaveClass('h-[244px]', 'w-full', 'object-cover');
    expect(desktopCover).not.toHaveClass('aspect-square');
    expect(mobileCover).toHaveAttribute('loading', 'lazy');
    expect(mobileCover).toHaveClass('h-full', 'w-[82px]', 'object-cover');
  });

  it('renders constrained metadata with full values available through titles', () => {
    const { rerender } = render(visualCard());

    const desktop = screen.getByTestId('release-card-desktop-42');
    const mobile = screen.getByTestId('release-card-mobile-42');

    expect(within(desktop).getByText('10 de agosto de 2026')).toBeInTheDocument();
    expect(within(desktop).getByText('Lança hoje')).toBeInTheDocument();
    expect(within(desktop).getByText('Ação RPG')).toBeInTheDocument();
    expect(within(desktop).getByText('PC')).toBeInTheDocument();
    expect(within(desktop).getByText('PS5')).toBeInTheDocument();
    expect(within(desktop).getByText('+1')).toBeInTheDocument();
    expect(within(mobile).getByText('PC • PS5 • +1')).toBeInTheDocument();

    const desktopPlatformRow = within(desktop).getByText('PC').parentElement;
    const desktopGenre = within(desktop).getByText('Ação RPG');
    expect(desktopGenre.parentElement).toBe(desktopPlatformRow);
    expect(desktopPlatformRow).toHaveClass('flex', 'min-w-0', 'items-center', 'gap-1.5');

    const desktopActions = within(desktop).getByRole('button', {
      name: 'Adicionar Eclipse Protocol à lista',
    }).parentElement;
    expect(desktopActions).toHaveClass('pt-2');

    const headings = screen.getAllByRole('heading', { name: 'Eclipse Protocol' });
    expect(headings).toHaveLength(2);
    for (const heading of headings) {
      expect(heading).toHaveAttribute('title', 'Eclipse Protocol');
    }
    expect(within(mobile).getByText('PC • PS5 • +1')).toHaveAttribute('title', 'PC • PS5 • +1');
    for (const genre of screen.getAllByText('Ação RPG')) {
      expect(genre).toHaveAttribute('title', 'Ação RPG');
    }
    expect(within(mobile).getByText('10 de agosto de 2026')).toHaveAttribute(
      'title',
      '10 de agosto de 2026',
    );

    rerender(visualCard({ ...release, genres: [] }));

    expect(screen.queryByText('Ação RPG')).not.toBeInTheDocument();
  });

  it('uses stable platform identity when fallback labels are duplicated', () => {
    const duplicateLabel = 'Plataforma doméstica com um nome excepcionalmente comprido';
    const duplicatedPlatforms: ReleaseItem = {
      ...release,
      platforms: [
        { id: 200, name: duplicateLabel, abbreviation: null },
        { id: 201, name: duplicateLabel, abbreviation: null },
      ],
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      render(visualCard(duplicatedPlatforms));

      expect(consoleError).not.toHaveBeenCalled();
      expect(
        within(screen.getByTestId('release-card-desktop-42')).getAllByText(duplicateLabel),
      ).toHaveLength(2);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('shrinks long textual chips while preserving titles, the summary, and the genre', () => {
    const firstPlatform = 'Plataforma doméstica com um nome excepcionalmente comprido';
    const secondPlatform = 'Outro dispositivo de entretenimento com nome ainda mais extenso';
    const longGenre = 'Aventura narrativa cinematográfica de mundo aberto';
    render(
      visualCard({
        ...release,
        platforms: [
          { id: 200, name: firstPlatform, abbreviation: null },
          { id: 201, name: secondPlatform, abbreviation: null },
          { id: 202, name: 'Console portátil', abbreviation: null },
        ],
        genres: [{ id: 301, name: longGenre }],
      }),
    );

    const desktop = screen.getByTestId('release-card-desktop-42');
    for (const label of [firstPlatform, secondPlatform]) {
      expect(within(desktop).getByText(label)).toHaveAttribute('title', label);
      expect(within(desktop).getByText(label)).toHaveClass('min-w-0', 'shrink', 'truncate');
      expect(within(desktop).getByText(label)).not.toHaveClass('shrink-0');
    }
    expect(within(desktop).getByText('+1')).toHaveClass('shrink-0');
    expect(within(desktop).getByText(longGenre)).toHaveAttribute('title', longGenre);
    expect(within(desktop).getByText(longGenre)).toHaveClass(
      'min-w-[4rem]',
      'max-w-[40%]',
      'shrink',
      'truncate',
    );
  });

  it('keeps want-to-play and list actions available', () => {
    render(visualCard());

    for (const layout of [
      screen.getByTestId('release-card-desktop-42'),
      screen.getByTestId('release-card-mobile-42'),
    ]) {
      expect(
        within(layout).getByRole('button', {
          name: 'Marcar Eclipse Protocol como quero jogar',
        }),
      ).toBeEnabled();
      expect(
        within(layout).getByRole('button', { name: 'Adicionar Eclipse Protocol à lista' }),
      ).toBeEnabled();
    }

    const icons = document.querySelectorAll('svg.lucide');
    for (const icon of icons) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('omits the more-options action from desktop and mobile cards', () => {
    render(visualCard());

    for (const layout of [
      screen.getByTestId('release-card-desktop-42'),
      screen.getByTestId('release-card-mobile-42'),
    ]) {
      expect(
        within(layout).queryByRole('button', { name: 'Mais opções para Eclipse Protocol' }),
      ).not.toBeInTheDocument();
    }
  });

  it('asks for authentication instead of mutating an anonymous card', async () => {
    const user = userEvent.setup();
    const toggleWantToPlay = vi.fn().mockResolvedValue(true);
    const repository = createRepository({ toggleWantToPlay });
    renderPersistentCard({
      authService: createAuthService(null),
      repository,
    });
    expect(await screen.findByTestId('auth-status')).toHaveTextContent('anonymous');

    await user.click(
      screen.getAllByRole('button', { name: 'Marcar Eclipse Protocol como quero jogar' })[0],
    );

    expect(window.location.pathname).toBe('/entrar');
    expect(peekPendingAuthIntent(sessionStorage)).toMatchObject({
      type: 'toggle-want-to-play',
      igdbId: 42,
    });
    expect(toggleWantToPlay).not.toHaveBeenCalled();
  });

  it('disables both responsive list actions while authentication is loading without redirecting or mutating', async () => {
    const pendingAuth = deferred<AuthenticatedUser | null>();
    const listSummaries = vi.fn().mockResolvedValue([rpgList]);
    const addGameToLists = vi.fn().mockResolvedValue([]);
    const toggleWantToPlay = vi.fn().mockResolvedValue(true);
    const repository = createRepository({ addGameToLists, listSummaries, toggleWantToPlay });
    const authService: AuthService = {
      ...createAuthService(null),
      getCurrentUser: vi.fn(() => pendingAuth.promise),
    };
    renderPersistentCard({ authService, repository });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('loading');
    for (const layout of [
      screen.getByTestId('release-card-desktop-42'),
      screen.getByTestId('release-card-mobile-42'),
    ]) {
      expect(
        within(layout).getByRole('button', { name: 'Adicionar Eclipse Protocol à lista' }),
      ).toBeDisabled();
      expect(
        within(layout).getByRole('button', {
          name: 'Marcar Eclipse Protocol como quero jogar',
        }),
      ).toBeDisabled();
    }
    expect(window.location.pathname).toBe('/lancamentos');
    expect(peekPendingAuthIntent(sessionStorage)).toBeNull();
    expect(listSummaries).not.toHaveBeenCalled();
    expect(addGameToLists).not.toHaveBeenCalled();
    expect(toggleWantToPlay).not.toHaveBeenCalled();

    pendingAuth.resolve(null);
    expect(await screen.findByTestId('auth-status')).toHaveTextContent('anonymous');
  });

  it('stores a safe list intent when authentication is unavailable without loading lists', async () => {
    const user = userEvent.setup();
    const listSummaries = vi.fn().mockResolvedValue([rpgList]);
    const addGameToLists = vi.fn().mockResolvedValue([]);
    const repository = createRepository({ addGameToLists, listSummaries });
    renderPersistentCard({ authService: null, repository });
    expect(await screen.findByTestId('auth-status')).toHaveTextContent('unavailable');

    await user.click(
      screen.getAllByRole('button', { name: 'Adicionar Eclipse Protocol à lista' })[0],
    );

    expect(window.location.pathname).toBe('/entrar');
    expect(peekPendingAuthIntent(sessionStorage)).toMatchObject({
      type: 'open-add-to-lists',
      igdbId: 42,
    });
    expect(listSummaries).not.toHaveBeenCalled();
    expect(addGameToLists).not.toHaveBeenCalled();
  });

  it('changes want-to-play only after the RPC confirms and shares pending state', async () => {
    const user = userEvent.setup();
    const pending = deferred<boolean>();
    const toggleWantToPlay = vi.fn(() => pending.promise);
    const repository = createRepository({ toggleWantToPlay });
    const authService = createAuthService(authenticatedUser);
    renderPersistentCard({ authService, repository });
    await waitForAuthenticated();
    const buttons = screen.getAllByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    });

    await user.click(buttons[0]);

    for (const button of buttons) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    expect(toggleWantToPlay).toHaveBeenCalledWith(expectedGameSnapshot);

    pending.resolve(true);
    await waitFor(() => {
      for (const button of screen.getAllByRole('button', {
        name: 'Remover Eclipse Protocol de Quero jogar',
      })) {
        expect(button).toBeEnabled();
        expect(button).toHaveAttribute('aria-pressed', 'true');
      }
    });
  });

  it('preserves confirmed want-to-play state and announces sanitized copy after RPC failure', async () => {
    const user = userEvent.setup();
    const toggleWantToPlay = vi.fn().mockRejectedValue(new Error('raw rpc detail'));
    const repository = createRepository({ toggleWantToPlay });
    const authService = createAuthService(authenticatedUser);
    renderPersistentCard({ authService, repository });
    await waitForAuthenticated();

    await user.click(
      screen.getAllByRole('button', { name: 'Marcar Eclipse Protocol como quero jogar' })[0],
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível atualizar Quero jogar. Tente novamente.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('raw rpc detail');
    expect(screen.getByRole('alert')).not.toHaveClass('sr-only');
    for (const button of screen.getAllByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    })) {
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('loads real lists lazily and saves selected numeric ids with the exact game snapshot', async () => {
    const user = userEvent.setup();
    const addGameToLists = vi.fn().mockResolvedValue([rpgList.id]);
    const listSummaries = vi.fn().mockResolvedValue([rpgList]);
    const repository = createRepository({
      addGameToLists,
      listSummaries,
    });
    const authService = createAuthService(authenticatedUser);
    renderPersistentCard({ authService, repository });
    await waitForAuthenticated();
    expect(listSummaries).not.toHaveBeenCalled();

    await user.click(
      screen.getAllByRole('button', { name: 'Adicionar Eclipse Protocol à lista' })[0],
    );

    await waitFor(() => {
      expect(listSummaries).toHaveBeenCalledOnce();
    });
    await user.click(await screen.findByRole('button', { name: 'RPGs' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => {
      expect(addGameToLists).toHaveBeenCalledWith(expectedGameSnapshot, [rpgList.id]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('resets an open modal selection and reloads lists when the provider scope changes', async () => {
    const user = userEvent.setup();
    const authService = createAuthService(authenticatedUser);
    const nextList: UserListSummary = { ...rpgList, id: 19, name: 'Nova conta' };
    const repositoryA = createRepository({
      listSummaries: vi.fn().mockResolvedValue([rpgList]),
    });
    const listSummariesB = vi.fn().mockResolvedValue([nextList]);
    const repositoryB = createRepository({ listSummaries: listSummariesB });
    const tree = (repository: ListsRepository) => (
      <AuthProvider service={authService}>
        <ListsProvider repository={repository}>
          <BrowserRouter>
            <AuthStatus />
            <ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />
          </BrowserRouter>
        </ListsProvider>
      </AuthProvider>
    );
    const { rerender } = render(tree(repositoryA));
    await waitForAuthenticated();

    await user.click(
      screen.getAllByRole('button', { name: 'Adicionar Eclipse Protocol à lista' })[0],
    );
    await user.click(await screen.findByRole('button', { name: 'RPGs' }));
    expect(screen.getByText('1 lista selecionada')).toBeInTheDocument();

    rerender(tree(repositoryB));

    expect(await screen.findByRole('button', { name: 'Nova conta' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('Selecione uma ou mais listas')).toBeInTheDocument();
    expect(listSummariesB).toHaveBeenCalledOnce();
  });

  it('toggles want-to-play from either layout and keeps desktop and mobile in sync', async () => {
    const user = userEvent.setup();
    const authService = createAuthService(authenticatedUser);
    renderPersistentCard({ authService });
    await waitForAuthenticated();

    const desktop = screen.getByTestId('release-card-desktop-42');
    const mobile = screen.getByTestId('release-card-mobile-42');
    const desktopButton = within(desktop).getByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    });
    const mobileButton = within(mobile).getByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    });

    expect(desktopButton).toHaveAttribute('aria-pressed', 'false');
    expect(mobileButton).toHaveAttribute('aria-pressed', 'false');
    expect(desktopButton).toHaveClass('h-7', 'w-[104px]', 'bg-app/80');
    expect(mobileButton).not.toHaveClass('w-[104px]');
    expect(within(desktopButton).getByText('Quero jogar!')).toBeInTheDocument();
    expect(within(mobileButton).queryByText('Quero jogar!')).not.toBeInTheDocument();
    expect(desktopButton.querySelector('svg.lucide-gamepad-2')).toBeInTheDocument();
    expect(mobileButton.querySelector('svg.lucide-gamepad-2')).toBeInTheDocument();

    await user.click(desktopButton);

    const selectedDesktopButton = within(desktop).getByRole('button', {
      name: 'Remover Eclipse Protocol de Quero jogar',
    });
    const selectedMobileButton = within(mobile).getByRole('button', {
      name: 'Remover Eclipse Protocol de Quero jogar',
    });
    for (const button of [selectedDesktopButton, selectedMobileButton]) {
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveClass('bg-success');
      expect(button.querySelector('svg.lucide-circle-check')).toBeInTheDocument();
    }

    await user.click(selectedMobileButton);

    const restoredDesktopButton = within(desktop).getByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    });
    const restoredMobileButton = within(mobile).getByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    });
    for (const button of [restoredDesktopButton, restoredMobileButton]) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).not.toHaveClass('bg-success');
      expect(button.querySelector('svg.lucide-gamepad-2')).toBeInTheDocument();
      expect(button.querySelector('svg.lucide-circle-check')).not.toBeInTheDocument();
    }
  });

  it('opens one modal for the selected game and restores focus to its trigger on close', async () => {
    const user = userEvent.setup();
    const authService = createAuthService(authenticatedUser);
    renderPersistentCard({ authService });
    await waitForAuthenticated();

    const trigger = within(screen.getByTestId('release-card-desktop-42')).getByRole('button', {
      name: 'Adicionar Eclipse Protocol à lista',
    });
    await user.click(trigger);

    expect(
      screen.getByRole('dialog', { name: 'Adicionar Eclipse Protocol à lista' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Fechar modal' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('restores focus to the responsive add button after an automatically resumed modal closes', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          addEventListener: vi.fn(),
          addListener: vi.fn(),
          dispatchEvent: vi.fn(),
          matches: false,
          media: query,
          onchange: null,
          removeEventListener: vi.fn(),
          removeListener: vi.fn(),
        }) as MediaQueryList,
    );
    const onPendingActionConsumed = vi.fn();

    try {
      renderPersistentCard({
        onPendingActionConsumed,
        pendingAction: 'open-add-to-lists',
      });
      await waitForAuthenticated();
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(onPendingActionConsumed).toHaveBeenCalledOnce();

      await user.click(screen.getByRole('button', { name: 'Fechar modal' }));

      const mobileAddButton = within(screen.getByTestId('release-card-mobile-42')).getByRole(
        'button',
        { name: 'Adicionar Eclipse Protocol à lista' },
      );
      expect(mobileAddButton).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('renders accessible desktop and mobile placeholders with decorative gamepad icons', () => {
    render(visualCard({ ...release, coverUrl: null }));

    const desktop = screen.getByTestId('release-card-desktop-42');
    const mobile = screen.getByTestId('release-card-mobile-42');
    const desktopPlaceholder = within(desktop).getByRole('img', {
      name: 'Capa indisponível de Eclipse Protocol',
    });
    const mobilePlaceholder = within(mobile).getByRole('img', {
      name: 'Capa indisponível de Eclipse Protocol',
    });

    expect(desktopPlaceholder).toHaveClass('h-[244px]', 'w-full');
    expect(desktopPlaceholder).not.toHaveClass('aspect-square');
    expect(mobilePlaceholder).toHaveClass('h-full', 'w-[82px]');
    expect(desktopPlaceholder.querySelector('svg.lucide-gamepad-2')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(mobilePlaceholder.querySelector('svg.lucide-gamepad-2')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
