import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseFilters } from '@/features/releases/components/ReleaseFilters';

describe('ReleaseFilters', () => {
  it('renderiza as três variantes visuais responsivas do Pencil', () => {
    render(<ReleaseFilters />);

    const region = screen.getByRole('region', { name: 'Filtros de lançamentos' });
    const mobile = within(region).getByTestId('release-filters-mobile');
    const tablet = within(region).getByTestId('release-filters-tablet');
    const desktop = within(region).getByTestId('release-filters-desktop');

    expect(mobile).toHaveClass('flex', 'sm:hidden');
    expect(mobile).toHaveTextContent(/^Filtros \(2\)PeríodoPS5$/);
    expect(mobile.querySelectorAll('svg.lucide-sliders-horizontal')).toHaveLength(1);
    expect(mobile.querySelectorAll('svg.lucide-calendar-days')).toHaveLength(1);
    expect(mobile.querySelectorAll('svg.lucide-gamepad-2')).toHaveLength(1);

    expect(tablet).toHaveClass('hidden', 'sm:flex', 'lg:hidden');
    expect(tablet).toHaveTextContent(/^TodasPS5PCGêneroPeríodo$/);
    expect(tablet.querySelector('svg')).not.toBeInTheDocument();

    expect(desktop).toHaveClass('hidden', 'lg:flex');
    expect(desktop).toHaveTextContent(
      /^Todas as plataformasPCPlayStation 5Xbox Series X\|SNintendo SwitchGêneroPeríodoLimpar filtros$/,
    );
    expect(desktop.querySelectorAll('svg.lucide-chevron-down')).toHaveLength(2);

    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
    expect(within(desktop).getByText('Todas as plataformas').parentElement).toHaveClass(
      'border-brand',
      'bg-filter-active',
      'text-filter-active-text',
    );
    expect(within(desktop).getByText('PC').parentElement).toHaveClass(
      'border-border-brand',
      'bg-bg-secondary',
      'text-text-muted',
    );
    expect(within(mobile).getByText('Filtros (2)').parentElement).toHaveClass(
      'border-brand',
      'bg-brand',
      'text-content-primary',
    );

    for (const icon of region.querySelectorAll('svg')) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
