import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchGames } from '@/features/games/api/game-search-client';

import { ReviewsPage } from './ReviewsPage';

const { client, review, loadReviews } = vi.hoisted(() => {
  const review = {
    igdb_id: 1,
    name: 'The Witcher 3',
    cover_url: null,
    score: 10,
    analysis: 'Uma análise completa. '.repeat(100),
    updated_at: '2026-11-04T20:14:01.393Z',
  };
  const loadReviews = vi
    .fn<() => Promise<{ data: (typeof review)[] | null; error: { message: string } | null }>>()
    .mockResolvedValue({ data: [review], error: null });
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => loadReviews(),
        }),
      }),
    }),
  };
  return { client, review, loadReviews };
});

vi.mock('@/features/games/api/game-search-client', () => ({ searchGames: vi.fn() }));

vi.mock('@/shared/supabase/client', () => ({ getSupabaseClient: () => client }));
vi.mock('@/features/auth/context/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'authenticated', user: { id: 'author', name: 'Alex' } } }),
}));

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});

afterAll(() => {
  for (const [name, descriptor] of [
    ['showModal', originalShowModal],
    ['close', originalClose],
  ] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

beforeEach(() => {
  loadReviews.mockReset().mockResolvedValue({ data: [review], error: null });
  vi.mocked(searchGames).mockReset();
});

describe('ReviewsPage', () => {
  it('não anuncia uma coleção vazia enquanto as avaliações carregam', () => {
    loadReviews.mockReturnValueOnce(new Promise(() => undefined));
    render(<ReviewsPage />);
    expect(screen.getByRole('heading', { name: 'Minhas avaliações' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Carregando avaliações...' })).toBeInTheDocument();
    expect(screen.queryByText(/Você ainda não avaliou/)).not.toBeInTheDocument();
  });

  it('mostra uma falha de carregamento sem simular lista vazia e permite tentar novamente', async () => {
    loadReviews.mockResolvedValueOnce({
      data: null,
      error: { message: 'internal database detail' },
    });
    const user = userEvent.setup();
    render(<ReviewsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar suas avaliações',
    );
    expect(screen.queryByText(/Você ainda não avaliou/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Minhas avaliações' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByRole('button', { name: 'Ver avaliação completa de The Witcher 3' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('formata a nota decimal em português e mantém a escala na leitura completa', async () => {
    loadReviews.mockResolvedValueOnce({ data: [{ ...review, score: 8.5 }], error: null });
    const user = userEvent.setup();
    render(<ReviewsPage />);
    const score = await screen.findByLabelText('Nota 8,5 de 10');
    expect(within(score).getByText('8,5')).toBeInTheDocument();
    expect(within(score).getByText('/ 10')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Ver avaliação completa de The Witcher 3' }),
    );
    expect(within(screen.getByRole('dialog')).getByLabelText('Nota 8,5 de 10')).toBeInTheDocument();
  });

  it('mantém uma prévia dos resultados enquanto pesquisa e distingue uma falha de busca', async () => {
    vi.mocked(searchGames).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    render(<ReviewsPage />);
    await user.type(screen.getByRole('searchbox', { name: 'Pesquisar jogo' }), 'zelda');
    expect(screen.getByRole('status', { name: 'Pesquisando jogos' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível pesquisar jogos');
    expect(screen.queryByText('Nenhum jogo encontrado.')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ver avaliação completa de The Witcher 3' }),
    ).toBeInTheDocument();
  });

  it('abre a análise completa e restaura o foco ao fechar o modal', async () => {
    const user = userEvent.setup();
    render(<ReviewsPage />);
    const card = await screen.findByRole('button', {
      name: 'Ver avaliação completa de The Witcher 3',
    });
    await user.click(card);
    const dialog = screen.getByRole('dialog', { name: review.name });
    expect(within(dialog).getByText(review.analysis.trim())).toBeInTheDocument();
    expect(within(dialog).getByText('Alex')).toBeInTheDocument();
    expect(within(dialog).getByText('04/11/2026')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(within(dialog).getByRole('button', { name: 'Fechar avaliação' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(card).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');

    await user.click(card);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mantém o ícone de edição independente da abertura do modal', async () => {
    const user = userEvent.setup();
    render(<ReviewsPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Editar avaliação de The Witcher 3' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(10);
    expect(screen.getByRole('textbox', { name: 'Sua análise' })).toHaveValue(review.analysis);
  });
});
