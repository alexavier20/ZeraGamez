import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from '@/app/router';

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

    await user.click(calendarButton);

    expect(listButton).toHaveAttribute('aria-pressed', 'false');
    expect(calendarButton).toHaveAttribute('aria-pressed', 'true');

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

  it('redireciona rotas desconhecidas para o início', async () => {
    window.history.replaceState({}, '', '/rota-inexistente');
    render(<AppRouter />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Zera GameZ' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
