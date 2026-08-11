import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from '@/app/router';

const emptyPayload = {
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

const fetchReleasesMock = vi.hoisted(() => vi.fn());

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
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => vi.restoreAllMocks());

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
    expect(
      await screen.findByRole('list', { name: 'Lista de lan\u00e7amentos' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByText('Eclipse Protocol')).toHaveLength(2);
    expect(fetchReleasesMock).toHaveBeenCalledTimes(1);

    await user.click(calendarButton);

    expect(listButton).toHaveAttribute('aria-pressed', 'false');
    expect(calendarButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Visualiza\u00e7\u00e3o em breve');
    expect(
      screen.queryByRole('list', { name: 'Lista de lan\u00e7amentos' }),
    ).not.toBeInTheDocument();

    await user.click(listButton);

    expect(screen.getByRole('list', { name: 'Lista de lan\u00e7amentos' })).toBeInTheDocument();
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
    fetchReleasesMock.mockResolvedValue(emptyPayload);
    render(<AppRouter />);

    await user.click(screen.getByRole('link', { name: 'Lan\u00e7amentos' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Nenhum jogo encontrado');
    expect(fetchReleasesMock).toHaveBeenCalledTimes(1);
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

    expect(
      await screen.findByRole('list', { name: 'Lista de lan\u00e7amentos' }),
    ).toBeInTheDocument();
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
