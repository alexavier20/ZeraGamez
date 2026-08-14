import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReleaseDatePicker } from '@/features/releases/components/ReleaseDatePicker';

const defaultProps = {
  currentDate: '2026-07-29',
  knownReleaseDates: new Set(['2026-07-29', '2026-07-30']),
  month: '2026-07-01',
  onMonthChange: vi.fn(),
  onRequestClose: vi.fn(),
  onSelect: vi.fn(),
  selectedDate: '2026-07-31',
};

function setup(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  const view = render(<ReleaseDatePicker {...props} />);

  return { ...props, ...view };
}

describe('ReleaseDatePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the approved July calendar structure and day states', () => {
    setup();

    const dialog = screen.getByRole('dialog', { name: 'Julho de 2026' });
    expect(dialog).toHaveClass('h-[344px]', 'w-80', 'rounded-[14px]', 'bg-surface', 'p-4');
    expect(within(dialog).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(dialog).getAllByRole('gridcell')).toHaveLength(42);
    expect(screen.getByRole('button', { name: '29 de julho de 2026' })).toHaveAttribute(
      'data-today',
      'true',
    );
    expect(screen.getByRole('button', { name: '31 de julho de 2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('release-indicator-2026-07-29')).toHaveClass('size-1', 'bg-brand');
  });

  it('requests the previous and next calendar months from its real header buttons', async () => {
    const user = userEvent.setup();
    const { onMonthChange } = setup();

    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    expect(onMonthChange).toHaveBeenNthCalledWith(1, '2026-06-01');
    expect(onMonthChange).toHaveBeenNthCalledWith(2, '2026-08-01');
  });

  it('selects the clicked calendar day', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    await user.click(screen.getByRole('button', { name: '30 de julho de 2026' }));

    expect(onSelect).toHaveBeenCalledWith('2026-07-30');
  });

  it('focuses the selected date, then today, then the month start', () => {
    const { rerender } = setup();

    expect(screen.getByRole('button', { name: '31 de julho de 2026' })).toHaveFocus();

    rerender(<ReleaseDatePicker {...defaultProps} selectedDate={null} />);
    expect(screen.getByRole('button', { name: '29 de julho de 2026' })).toHaveFocus();

    rerender(
      <ReleaseDatePicker {...defaultProps} currentDate="2026-08-01" selectedDate={null} />,
    );
    expect(screen.getByRole('button', { name: '1 de julho de 2026' })).toHaveFocus();
  });

  it('moves focus by calendar days with arrow keys', async () => {
    const user = userEvent.setup();
    const { onMonthChange } = setup();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: '1 de agosto de 2026' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: '8 de agosto de 2026' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: '7 de agosto de 2026' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: '31 de julho de 2026' })).toHaveFocus();
    expect(onMonthChange).toHaveBeenCalledWith('2026-08-01');
  });

  it('requests adjacent months with PageDown and PageUp', async () => {
    const user = userEvent.setup();
    const { onMonthChange } = setup();

    await user.keyboard('{PageDown}{PageUp}');

    expect(onMonthChange).toHaveBeenNthCalledWith(1, '2026-08-01');
    expect(onMonthChange).toHaveBeenNthCalledWith(2, '2026-06-01');
  });

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup();
    const { onRequestClose } = setup();

    await user.keyboard('{Escape}');

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});
