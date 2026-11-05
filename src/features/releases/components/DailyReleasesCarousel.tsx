import { HorizontalGameCarousel } from '@/shared/components/HorizontalGameCarousel';

import { HomeReleaseCard } from './HomeReleaseCard';

import type { ReleaseItem } from '@/features/releases/model/release-presentation';

export function DailyReleasesCarousel({ items }: Readonly<{ items: readonly ReleaseItem[] }>) {
  return (
    <HorizontalGameCarousel
      label="Lançamentos do dia, role para ver mais jogos"
      previousLabel="Ver lançamentos anteriores"
      nextLabel="Ver próximos lançamentos"
    >
      {items.map((item) => (
        <li className="w-40 shrink-0 snap-start sm:w-44" key={item.id}>
          <HomeReleaseCard item={item} />
        </li>
      ))}
    </HorizontalGameCarousel>
  );
}
