import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ReleaseCalendarPlaceholder,
  ReleasesEmpty,
  ReleasesError,
  ReleasesLoading,
} from '@/features/releases/components/ReleasesStates';

describe('release list states', () => {
  it('renders an accessible loading state with four copy-free skeleton cards', () => {
    render(<ReleasesLoading />);

    const loadingState = screen.getByRole('status');
    const skeletons = screen.getAllByTestId('release-card-skeleton');

    expect(loadingState).toHaveAttribute('aria-live', 'polite');
    expect(loadingState).toHaveTextContent('Carregando jogos');
    expect(skeletons).toHaveLength(4);
    for (const skeleton of skeletons) {
      expect(skeleton).toBeEmptyDOMElement();
    }
  });

  it('renders the approved empty copy', () => {
    render(<ReleasesEmpty />);

    expect(screen.getByRole('status')).toHaveTextContent('Nenhum jogo encontrado');
    expect(screen.getByText('Tente outro termo ou limpe os filtros ativos.')).toBeInTheDocument();
  });

  it('invokes retry from the sanitized error state with a visible focus treatment', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ReleasesError onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: 'Tentar novamente' });

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os jogos');
    expect(screen.getByText('Verifique sua conexão e tente novamente.')).toBeInTheDocument();
    expect(retryButton).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-brand');
    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the unavailable calendar state without a call to action', () => {
    render(<ReleaseCalendarPlaceholder />);

    expect(screen.getByRole('status')).toHaveTextContent('Visualização em breve');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
