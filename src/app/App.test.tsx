import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from '@/app/router';
import {
  peekPendingAuthIntent,
  savePendingAuthIntent,
} from '@/features/auth/model/pending-auth-intent';
import {
  addCalendarMonths,
  buildCalendarMonth,
  calendarMonthStart,
  formatCalendarLongDate,
  formatCalendarMonth,
  formatCalendarShortDate,
  todayInSaoPaulo,
} from '@/features/releases/model/release-calendar';
import { formatReleaseDate } from '@/features/releases/model/release-presentation';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';
import type { ListsRepository } from '@/features/lists/api/lists-repository';
import type { UserListSummary } from '@/features/lists/model/lists';
import type { ReleasesClientQuery } from '@/features/releases/api/releases-client';

const emptyPayload = {
  data: [],
  meta: {
    from: '2026-08-07',
    to: '2026-11-05',
    count: 0,
    limit: 100,
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceTruncated: false,
  },
};

const payload = {
  ...emptyPayload,
  data: [
    {
      id: 1,
      slug: 'eclipse-protocol',
      name: 'Eclipse Protocol',
      coverUrl: null,
      releaseDate: '2026-08-10',
      platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
      genres: [{ id: 12, name: 'Role-playing (RPG)' }],
    },
    {
      id: 2,
      slug: 'second-game',
      name: 'Second Game',
      coverUrl: null,
      releaseDate: '2026-08-10',
      platforms: [{ id: 48, name: 'PlayStation 4', abbreviation: 'PS4' }],
      genres: [],
    },
  ],
  meta: {
    ...emptyPayload.meta,
    count: 2,
    generatedAt: '2026-08-10T12:00:00.000Z',
  },
};

const nextPayload = {
  data: [
    {
      id: 3,
      slug: 'future-game',
      name: 'Future Game',
      coverUrl: null,
      releaseDate: '2026-12-15',
      platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
      genres: [],
    },
  ],
  meta: {
    ...emptyPayload.meta,
    from: '2026-11-06',
    to: '2027-02-04',
    count: 1,
    generatedAt: '2026-11-06T12:00:00.000Z',
  },
};

const exhaustedPayload = {
  ...payload,
  meta: {
    ...payload.meta,
    to: '2028-08-06',
  },
};

const authenticatedUser: AuthenticatedUser = {
  avatarUrl: null,
  email: 'alex@example.com',
  id: '11111111-1111-4111-8111-111111111111',
  initials: 'AX',
  name: 'Alex Xavier',
};

const rpgList: UserListSummary = {
  covers: [],
  description: null,
  gameCount: 0,
  id: 7,
  name: 'RPGs',
  systemKey: null,
};

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

