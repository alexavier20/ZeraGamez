import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  ReleaseViewSwitcher,
  type ReleaseView,
} from '@/features/releases/components/ReleaseViewSwitcher';

function ControlledSwitcher() {
  const [value, setValue] = useState<ReleaseView>('list');

  return <ReleaseViewSwitcher controlsId="release-results" onChange={setValue} value={value} />;
}

describe('ReleaseViewSwitcher', () => {
  it('alterna o modo selecionado com semântica acessível', async () => {
    const user = userEvent.setup();
    render(<ControlledSwitcher />);

    const group = screen.getByRole('group', { name: 'Alternar visualização' });
    const listButton = screen.getByRole('button', { name: 'Lista' });
    const calendarButton = screen.getByRole('button', { name: 'Calendário' });

    expect(group).toBeInTheDocument();
    expect(listButton).toHaveAttribute('aria-controls', 'release-results');
    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(listButton).toHaveClass('ring-1', 'ring-inset', 'ring-brand');
    expect(calendarButton).toHaveAttribute('aria-pressed', 'false');
    expect(calendarButton).toHaveAttribute('aria-controls', 'release-results');
    expect(calendarButton).toHaveClass('ring-1', 'ring-inset', 'ring-transparent');

    await user.click(calendarButton);

    expect(listButton).toHaveAttribute('aria-pressed', 'false');
    expect(listButton).toHaveClass('ring-1', 'ring-inset', 'ring-transparent');
    expect(calendarButton).toHaveAttribute('aria-pressed', 'true');
    expect(calendarButton).toHaveClass('ring-1', 'ring-inset', 'ring-brand');

    listButton.focus();
    await user.keyboard('{Enter}');

    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(listButton).toHaveClass('ring-1', 'ring-inset', 'ring-brand');
    expect(calendarButton).toHaveAttribute('aria-pressed', 'false');
    expect(calendarButton).toHaveClass('ring-1', 'ring-inset', 'ring-transparent');
  });
});
