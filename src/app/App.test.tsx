import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppRouter } from '@/app/router';

describe('Zera GameZ', () => {
  it('renderiza a página inicial', () => {
    render(<AppRouter />);

    expect(screen.getByRole('heading', { level: 1, name: 'Zera GameZ' })).toBeInTheDocument();
    expect(screen.getByText('Em construção')).toBeInTheDocument();
  });
});
