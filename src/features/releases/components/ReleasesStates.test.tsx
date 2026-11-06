import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ReleasesEmpty,
  ReleasesError,
  ReleasesLoading,
} from '@/features/releases/components/ReleasesStates';

describe('release list states', () => {
  it('renders an accessible loading state with twelve pulsing card previews without visible loading copy', () => {
    render(<ReleasesLoading />);

    const loadingState = screen.getByRole('status');
    const skeletons = screen.getAllByTestId('release-card-skeleton');

    expect(loadingState).toHaveAttribute('aria-live', 'polite');
    expect(loadingState).toHaveAccessibleName('Carregando jogos');
    expect(screen.queryByText('Carregando jogos')).not.toBeInTheDocument();
    expect(skeletons).toHaveLength(12);
    expect(loadingState.querySelector('svg')).toBeNull();
    for (const skeleton of skeletons) {
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
      expect(skeleton).toHaveClass('animate-pulse');
      expect(skeleton).toHaveTextContent('');
      expect(skeleton.firstElementChild).toHaveClass('aspect-[16/9]');
    }
  });

  it('renders the approved empty copy', () => {
    render(<ReleasesEmpty />);

    expect(screen.getByRole('status')).toHaveTextContent('Nenhum jogo encontrado');
    expect(
      screen.getByText('Escolha outra plataforma ou gênero, ou limpe os filtros ativos'),
    ).toBeInTheDocument();
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
});
