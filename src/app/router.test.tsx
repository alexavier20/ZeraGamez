import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const getSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/supabase/client', () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

import { AppRouter } from './router';

describe('AppRouter', () => {
  it('keeps the default auth service resolution stable across rerenders', () => {
    getSupabaseClientMock.mockReturnValue(null);

    const view = render(<AppRouter />);
    view.rerender(<AppRouter />);

    expect(getSupabaseClientMock).toHaveBeenCalledTimes(1);
  });
});
