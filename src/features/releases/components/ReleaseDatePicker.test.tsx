import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ReleaseDatePicker,
  type ReleaseDatePickerProps,
} from '@/features/releases/components/ReleaseDatePicker';

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

function ControlledReleaseDatePicker({
  selectedDate = defaultProps.selectedDate,
}: {
  readonly selectedDate?: ReleaseDatePickerProps['selectedDate'];
}) {
  const [month, setMonth] = useState(defaultProps.month);

  return (
    <ReleaseDatePicker
      {...defaultProps}
      month={month}
      onMonthChange={setMonth}
      selectedDate={selectedDate}
    />
  );
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

    const title = screen.getByText('Julho de 2026');
    const previous = screen.getByRole('button', { name: 'Mês anterior' });
    const next = screen.getByRole('button', { name: 'Próximo mês' });
    expect(title).toHaveClass('font-heading', 'text-base');
    expect(previous.parentElement).toBe(next.parentElement);
    expect(previous.parentElement).not.toBe(title.parentElement);
    expect(previous).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-brand');
    expect(next).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-brand');
    for (const weekday of within(dialog).getAllByRole('columnheader')) {
      expect(weekday).toHaveClass('rounded', 'bg-bg-secondary', 'font-semibold');
    }
    expect(screen.getByRole('button', { name: '29 de julho de 2026' })).toHaveClass(
      'focus-visible:ring-2',
      'focus-visible:ring-brand',
    );
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

    rerender(<ReleaseDatePicker {...defaultProps} currentDate="2026-08-01" selectedDate={null} />);
    expect(screen.getByRole('button', { name: '1 de julho de 2026' })).toHaveFocus();
  });

  it('keeps the exact arrow-key destination after a controlled month transition', async () => {
    const user = userEvent.setup();
    render(<ControlledReleaseDatePicker selectedDate={null} />);

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('dialog', { name: 'Agosto de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 de agosto de 2026' })).toHaveFocus();
  });

  it('moves focus by calendar days with arrow keys through controlled month transitions', async () => {
    const user = userEvent.setup();
    render(<ControlledReleaseDatePicker selectedDate={null} />);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: '30 de julho de 2026' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: '6 de agosto de 2026' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: '5 de agosto de 2026' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: '29 de julho de 2026' })).toHaveFocus();
  });

  it('uses a roving tab stop and synchronizes keyboard navigation with the focused day', async () => {
    const user = userEvent.setup();
    const { onMonthChange } = setup();

    const dialog = screen.getByRole('dialog');
    const dayButtons = within(dialog)
      .getAllByRole('gridcell')
      .map((cell) => within(cell).getByRole('button'));
    const selectedDay = screen.getByRole('button', { name: '31 de julho de 2026' });

    expect(dayButtons.filter((button) => button.tabIndex === 0)).toEqual([selectedDay]);
    expect(screen.getByRole('button', { name: '30 de julho de 2026' })).toHaveAttribute(
      'tabindex',
      '-1',
    );

    screen.getByRole('button', { name: '1 de agosto de 2026' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('button', { name: '2 de agosto de 2026' })).toHaveFocus();
    expect(onMonthChange).toHaveBeenCalledWith('2026-08-01');
  });

  it('does not handle calendar navigation keys while a header button has focus', async () => {
    const user = userEvent.setup();
    const { onMonthChange } = setup();

    screen.getByRole('button', { name: 'Mês anterior' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('keeps one focusable day after header navigation removes the prior focus date', async () => {
    const user = userEvent.setup();
    render(<ControlledReleaseDatePicker />);

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    const dialog = screen.getByRole('dialog', { name: 'Setembro de 2026' });
    const dayButtons = within(dialog)
      .getAllByRole('gridcell')
      .map((cell) => within(cell).getByRole('button'));
    const expectedFocus = screen.getByRole('button', { name: '1 de setembro de 2026' });

    expect(dayButtons.filter((button) => button.tabIndex === 0)).toEqual([expectedFocus]);
    expect(expectedFocus).toHaveFocus();
  });

  it('keeps weekday headers inside the calendar grid', () => {
    setup();

    const grid = screen.getByRole('grid');
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(grid).getAllByRole('row')).toHaveLength(7);
  });

  it('changes controlled months and focuses their starts with PageDown and PageUp', async () => {
    const user = userEvent.setup();
    render(<ControlledReleaseDatePicker />);

    await user.keyboard('{PageDown}');
    expect(screen.getByRole('dialog', { name: 'Agosto de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 de agosto de 2026' })).toHaveFocus();

    await user.keyboard('{PageUp}');
    expect(screen.getByRole('dialog', { name: 'Julho de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 de julho de 2026' })).toHaveFocus();
  });

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup();
    const { onRequestClose } = setup();

    await user.keyboard('{Escape}');

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});
