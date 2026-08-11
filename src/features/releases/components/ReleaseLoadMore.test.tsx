import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReleaseLoadMore } from '@/features/releases/components/ReleaseLoadMore';

import type { ReleasesPagination } from '@/features/releases/hooks/use-releases';

let observerCallback: IntersectionObserverCallback;
let observerOptions: IntersectionObserverInit | undefined;
let observerInstance: IntersectionObserver;
const observe = vi.fn();
const disconnect = vi.fn();

class IntersectionObserverDouble {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observerCallback = callback;
    observerOptions = options;
    observerInstance = this as unknown as IntersectionObserver;
  }

  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  readonly root = null;
  readonly rootMargin = '600px 0px';
  readonly thresholds = [0];
}

interface RenderFooterOptions {
  readonly enabled?: boolean;
  readonly onLoadMore?: () => void;
  readonly onRetry?: () => void;
}

function renderFooter(pagination: ReleasesPagination, options: RenderFooterOptions = {}) {
  return render(
    <ReleaseLoadMore
      enabled={options.enabled ?? true}
      onLoadMore={options.onLoadMore ?? vi.fn()}
      onRetry={options.onRetry ?? vi.fn()}
      pagination={pagination}
    />,
  );
}

describe('ReleaseLoadMore', () => {
  beforeEach(() => {
    observe.mockReset();
    disconnect.mockReset();
    vi.stubGlobal('IntersectionObserver', IntersectionObserverDouble);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads at most once for repeated intersections and disconnects immediately', () => {
    const onLoadMore = vi.fn();
    const { unmount } = render(
      <ReleaseLoadMore
        enabled
        onLoadMore={onLoadMore}
        onRetry={vi.fn()}
        pagination={{ status: 'idle' }}
      />,
    );

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observerOptions).toMatchObject({ rootMargin: '600px 0px' });
    act(() => {
      observerCallback(
        [
          { isIntersecting: true } as IntersectionObserverEntry,
          { isIntersecting: true } as IntersectionObserverEntry,
        ],
        observerInstance,
      );
      observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], observerInstance);
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it('ignores an observer callback queued before unmount', () => {
    const onLoadMore = vi.fn();
    const { unmount } = render(
      <ReleaseLoadMore
        enabled
        onLoadMore={onLoadMore}
        onRetry={vi.fn()}
        pagination={{ status: 'idle' }}
      />,
    );
    const queuedCallback = observerCallback;

    unmount();
    act(() => {
      queuedCallback([{ isIntersecting: true } as IntersectionObserverEntry], observerInstance);
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('ignores an observer callback queued before leaving idle', () => {
    const onLoadMore = vi.fn();
    const onRetry = vi.fn();
    const { rerender } = render(
      <ReleaseLoadMore
        enabled
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        pagination={{ status: 'idle' }}
      />,
    );
    const queuedCallback = observerCallback;

    rerender(
      <ReleaseLoadMore
        enabled
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        pagination={{ status: 'loading' }}
      />,
    );
    act(() => {
      queuedCallback([{ isIntersecting: true } as IntersectionObserverEntry], observerInstance);
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not observe while disabled or while pagination is not idle', () => {
    const onLoadMore = vi.fn();
    const onRetry = vi.fn();
    const { rerender } = render(
      <ReleaseLoadMore
        enabled={false}
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        pagination={{ status: 'idle' }}
      />,
    );
    expect(observe).not.toHaveBeenCalled();
    rerender(
      <ReleaseLoadMore
        enabled
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        pagination={{ status: 'loading' }}
      />,
    );
    expect(observe).not.toHaveBeenCalled();
  });

  it('re-observes when pagination returns from loading to idle', () => {
    const onLoadMore = vi.fn();
    const onRetry = vi.fn();
    const { rerender } = render(
      <ReleaseLoadMore
        enabled
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        pagination={{ status: 'idle' }}
      />,
    );

    expect(observe).toHaveBeenCalledTimes(1);
    rerender(
      <ReleaseLoadMore
        enabled
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        pagination={{ status: 'loading' }}
      />,
    );
    expect(disconnect).toHaveBeenCalledTimes(1);
    rerender(
      <ReleaseLoadMore
        enabled
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        pagination={{ status: 'idle' }}
      />,
    );
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it('shows polite incremental loading', () => {
    renderFooter({ status: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent('Carregando mais lançamentos…');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('preserves an actionable incremental error', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderFooter(
      { status: 'error', error: { status: 503, code: 'SERVICE_UNAVAILABLE' } },
      { onRetry },
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar mais jogos');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows completion copy', () => {
    renderFooter({ status: 'complete' });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Todos os lançamentos disponíveis foram carregados',
    );
  });

  it('falls back to a manual load button without IntersectionObserver', async () => {
    const user = userEvent.setup();
    vi.unstubAllGlobals();
    const onLoadMore = vi.fn();
    renderFooter({ status: 'idle' }, { onLoadMore });

    await user.click(screen.getByRole('button', { name: 'Carregar mais lançamentos' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
