import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReleaseFilters } from '@/features/releases/components/ReleaseFilters';
import {
  defaultReleaseFilterSelection,
  type ReleaseFilterSelection,
} from '@/features/releases/model/release-filter-options';

function setup(
  value: ReleaseFilterSelection = defaultReleaseFilterSelection,
  callbacks = {
    onPlatformChange: vi.fn(),
    onGenreChange: vi.fn(),
    onClear: vi.fn(),
  },
) {
  const view = render(<ReleaseFilters {...callbacks} value={value} />);
  return { ...callbacks, ...view };
}

describe('ReleaseFilters', () => {
  it('renders accessible controls for every breakpoint without period UI', () => {
    setup();

    const region = screen.getByRole('region', { name: 'Filtros de lançamentos' });
    expect(within(region).getByTestId('release-filters-mobile')).toHaveClass('flex', 'sm:hidden');
    expect(within(region).getByTestId('release-filters-tablet')).toHaveClass(
      'hidden',
      'sm:flex',
      'lg:hidden',
    );
    expect(within(region).getByTestId('release-filters-desktop')).toHaveClass('hidden', 'lg:flex');

    expect(screen.getAllByRole('combobox', { name: 'Plataforma' })).toHaveLength(2);
    expect(screen.getAllByRole('combobox', { name: 'Gênero' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'PC' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('button', { name: 'Limpar filtros' })).toHaveLength(3);
    for (const clear of screen.getAllByRole('button', { name: 'Limpar filtros' })) {
      expect(clear).toBeDisabled();
    }

    expect(within(region).queryByText('Período')).not.toBeInTheDocument();
    expect(region.querySelector('svg.lucide-calendar-days')).not.toBeInTheDocument();
  });

  it('shows the filter ring on every genre select wrapper when its control receives focus', () => {
    setup();

    const genreSelects = screen
      .getAllByRole('combobox')
      .filter((combobox) => combobox.querySelector('option[value="rpg"]'));

    for (const genre of genreSelects) {
      expect(genre.parentElement).toHaveClass('focus-within:ring-2', 'focus-within:ring-brand');
    }
  });

  it('themes every native dropdown with the site palette and typography', () => {
    setup();

    for (const dropdown of screen.getAllByRole('combobox')) {
      expect(dropdown).toHaveClass('font-body', '[color-scheme:dark]');

      for (const option of within(dropdown).getAllByRole('option')) {
        expect(option).toHaveClass('bg-surface', 'font-body', 'text-content-primary');
      }
    }
  });

  it('emits one platform, one genre, and clear actions with active semantics', async () => {
    const user = userEvent.setup();
    const callbacks = {
      onPlatformChange: vi.fn(),
      onGenreChange: vi.fn(),
      onClear: vi.fn(),
    };
    const { rerender } = setup({ platform: 'ps5', genre: 'rpg' }, callbacks);

    expect(screen.getByRole('button', { name: 'PlayStation 5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'PlayStation 5' })).toHaveClass(
      'border-brand',
      'bg-filter-active',
      'text-filter-active-text',
    );
    for (const genre of screen.getAllByRole('combobox', { name: 'Gênero' })) {
      expect(genre).toHaveValue('rpg');
    }

    await user.click(screen.getByRole('button', { name: 'PC' }));
    expect(callbacks.onPlatformChange).toHaveBeenCalledWith('pc');

    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Plataforma' })[0], 'switch');
    expect(callbacks.onPlatformChange).toHaveBeenLastCalledWith('switch');

    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Gênero' })[0], 'indie');
    expect(callbacks.onGenreChange).toHaveBeenCalledWith('indie');

    await user.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);
    expect(callbacks.onClear).toHaveBeenCalledTimes(1);

    rerender(<ReleaseFilters {...callbacks} value={defaultReleaseFilterSelection} />);
    for (const clear of screen.getAllByRole('button', { name: 'Limpar filtros' })) {
      expect(clear).toBeDisabled();
    }
  });

  it('enables each clear control when an additional filter is active', () => {
    render(
      <ReleaseFilters
        additionalFilterActive
        onClear={vi.fn()}
        onGenreChange={vi.fn()}
        onPlatformChange={vi.fn()}
        value={defaultReleaseFilterSelection}
      />,
    );

    for (const clear of screen.getAllByRole('button', { name: 'Limpar filtros' })) {
      expect(clear).toBeEnabled();
    }
  });
});
