import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ReviewsPage } from './ReviewsPage';

const { client, review } = vi.hoisted(() => {
  const review = {
    igdb_id: 1,
    name: 'The Witcher 3',
    cover_url: null,
    score: 10,
    analysis: 'Uma análise completa. '.repeat(100),
    updated_at: '2026-11-04T20:14:01.393Z',
  };
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [review], error: null }),
        }),
      }),
    }),
  };
  return { client, review };
});

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

describe('ReviewsPage', () => {
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
