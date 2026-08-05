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
    expect(container).toHaveClass('flex', 'flex-col', 'gap-[18px]', 'sm:gap-[22px]', 'lg:gap-2');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(title).toHaveClass(
      'font-heading',
      'text-[27px]',
      'leading-[34px]',
      'font-bold',
      'text-content-primary',
      'sm:text-[30px]',
      'sm:leading-[38px]',
      'lg:text-[38px]',
      'lg:leading-[48px]',
    );
    expect(subtitle.tagName).toBe('P');
    expect(subtitle).toHaveClass(
      'text-[13px]',
      'leading-[17px]',
      'text-text-muted',
      'sm:text-sm',
      'sm:leading-[18px]',
      'lg:text-base',
      'lg:leading-[21px]',
    );
    expect(screen.queryByText('Próximos lançamentos')).not.toBeInTheDocument();
  });
});
