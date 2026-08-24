import { ReleaseDateGroup } from '@/features/releases/components/ReleaseDateGroup';
import { groupReleasesByDate } from '@/features/releases/model/release-presentation';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';
import type { PendingReleaseActionType } from '@/features/releases/components/ReleaseCard';
import type * as React from 'react';

export interface PendingReleaseAction {
  readonly igdbId: number;
  readonly releaseDate: string;
  readonly type: PendingReleaseActionType;
}

export interface ReleaseListProps {
  readonly exactDate?: boolean;
  readonly onPendingActionConsumed?: () => void;
  readonly pendingAction?: PendingReleaseAction | null;
  readonly response: ReleasesResponse;
}

export function ReleaseList({
  exactDate = false,
  onPendingActionConsumed,
  pendingAction,
  response,
}: ReleaseListProps): React.ReactElement {
  const groups = groupReleasesByDate(response.data);

  return (
    <div className="mt-7 space-y-7">
      {groups.map((group) => (
        <ReleaseDateGroup
          generatedAt={response.meta.generatedAt}
          group={group}
          headingMode={exactDate ? 'full' : 'relative'}
          key={group.releaseDate}
          onPendingActionConsumed={onPendingActionConsumed}
          pendingAction={pendingAction}
        />
      ))}
    </div>
  );
}
