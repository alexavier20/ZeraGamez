import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from '@/app/router';
import {
  formatCalendarLongDate,
  formatCalendarShortDate,
  todayInSaoPaulo,
} from '@/features/releases/model/release-calendar';
import { formatReleaseDate } from '@/features/releases/model/release-presentation';

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

function exactPayload(releaseDate: string) {
  return {
    data: [
      {
        ...payload.data[0],
        releaseDate,
      },
    ],
    meta: {
      ...emptyPayload.meta,
      from: releaseDate,
      to: releaseDate,
      count: 1,
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
    render(<AppRouter />);

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
    render(<AppRouter />);

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
