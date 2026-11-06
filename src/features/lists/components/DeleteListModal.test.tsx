import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteListModal } from './DeleteListModal';

const list = {
  id: 7,
  name: 'RPGs',
  description: null,
  covers: [],
  gameCount: 2,
  systemKey: null,
};

describe('DeleteListModal', () => {
  it('focuses cancel and only requests deletion after an explicit confirmation', async () => {
    const onConfirm = vi.fn();
    render(
      <DeleteListModal
        list={list}
        errorMessage={null}
        isDeleting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Excluir lista' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks Escape during deletion and permits cancellation once the pending state ends', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DeleteListModal
        list={list}
        errorMessage={null}
        isDeleting={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    rerender(
      <DeleteListModal
        list={list}
        errorMessage={null}
        isDeleting
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excluindo…' })).toBeDisabled();
    rerender(
      <DeleteListModal
        list={list}
        errorMessage={null}
        isDeleting={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
