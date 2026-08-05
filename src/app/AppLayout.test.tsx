import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '@/app/AppLayout';

describe('AppLayout', () => {
  it('mant\u00e9m header, conte\u00fado e navega\u00e7\u00e3o m\u00f3vel na ordem do foco', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<main aria-label="Conteúdo da página" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    const main = screen.getByRole('main', { name: 'Conteúdo da página' });
    const mobileNavigation = screen.getByRole('navigation', {
      name: 'Navegação móvel',
    });

    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(main.compareDocumentPosition(mobileNavigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
