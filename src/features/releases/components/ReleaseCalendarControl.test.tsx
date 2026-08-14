import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ReleaseCalendarControl } from '@/features/releases/components/ReleaseCalendarControl';

const defaultProps = {
  currentDate: '2026-07-29',
  knownReleaseDates: new Set(['2026-07-29']),
  month: '2026-07-01',
};

function ControlledCalendarControl({
  initialOpen = false,
  initialSelectedDate = null,
  onClearDate = vi.fn(),
  onOpenChange = vi.fn(),
  onSelectDate = vi.fn(),
}: {
  readonly initialOpen?: boolean;
  readonly initialSelectedDate?: string | null;
  readonly onClearDate?: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onSelectDate?: (date: string) => void;
}) {
  const [month, setMonth] = useState(defaultProps.month);
  const [open, setOpen] = useState(initialOpen);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);

  return (
    <ReleaseCalendarControl
      {...defaultProps}
      controlsId="release-results"
      month={month}
      onClearDate={() => {
        onClearDate();
        setSelectedDate(null);
      }}
      onMonthChange={setMonth}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        setOpen(nextOpen);
      }}
      onSelectDate={(date) => {
        onSelectDate(date);
        setSelectedDate(date);
      }}
      open={open}
      selectedDate={selectedDate}
    />
  );
}

describe('ReleaseCalendarControl', () => {
  it('keeps the complete control desktop-only when the picker is open', () => {
    render(<ControlledCalendarControl initialOpen />);

    expect(screen.getByRole('group').parentElement).toHaveClass('relative', 'hidden', 'lg:block');
  });

  it('opens and closes the controlled calendar from its trigger', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ControlledCalendarControl onOpenChange={onOpenChange} />);

    const calendar = screen.getByRole('button', { name: 'Calendário' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(calendar);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(calendar);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selects a date and clears the selection through the list control', async () => {
    const user = userEvent.setup();
    const onClearDate = vi.fn();
    const onSelectDate = vi.fn();
    render(
      <ControlledCalendarControl
        initialOpen
        onClearDate={onClearDate}
        onSelectDate={onSelectDate}
      />,
    );

    await user.click(screen.getByRole('button', { name: '29 de julho de 2026' }));
    expect(onSelectDate).toHaveBeenCalledWith('2026-07-29');
    expect(screen.getByRole('button', { name: '29 jul. 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lista' }));
    expect(onClearDate).toHaveBeenCalledTimes(1);
  });

  it('closes when pointerdown happens outside the control', () => {
    const onOpenChange = vi.fn();
    render(<ControlledCalendarControl initialOpen onOpenChange={onOpenChange} />);

    fireEvent.pointerDown(document.body);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with Escape and restores focus to the calendar trigger', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ControlledCalendarControl initialOpen onOpenChange={onOpenChange} />);

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Calendário' })).toHaveFocus();
    });
  });

  it('removes its global pointerdown listener when unmounted', () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(<ControlledCalendarControl initialOpen onOpenChange={onOpenChange} />);

    unmount();
    fireEvent.pointerDown(document.body);

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
