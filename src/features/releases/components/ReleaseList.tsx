import { ReleaseDateGroup } from '@/features/releases/components/ReleaseDateGroup';
import { groupReleasesByDate } from '@/features/releases/model/release-presentation';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';
import type * as React from 'react';

export interface ReleaseListProps {
  readonly exactDate?: boolean;
  readonly response: ReleasesResponse;
}

export function ReleaseList({ exactDate = false, response }: ReleaseListProps): React.ReactElement {
  const groups = groupReleasesByDate(response.data);

  return (
    <div className="mt-7 space-y-7">
      {groups.map((group) => (
        <ReleaseDateGroup
          generatedAt={response.meta.generatedAt}
          group={group}
          headingMode={exactDate ? 'full' : 'relative'}
          key={group.releaseDate}
        />
      ))}
    </div>
  );
}
