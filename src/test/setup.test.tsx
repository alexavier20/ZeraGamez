import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('test setup', () => {
  it('renders a temporary tree', () => {
    render(<div data-testid="temporary-tree" />);

    expect(screen.getByTestId('temporary-tree')).toBeInTheDocument();
  });

  it('cleans up the tree from the previous test', () => {
    expect(screen.queryByTestId('temporary-tree')).not.toBeInTheDocument();
  });
});
