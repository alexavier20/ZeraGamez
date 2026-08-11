import { ReleaseCard } from '@/features/releases/components/ReleaseCard';
import {
  formatReleaseDate,
  getReleaseDayKind,
  type ReleaseGroup,
} from '@/features/releases/model/release-presentation';

import type * as React from 'react';

export interface ReleaseDateGroupProps {
  readonly generatedAt: string;
  readonly group: ReleaseGroup;
}

export function ReleaseDateGroup({
  generatedAt,
  group,
}: ReleaseDateGroupProps): React.ReactElement {
  const dayKind = getReleaseDayKind(group.releaseDate, generatedAt);
  const date = formatReleaseDate(group.releaseDate, false);
  const headingId = `release-date-${group.releaseDate}`;
  const heading =
    dayKind === 'today' ? `Hoje ${date}` : dayKind === 'tomorrow' ? `Amanhã — ${date}` : date;
  const mobileHeading = dayKind === 'today' ? `Hoje — ${date}` : heading;

  return (
    <section aria-labelledby={headingId} role="group">
      <h2 aria-label={heading} className="font-heading" id={headingId}>
        <span className="hidden items-center gap-2 text-xl font-semibold text-text-primary sm:flex">
          {dayKind === 'today' ? (
            <span className="rounded-md bg-brand px-2 py-1 text-xs font-semibold text-content-primary">
              Hoje
            </span>
          ) : null}
          {dayKind === 'today' ? ' ' : null}
          {dayKind === 'tomorrow' ? <span>Amanhã — {date}</span> : <span>{date}</span>}
        </span>
        <span className="text-xs font-semibold uppercase text-text-muted sm:hidden">
          {mobileHeading}
        </span>
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {group.items.map((item) => (
          <div
            className="sm:[content-visibility:auto] sm:[contain-intrinsic-size:407px]"
            key={item.id}
            role="listitem"
          >
            <ReleaseCard generatedAt={generatedAt} item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
