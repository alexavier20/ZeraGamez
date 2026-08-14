import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReleaseDateEmpty } from '@/features/releases/components/ReleaseDateEmpty';

describe('ReleaseDateEmpty', () => {
  it('renders the approved empty date state and clears only the date', async () => {
    const user = userEvent.setup();
    const onClearDate = vi.fn();
    render(<ReleaseDateEmpty date="2026-07-31" onClearDate={onClearDate} />);

    const status = screen.getByRole('status');
    expect(status).toHaveClass('h-[360px]');
    expect(status).toHaveTextContent('Nenhum lançamento nesta data');
    expect(status).toHaveTextContent(
      'Não encontramos jogos com lançamento em 31 de julho de 2026. Escolha outro dia ou limpe o filtro.',
    );
    const clear = screen.getByRole('button', { name: 'Limpar data' });
    expect(clear).toHaveClass('h-9', 'rounded-[9px]', 'bg-surface-hover');
    await user.click(clear);
    expect(onClearDate).toHaveBeenCalledTimes(1);
  });
});
