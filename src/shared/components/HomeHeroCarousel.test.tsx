import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomeHeroCarousel } from './HomeHeroCarousel';

afterEach(() => vi.useRealTimers());

describe('HomeHeroCarousel', () => {
  it('permite navegar entre as quatro imagens e voltar ao início', () => {
    render(<HomeHeroCarousel />);
    expect(
      screen.getByRole('heading', { name: 'Seu próximo jogo começa aqui' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Imagem anterior' }));
    expect(screen.getByText('Overwatch')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima imagem' }));
    expect(screen.getByText('Grand Theft Auto VI')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar imagem 3: The Legend of Zelda' }));
    expect(screen.getByText('The Legend of Zelda')).toBeInTheDocument();
  });

  it('troca automaticamente e respeita a pausa', () => {
    vi.useFakeTimers();
    render(<HomeHeroCarousel />);
    void act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByText('The Witcher 3: Wild Hunt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pausar carrossel' }));
    void act(() => vi.advanceTimersByTime(12000));
    expect(screen.getByText('The Witcher 3: Wild Hunt')).toBeInTheDocument();
  });
});