function createControllableAuthService(initialUser: AuthenticatedUser | null) {
  const listeners = new Set<(user: AuthenticatedUser | null) => void>();

  return {
    emit(user: AuthenticatedUser | null) {
      for (const listener of listeners) listener(user);
    },
    service: {
      ...createAuthService(initialUser),
      onAuthStateChange: vi.fn((listener: (user: AuthenticatedUser | null) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
    } satisfies AuthService,
  };
}

function createListsRepository(overrides: Partial<ListsRepository> = {}): ListsRepository {
  return {
    addGameToLists: vi.fn().mockResolvedValue([]),
    createList: vi.fn().mockResolvedValue(rpgList),
    getWantToPlayIds: vi.fn().mockResolvedValue(new Set<number>()),
    listSummaries: vi.fn().mockResolvedValue([rpgList]),
    setWantToPlay: vi
      .fn()
      .mockImplementation((_game, desired: boolean) => Promise.resolve(desired)),
    ...overrides,
  };
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function exactPayload(releaseDate: string, count = 1) {
  const data = payload.data.slice(0, count).map((item) => ({ ...item, releaseDate }));
  return {
    data,
    meta: {
      ...emptyPayload.meta,
      from: releaseDate,
      to: releaseDate,
      count: data.length,
      generatedAt: `${releaseDate}T12:00:00.000Z`,
    },
  };
}

const fetchReleasesMock = vi.hoisted(() => vi.fn());

let releaseObserverCallback: IntersectionObserverCallback | undefined;
let releaseObserverInstance: IntersectionObserver | undefined;
let releaseObservedTarget: Element | undefined;

class ReleaseIntersectionObserverDouble {
  constructor(callback: IntersectionObserverCallback) {
    releaseObserverCallback = callback;
    releaseObserverInstance = this as unknown as IntersectionObserver;
  }

  observe = vi.fn((target: Element) => {
    releaseObservedTarget = target;
  });
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  readonly root = null;
  readonly rootMargin = '600px 0px';
  readonly thresholds = [0];
}

function intersectReleaseSentinel() {
  if (!releaseObserverCallback || !releaseObserverInstance) {
    throw new Error('Release sentinel is not being observed');
  }

  releaseObserverCallback(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    releaseObserverInstance,
  );
}

vi.mock('@/features/releases/api/releases-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/releases/api/releases-client')>();
  return { ...actual, fetchReleases: fetchReleasesMock };
});

function expectShellOrder() {
  const header = screen.getByRole('banner');
  const main = screen.getByRole('main');
  const mobileNavigation = screen.getByRole('navigation', { name: 'Navegação móvel' });

  expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(main.compareDocumentPosition(mobileNavigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe('Zera GameZ', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchReleasesMock.mockReset();
    fetchReleasesMock.mockResolvedValue(payload);
    releaseObserverCallback = undefined;
    releaseObserverInstance = undefined;
    releaseObservedTarget = undefined;
    vi.stubGlobal('IntersectionObserver', ReleaseIntersectionObserverDouble);
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renderiza a página inicial', () => {
    render(<AppRouter authService={null} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Zera GameZ' })).toBeInTheDocument();
    expect(screen.getByText('Em construção')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { hidden: true, name: 'Navegação principal' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeInTheDocument();
    expectShellOrder();
  });

  it('abre Lançamentos com o título responsivo selecionado no Pencil', async () => {
    const user = userEvent.setup();
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    render(<AppRouter authService={null} />);

    const releasesLink = screen.getByRole('link', { name: 'Lançamentos' });
    await user.click(releasesLink);

    const main = screen.getByRole('main', { name: 'Lançamentos' });

    expect(window.location.pathname).toBe('/lancamentos');
    const pageHeading = screen.getByRole('heading', { level: 1, name: 'Próximos lançamentos' });
    expect(pageHeading).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Descubra os games que estão chegando')).toBeInTheDocument();
    expect(pageHeading.parentElement?.parentElement).toHaveClass(
      'lg:flex',
      'lg:items-end',
      'lg:justify-between',
    );
    const viewSwitcher = screen.getByRole('group', { name: 'Alternar visualização' });
    const listButton = screen.getByRole('button', { name: 'Lista' });
    const calendarButton = screen.getByRole('button', { name: 'Calendário' });

    expect(viewSwitcher).toHaveClass('hidden', 'lg:flex');
    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(calendarButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('region', { name: 'Resultados de lan\u00e7amentos' })).toHaveAttribute(
      'id',
      'release-results',
    );
    expect(await screen.findByRole('list', { name: 'Hoje 10 de agosto' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(fetchReleasesMock).toHaveBeenCalledTimes(1);
    const expectedSignal: unknown = expect.any(AbortSignal);
    expect(fetchReleasesMock).toHaveBeenCalledWith({ limit: 100 }, { signal: expectedSignal });

    await user.click(calendarButton);

    expect(listButton).toHaveAttribute('aria-pressed', 'false');
    expect(calendarButton).toHaveAttribute('aria-pressed', 'true');
    expect(calendarButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Hoje 10 de agosto' })).toBeInTheDocument();
    expect(await screen.findByTestId('release-indicator-2026-08-10')).toBeInTheDocument();
    expect(fetchReleasesMock).toHaveBeenCalledTimes(1);

    await user.click(listButton);

    expect(screen.getByRole('list', { name: 'Hoje 10 de agosto' })).toBeInTheDocument();
    expect(screen.getAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(fetchReleasesMock).toHaveBeenCalledTimes(1);

    const headingAndSwitcher = pageHeading.parentElement?.parentElement;
    const filters = screen.getByRole('region', { name: 'Filtros de lançamentos' });

    expect(
      (headingAndSwitcher?.compareDocumentPosition(filters) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(filters).toHaveClass('mt-[18px]', 'sm:mt-[22px]', 'lg:mt-7');

    expect(main).toHaveClass(
      'mx-auto',
      'max-w-[1440px]',
      'px-4',
      'pt-[22px]',
      'sm:px-5',
      'sm:pt-7',
      'lg:px-8',
      'lg:pt-9',
    );
    expect(releasesLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeInTheDocument();
    expect(screen.queryByText('Em construção')).not.toBeInTheDocument();
    expectShellOrder();
    await waitFor(() => {
      expect(info).toHaveBeenCalledWith('[releases] Próximos lançamentos', payload);
    });
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('loads want-to-play memberships once per successful accumulated response in Strict Mode', async () => {
    const getWantToPlayIds = vi.fn().mockResolvedValue(new Set([1]));
    const repository = createListsRepository({ getWantToPlayIds });
    fetchReleasesMock.mockResolvedValueOnce(payload).mockResolvedValueOnce(nextPayload);
    window.history.replaceState({}, '', '/lancamentos');

    render(
      <StrictMode>
        <AppRouter
          authService={createAuthService(authenticatedUser)}
          listsRepository={repository}
        />
      </StrictMode>,
    );

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await waitFor(() => {
      expect(getWantToPlayIds).toHaveBeenCalledOnce();
    });
    expect(getWantToPlayIds).toHaveBeenLastCalledWith([1, 2]);
    await waitFor(() => {
      expect(releaseObservedTarget).toBeDefined();
    });

    act(() => {
      intersectReleaseSentinel();
    });

    expect(await screen.findAllByText('Future Game')).toHaveLength(2);
    await waitFor(() => {
      expect(getWantToPlayIds).toHaveBeenCalledTimes(2);
    });
    expect(getWantToPlayIds).toHaveBeenLastCalledWith([1, 2, 3]);
  });

  it('reloads memberships across A to B to A repository scopes for the same user and ids', async () => {
    const getWantToPlayIdsA = vi.fn().mockResolvedValue(new Set([1]));
    const getWantToPlayIdsB = vi.fn().mockResolvedValue(new Set([2]));
    const repositoryA = createListsRepository({ getWantToPlayIds: getWantToPlayIdsA });
    const repositoryB = createListsRepository({ getWantToPlayIds: getWantToPlayIdsB });
    const authService = createAuthService(authenticatedUser);
    window.history.replaceState({}, '', '/lancamentos');

    const { rerender } = render(
      <AppRouter authService={authService} listsRepository={repositoryA} />,
    );
    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await waitFor(() => {
      expect(getWantToPlayIdsA).toHaveBeenCalledOnce();
    });

    rerender(<AppRouter authService={authService} listsRepository={repositoryB} />);
    await waitFor(() => {
      expect(getWantToPlayIdsB).toHaveBeenCalledOnce();
    });

    rerender(<AppRouter authService={authService} listsRepository={repositoryA} />);
    await waitFor(() => {
      expect(getWantToPlayIdsA).toHaveBeenCalledTimes(2);
    });
    expect(getWantToPlayIdsA).toHaveBeenLastCalledWith([1, 2]);
  });

  it('never loads private memberships for an anonymous release response', async () => {
    const authService = createAuthService(null);
    const getWantToPlayIds = vi.fn().mockResolvedValue(new Set<number>());
    const repository = createListsRepository({ getWantToPlayIds });
    window.history.replaceState({}, '', '/lancamentos');

    render(<AppRouter authService={authService} listsRepository={repository} />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(await screen.findAllByRole('link', { name: 'Entrar' })).not.toHaveLength(0);
    expect(getWantToPlayIds).not.toHaveBeenCalled();
  });

  it('handles a failed membership batch and retries all accumulated ids on the next response', async () => {
    const getWantToPlayIds = vi
      .fn()
      .mockRejectedValueOnce(new Error('raw membership detail'))
      .mockResolvedValueOnce(new Set([3]));
    const repository = createListsRepository({ getWantToPlayIds });
    fetchReleasesMock.mockResolvedValueOnce(payload).mockResolvedValueOnce(nextPayload);
    window.history.replaceState({}, '', '/lancamentos');

    render(
      <AppRouter authService={createAuthService(authenticatedUser)} listsRepository={repository} />,
    );

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await waitFor(() => {
      expect(getWantToPlayIds).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(releaseObservedTarget).toBeDefined();
    });
    act(() => {
      intersectReleaseSentinel();
    });

    expect(await screen.findAllByText('Future Game')).toHaveLength(2);
    await waitFor(() => {
      expect(getWantToPlayIds).toHaveBeenCalledTimes(2);
    });
    expect(getWantToPlayIds).toHaveBeenLastCalledWith([1, 2, 3]);
  });

  it('keeps a matching pending action until membership is known then sets desired true once', async () => {
    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'toggle-want-to-play',
      returnTo: '/lancamentos',
      igdbId: 1,
    });
    const membership = deferred<ReadonlySet<number>>();
    const getWantToPlayIds = vi.fn(() => membership.promise);
    const setWantToPlay = vi.fn().mockResolvedValue(true);
    const repository = createListsRepository({ getWantToPlayIds, setWantToPlay });
    window.history.replaceState({}, '', '/lancamentos');

    render(
      <StrictMode>
        <AppRouter
          authService={createAuthService(authenticatedUser)}
          listsRepository={repository}
        />
      </StrictMode>,
    );

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(peekPendingAuthIntent(sessionStorage)).toMatchObject({ igdbId: 1 });
    expect(setWantToPlay).not.toHaveBeenCalled();

    membership.resolve(new Set([1]));
    await waitFor(() => {
      expect(setWantToPlay).toHaveBeenCalledOnce();
    });
    expect(setWantToPlay).toHaveBeenCalledWith(
      {
        coverUrl: null,
        igdbId: 1,
        name: 'Eclipse Protocol',
        releaseDate: '2026-08-10',
      },
      true,
    );
    expect(peekPendingAuthIntent(sessionStorage)).toBeNull();
  });

  it('returns from login and resumes adding the release to a real list', async () => {
    const user = userEvent.setup();
    const auth = createControllableAuthService(null);
    const addGameToLists = vi.fn().mockResolvedValue([rpgList.id]);
    const repository = createListsRepository({ addGameToLists });
    window.history.replaceState({}, '', '/lancamentos');

    render(<AppRouter authService={auth.service} listsRepository={repository} />);

    await user.click(
      (
        await screen.findAllByRole('button', {
          name: 'Adicionar Eclipse Protocol à lista',
        })
      )[0],
    );
    await waitFor(() => {
      expect(window.location.pathname).toBe('/entrar');
    });

    act(() => {
      auth.emit(authenticatedUser);
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe('/lancamentos');
    });
    const dialog = await screen.findByRole('dialog', {
      name: 'Adicionar Eclipse Protocol à lista',
    });
    await user.click(await within(dialog).findByRole('button', { name: 'RPGs' }));
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => {
      expect(addGameToLists).toHaveBeenCalledWith(
        {
          coverUrl: null,
          igdbId: 1,
          name: 'Eclipse Protocol',
          releaseDate: '2026-08-10',
        },
        [7],
      );
    });
  });

  it('keeps public releases available without configuration and guides protected-route login', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/lancamentos');

    render(<AppRouter authService={null} listsRepository={null} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Próximos lançamentos' }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);

    await user.click(screen.getByRole('link', { name: 'Minhas listas' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Entre para continuar' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/entrar');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A autenticação ainda não está configurada.',
    );
  });

  it('automatically searches later pages before consuming a matching pending action', async () => {
    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'toggle-want-to-play',
      returnTo: '/lancamentos',
      igdbId: 3,
    });
    const setWantToPlay = vi.fn().mockResolvedValue(true);
    const repository = createListsRepository({ setWantToPlay });
    fetchReleasesMock.mockResolvedValueOnce(payload).mockResolvedValueOnce(nextPayload);
    window.history.replaceState({}, '', '/lancamentos');

    render(
      <StrictMode>
        <AppRouter
          authService={createAuthService(authenticatedUser)}
          listsRepository={repository}
        />
      </StrictMode>,
    );

    expect(await screen.findAllByText('Future Game')).toHaveLength(2);
    await waitFor(() => {
      expect(setWantToPlay).toHaveBeenCalledOnce();
    });
    expect(setWantToPlay).toHaveBeenCalledWith(
      {
        coverUrl: null,
        igdbId: 3,
        name: 'Future Game',
        releaseDate: '2026-12-15',
      },
      true,
    );
    expect(fetchReleasesMock).toHaveBeenCalledTimes(2);
    expect(peekPendingAuthIntent(sessionStorage)).toBeNull();
  });

  it('preserves a later-page intent on pagination error and consumes it after retry', async () => {
    const user = userEvent.setup();
    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'toggle-want-to-play',
      returnTo: '/lancamentos',
      igdbId: 3,
    });
    const setWantToPlay = vi.fn().mockResolvedValue(true);
    const repository = createListsRepository({ setWantToPlay });
    fetchReleasesMock
      .mockResolvedValueOnce(payload)
      .mockRejectedValueOnce(new Error('raw pagination detail'))
      .mockResolvedValueOnce(nextPayload);
    window.history.replaceState({}, '', '/lancamentos');

    render(
      <AppRouter authService={createAuthService(authenticatedUser)} listsRepository={repository} />,
    );

    expect(await screen.findByText('Não foi possível carregar mais jogos')).toBeInTheDocument();
    expect(peekPendingAuthIntent(sessionStorage)).toMatchObject({ igdbId: 3 });
    expect(setWantToPlay).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findAllByText('Future Game')).toHaveLength(2);
    await waitFor(() => {
      expect(setWantToPlay).toHaveBeenCalledOnce();
    });
    expect(peekPendingAuthIntent(sessionStorage)).toBeNull();
  });

  it('targets one deterministic release date when an IGDB id occurs more than once', async () => {
    const duplicatedPayload = {
      ...exhaustedPayload,
      data: [
        payload.data[0],
        {
          ...payload.data[0],
          name: 'Eclipse Protocol Later',
          releaseDate: '2026-09-10',
        },
      ],
      meta: { ...exhaustedPayload.meta, count: 2 },
    };
    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'toggle-want-to-play',
      returnTo: '/lancamentos',
      igdbId: 1,
    });
    const setWantToPlay = vi.fn().mockResolvedValue(true);
    const repository = createListsRepository({ setWantToPlay });
    fetchReleasesMock.mockResolvedValueOnce(duplicatedPayload);
    window.history.replaceState({}, '', '/lancamentos');

    render(
      <StrictMode>
        <AppRouter
          authService={createAuthService(authenticatedUser)}
          listsRepository={repository}
        />
      </StrictMode>,
    );

    expect(await screen.findAllByText('Eclipse Protocol Later')).toHaveLength(2);
    await waitFor(() => {
      expect(setWantToPlay).toHaveBeenCalledOnce();
    });
    expect(setWantToPlay).toHaveBeenCalledWith(
      {
        coverUrl: null,
        igdbId: 1,
        name: 'Eclipse Protocol',
        releaseDate: '2026-08-10',
      },
      true,
    );
  });

  it('clears an unmatched pending action after releases settle and announces exact recovery copy', async () => {
    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'open-add-to-lists',
      returnTo: '/lancamentos',
      igdbId: 999,
    });
    const setWantToPlay = vi.fn().mockResolvedValue(true);
    const addGameToLists = vi.fn().mockResolvedValue([]);
    const repository = createListsRepository({ addGameToLists, setWantToPlay });
    fetchReleasesMock.mockResolvedValueOnce(exhaustedPayload);
    window.history.replaceState({}, '', '/lancamentos');

    render(
      <AppRouter authService={createAuthService(authenticatedUser)} listsRepository={repository} />,
    );

    expect(
      await screen.findByText('O jogo não está mais nesta lista. Tente novamente.'),
    ).toHaveAttribute('role', 'status');
    expect(peekPendingAuthIntent(sessionStorage)).toBeNull();
    expect(setWantToPlay).not.toHaveBeenCalled();
    expect(addGameToLists).not.toHaveBeenCalled();
  });

  it('resets an unselected calendar to the current month whenever it reopens', async () => {
    const user = userEvent.setup();
    const currentDate = todayInSaoPaulo();
    const currentMonth = calendarMonthStart(currentDate);
    const nextMonth = addCalendarMonths(currentMonth, 1);
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(
      screen.getByRole('dialog', { name: formatCalendarMonth(nextMonth) }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lista' }));
    await user.click(screen.getByRole('button', { name: 'Calendário' }));

    expect(
      screen.getByRole('dialog', { name: formatCalendarMonth(currentMonth) }),
    ).toBeInTheDocument();
  });

  it('reopens on the selected date month after choosing an adjacent-month day', async () => {
    const user = userEvent.setup();
    const currentDate = todayInSaoPaulo();
    const adjacentDay = buildCalendarMonth(currentDate).find((day) => !day.inCurrentMonth);
    if (!adjacentDay) throw new Error('Expected an adjacent-month calendar day');
    fetchReleasesMock.mockImplementation((query: ReleasesClientQuery = {}) =>
      query.from === undefined ? payload : exactPayload(query.from),
    );
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    await user.click(
      screen.getByRole('button', { name: formatCalendarLongDate(adjacentDay.date) }),
    );
    await user.click(
      screen.getByRole('button', { name: formatCalendarShortDate(adjacentDay.date) }),
    );

    expect(
      screen.getByRole('dialog', { name: formatCalendarMonth(adjacentDay.date) }),
    ).toBeInTheDocument();
  });

  it('searches releases for the exact selected calendar date', async () => {
    const user = userEvent.setup();
    const selectedDate = todayInSaoPaulo();
    fetchReleasesMock.mockImplementation((query: ReleasesClientQuery = {}) =>
      query.from === undefined ? payload : exactPayload(query.from),
    );
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await waitFor(() => {
      expect(releaseObservedTarget).toBeDefined();
    });
    const broadSentinel = releaseObservedTarget as HTMLElement;
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    await user.click(screen.getByRole('button', { name: formatCalendarLongDate(selectedDate) }));

    await waitFor(() => {
      expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({
        from: selectedDate,
        to: selectedDate,
        limit: 100,
      });
    });
    expect(
      screen.getByRole('button', { name: formatCalendarShortDate(selectedDate) }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`1 lançamento encontrado em ${formatReleaseDate(selectedDate, false)}`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: formatCalendarLongDate(selectedDate) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resultados de lançamentos' })).not.toContainElement(
      broadSentinel,
    );
  });

  it('uses the plural exact-date subtitle for multiple releases', async () => {
    const user = userEvent.setup();
    const selectedDate = todayInSaoPaulo();
    fetchReleasesMock.mockImplementation((query: ReleasesClientQuery = {}) =>
      query.from === undefined ? payload : exactPayload(query.from, 2),
    );
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    await user.click(screen.getByRole('button', { name: formatCalendarLongDate(selectedDate) }));

    expect(
      await screen.findByText(
        `2 lançamentos encontrados em ${formatReleaseDate(selectedDate, false)}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the exact-date empty state and clears only the selected date', async () => {
    const user = userEvent.setup();
    const selectedDate = todayInSaoPaulo();
    fetchReleasesMock.mockImplementation((query: ReleasesClientQuery = {}) =>
      query.from === undefined
        ? payload
        : {
            ...emptyPayload,
            meta: { ...emptyPayload.meta, from: query.from, to: query.to ?? query.from },
          },
    );
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    await user.click(screen.getByRole('button', { name: formatCalendarLongDate(selectedDate) }));

    expect(
      await screen.findByText(
        `Nenhum lançamento encontrado em ${formatReleaseDate(selectedDate, false)}`,
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar data' }));
    await waitFor(() => {
      expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({ limit: 100 });
    });
    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
  });

  it('combines an exact date with platform and genre and preserves clear semantics', async () => {
    const user = userEvent.setup();
    const selectedDate = todayInSaoPaulo();
    fetchReleasesMock.mockImplementation((query: ReleasesClientQuery = {}) =>
      query.from === undefined
        ? payload
        : {
            ...emptyPayload,
            meta: { ...emptyPayload.meta, from: query.from, to: query.to ?? query.from },
          },
    );
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'PC' }));
    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Gênero' })[0], 'rpg');
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    await user.click(screen.getByRole('button', { name: formatCalendarLongDate(selectedDate) }));

    await waitFor(() => {
      expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({
        from: selectedDate,
        to: selectedDate,
        platformIds: [6],
        genreIds: [12],
        limit: 100,
      });
    });

    await user.click(await screen.findByRole('button', { name: 'Limpar data' }));
    await waitFor(() => {
      expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({
        platformIds: [6],
        genreIds: [12],
        limit: 100,
      });
    });

    await user.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);
    await waitFor(() => {
      expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({ limit: 100 });
    });
  });

  it('retries an exact-date failure without losing the selected date or active filters', async () => {
    const user = userEvent.setup();
    const selectedDate = todayInSaoPaulo();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let exactAttempts = 0;
    fetchReleasesMock.mockImplementation((query: ReleasesClientQuery = {}) => {
      if (query.from === undefined) return payload;
      exactAttempts += 1;
      return exactAttempts === 1
        ? Promise.reject(new Error('temporary'))
        : exactPayload(query.from);
    });
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'PC' }));
    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Gênero' })[0], 'rpg');
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    await user.click(screen.getByRole('button', { name: formatCalendarLongDate(selectedDate) }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os jogos',
    );
    expect(
      screen.getByRole('button', { name: formatCalendarShortDate(selectedDate) }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'PC' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('combobox', { name: 'Gênero' })[0]).toHaveValue('rpg');

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({
      from: selectedDate,
      to: selectedDate,
      platformIds: [6],
      genreIds: [12],
      limit: 100,
    });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('filters releases by one platform and one genre and clears both', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(fetchReleasesMock.mock.calls[0]?.[0]).toEqual({ limit: 100 });

    await user.click(screen.getByRole('button', { name: 'PC' }));
    await waitFor(() => {
      expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({
        platformIds: [6],
        limit: 100,
      });
    });

    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Gênero' })[0], 'rpg');
    await waitFor(() => {
      expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({
        platformIds: [6],
        genreIds: [12],
        limit: 100,
      });
    });

    const clearButtons = screen.getAllByRole('button', { name: 'Limpar filtros' });
    expect(clearButtons.every((button) => !button.hasAttribute('disabled'))).toBe(true);
    await user.click(clearButtons[0]);
    await waitFor(() => {
      expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual({ limit: 100 });
    });

    expect(screen.getByRole('button', { name: 'Todas as plataformas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const genre of screen.getAllByRole('combobox', { name: 'Gênero' })) {
      expect(genre).toHaveValue('all');
    }
    expect(screen.queryByText('Período')).not.toBeInTheDocument();
  });

  it('loads and appends the next release window when the sentinel intersects', async () => {
    fetchReleasesMock.mockResolvedValueOnce(payload).mockResolvedValueOnce(nextPayload);
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await waitFor(() => {
      expect(releaseObservedTarget).toBeDefined();
    });
    const results = screen.getByRole('region', { name: 'Resultados de lan\u00e7amentos' });
    expect(releaseObservedTarget).toBeDefined();
    for (const list of within(results).getAllByRole('list')) {
      expect(list).not.toContainElement(releaseObservedTarget as HTMLElement);
    }

    act(() => {
      intersectReleaseSentinel();
    });

    expect(await screen.findAllByText('Future Game')).toHaveLength(2);
    expect(fetchReleasesMock.mock.calls[1]?.[0]).toEqual({
      from: '2026-11-06',
      to: '2027-02-04',
      limit: 100,
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('pauses automatic loading in Calendar and resumes the same list session', async () => {
    const user = userEvent.setup();
    fetchReleasesMock.mockResolvedValueOnce(payload).mockResolvedValueOnce(nextPayload);
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    await waitFor(() => {
      expect(releaseObservedTarget).toBeDefined();
    });
    const results = screen.getByRole('region', { name: 'Resultados de lan\u00e7amentos' });
    const pausedObserverCallback = releaseObserverCallback;
    const pausedObserverInstance = releaseObserverInstance;
    const listSentinel = releaseObservedTarget;
    if (!pausedObserverCallback || !pausedObserverInstance || !listSentinel) {
      throw new Error('Release sentinel is not being observed');
    }

    await user.click(screen.getByRole('button', { name: 'Calend\u00e1rio' }));
    expect(results).not.toContainElement(listSentinel as HTMLElement);
    expect(results).not.toContainElement(releaseObservedTarget as HTMLElement);
    expect(screen.getAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => {
      pausedObserverCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        pausedObserverInstance,
      );
    });
    expect(fetchReleasesMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(fetchReleasesMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(releaseObserverCallback).not.toBe(pausedObserverCallback);
    });

    act(() => {
      intersectReleaseSentinel();
    });

    expect(await screen.findAllByText('Future Game')).toHaveLength(2);
    expect(fetchReleasesMock).toHaveBeenCalledTimes(2);
  });

  it('retries an incremental failure without discarding loaded releases', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchReleasesMock
      .mockResolvedValueOnce(payload)
      .mockRejectedValueOnce(new Error('secret'))
      .mockResolvedValueOnce(nextPayload);
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findAllByText('Eclipse Protocol')).toHaveLength(2);
    act(() => {
      intersectReleaseSentinel();
    });

    const failedNextQuery = {
      from: '2026-11-06',
      to: '2027-02-04',
      limit: 100,
    };
    expect(screen.getAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'N\u00e3o foi poss\u00edvel carregar mais jogos',
    );
    expect(fetchReleasesMock.mock.calls[1]?.[0]).toEqual(failedNextQuery);

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findAllByText('Future Game')).toHaveLength(2);
    expect(screen.getAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(fetchReleasesMock.mock.calls.at(-1)?.[0]).toEqual(failedNextQuery);
  });

  it('shows an initial split-scan error and retries the exact failed window', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const saturatedInitial = {
      ...emptyPayload,
      meta: {
        ...emptyPayload.meta,
        to: '2026-08-08',
        count: 100,
      },
    };
    const recoveredPage = {
      ...emptyPayload,
      data: [
        {
          id: 4,
          slug: 'recovered-game',
          name: 'Recovered Game',
          coverUrl: null,
          releaseDate: '2026-08-07',
          platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
          genres: [],
        },
      ],
      meta: {
        ...emptyPayload.meta,
        to: '2026-08-07',
        count: 1,
      },
    };
    fetchReleasesMock
      .mockResolvedValueOnce(saturatedInitial)
      .mockRejectedValueOnce(new Error('secret'))
      .mockResolvedValueOnce(recoveredPage);
    window.history.replaceState({}, '', '/lancamentos');
    render(<AppRouter />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'N\u00e3o foi poss\u00edvel carregar os jogos',
    );
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    const failedQuery = {
      from: '2026-08-07',
      to: '2026-08-07',
      limit: 100,
    };
    expect(fetchReleasesMock.mock.calls[1]?.[0]).toEqual(failedQuery);

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findAllByText('Recovered Game')).toHaveLength(2);
    expect(fetchReleasesMock.mock.calls[2]?.[0]).toEqual(failedQuery);
  });

  it('shows loading while the release request is pending', async () => {
    const user = userEvent.setup();
    fetchReleasesMock.mockImplementation(() => new Promise<never>(() => undefined));
    render(<AppRouter />);

    await user.click(screen.getByRole('link', { name: 'Lan\u00e7amentos' }));

    expect(screen.getByRole('status')).toHaveTextContent('Carregando jogos');
    expect(fetchReleasesMock).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when the request has no releases', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    fetchReleasesMock.mockImplementation((query: ReleasesClientQuery = {}) => {
      const from = query.from ?? '2026-08-07';
      const to = query.to ?? '2026-11-05';
      return {
        data: [],
        meta: {
          ...emptyPayload.meta,
          from,
          to,
          count: 0,
          limit: 100,
        },
      };
    });
    render(<AppRouter />);

    await user.click(screen.getByRole('link', { name: 'Lan\u00e7amentos' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Nenhum jogo encontrado');
    expect(fetchReleasesMock.mock.calls.length).toBeGreaterThan(1);
    const lastQuery = fetchReleasesMock.mock.calls.at(-1)?.[0] as ReleasesClientQuery | undefined;
    expect(lastQuery?.to).toBeDefined();
    expect((lastQuery?.to ?? '') <= '2028-08-06').toBe(true);
  });

  it('retries a failed request and displays the recovered list', async () => {
    const user = userEvent.setup();
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchReleasesMock.mockRejectedValueOnce(new Error('secret')).mockResolvedValueOnce(payload);
    render(<AppRouter />);

    await user.click(screen.getByRole('link', { name: 'Lan\u00e7amentos' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'N\u00e3o foi poss\u00edvel carregar os jogos',
    );
    expect(fetchReleasesMock).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('[releases] Falha ao carregar lan\u00e7amentos', {
      status: 0,
      code: 'INTERNAL_ERROR',
    });
    expect(error).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('list', { name: 'Hoje 10 de agosto' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(fetchReleasesMock).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledWith('[releases] Pr\u00f3ximos lan\u00e7amentos', payload);
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('redireciona rotas desconhecidas para o início', async () => {
    window.history.replaceState({}, '', '/rota-inexistente');
    render(<AppRouter />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Zera GameZ' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
