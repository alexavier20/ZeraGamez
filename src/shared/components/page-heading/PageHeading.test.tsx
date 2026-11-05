import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeading } from '@/shared/components/page-heading/PageHeading';

describe('PageHeading', () => {
  it('renderiza título e apoio recebidos com semântica e estilos responsivos', () => {
    render(<PageHeading title="Título reutilizável" subtitle="Texto de apoio" />);

    const title = screen.getByRole('heading', { level: 1, name: 'Título reutilizável' });
    const subtitle = screen.getByText('Texto de apoio');
    const container = title.parentElement;

    expect(container?.tagName).toBe('DIV');
    expect(container).toHaveClass('flex', 'flex-col', 'gap-2');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(title).toHaveClass(
      'font-heading',
      'text-2xl',
      'leading-tight',
      'font-bold',
      'text-content-primary',
      'sm:text-[27px]',
      'lg:text-[30px]',
    );
    expect(subtitle.tagName).toBe('P');
    expect(subtitle).toHaveClass(
      'text-xs',
      'leading-5',
      'text-text-muted',
      'sm:text-sm',
    );
    expect(screen.queryByText('Próximos lançamentos')).not.toBeInTheDocument();
  });
});
