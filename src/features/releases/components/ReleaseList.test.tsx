import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseList } from '@/features/releases/components/ReleaseList';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

const responseWithThreeReleasesAcrossTwoDates: ReleasesResponse = {
  data: [
    {
      id: 1,
      slug: 'primeiro-jogo',
      name: 'Primeiro jogo',
      coverUrl: null,
      releaseDate: '2026-08-10',
      platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
      genres: [],
    },
    {
      id: 2,
      slug: 'segundo-jogo',
      name: 'Segundo jogo',
      coverUrl: null,
      releaseDate: '2026-08-10',
      platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
      genres: [],
    },
    {
      id: 3,
      slug: 'terceiro-jogo',
      name: 'Terceiro jogo',
      coverUrl: null,
      releaseDate: '2026-08-11',
      platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
      genres: [],
    },
  ],
  meta: {
    from: '2026-08-10',
    to: '2026-08-11',
    count: 3,
    limit: 50,
    generatedAt: '2026-08-10T12:00:00.000Z',
    sourceTruncated: false,
  },
};

describe('ReleaseList', () => {
  it('renders every release once in chronological date groups', () => {
    render(<ReleaseList response={responseWithThreeReleasesAcrossTwoDates} />);

    const groups = screen.getAllByRole('region', { name: /10 de agosto|11 de agosto/i });

    expect(groups).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByText('Primeiro jogo')).toHaveLength(2);
    expect(screen.getAllByText('Segundo jogo')).toHaveLength(2);
    expect(screen.getAllByText('Terceiro jogo')).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('Hoje');
    expect(groups[1]).toHaveTextContent('Amanhã');
  });

  it('names date groups for today, tomorrow, and later dates without mutating the response', () => {
    const response: ReleasesResponse = {
      ...responseWithThreeReleasesAcrossTwoDates,
      data: [
        ...responseWithThreeReleasesAcrossTwoDates.data,
        {
          id: 4,
          slug: 'quarto-jogo',
          name: 'Quarto jogo',
          coverUrl: null,
          releaseDate: '2026-08-13',
          platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
          genres: [],
        },
      ],
      meta: { ...responseWithThreeReleasesAcrossTwoDates.meta, count: 4, to: '2026-08-13' },
    };
    const snapshot = structuredClone(response);

    render(<ReleaseList response={response} />);

    expect(screen.getByRole('region', { name: 'Hoje 10 de agosto' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Amanhã — 11 de agosto' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '13 de agosto' })).toBeInTheDocument();
    expect(response).toEqual(snapshot);
  });

  it('keeps one exposed semantic heading per date group across responsive presentations', () => {
    render(<ReleaseList response={responseWithThreeReleasesAcrossTwoDates} />);

    const todayGroup = screen.getByRole('region', { name: 'Hoje 10 de agosto' });
    const dateHeadings = screen.getAllByRole('heading', { level: 2 });
    const todayHeading = within(todayGroup).getByRole('heading', {
      level: 2,
      name: 'Hoje 10 de agosto',
    });
    const mobileCaption = within(todayGroup).getByText('Hoje — 10 de agosto');

    expect(dateHeadings).toHaveLength(2);
    expect(todayHeading).not.toHaveClass('hidden');
    expect(todayHeading).not.toHaveClass('sm:block');
    expect(mobileCaption).not.toHaveAttribute('aria-hidden', 'true');
    expect(mobileCaption).toHaveClass('uppercase', 'sm:hidden');
  });

  it('owns direct list items from one heading-labelled list in each neutral date collection', () => {
    render(<ReleaseList response={responseWithThreeReleasesAcrossTwoDates} />);

    const todayGroup = screen.getByRole('region', { name: 'Hoje 10 de agosto' });
    const heading = within(todayGroup).getByRole('heading', {
      level: 2,
      name: 'Hoje 10 de agosto',
    });
    const lists = within(todayGroup).getAllByRole('list', { name: 'Hoje 10 de agosto' });
    const list = lists[0];
    const items = within(list).getAllByRole('listitem');
    const outerCollection = todayGroup.parentElement;

    expect(outerCollection).not.toHaveAttribute('role');
    expect(lists).toHaveLength(1);
    expect(list).toHaveAttribute('aria-labelledby', heading.id);
    expect(list).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.parentElement).toBe(list);
      expect(item).toHaveClass('sm:[content-visibility:auto]', 'sm:[contain-intrinsic-size:407px]');
    }
  });
});
