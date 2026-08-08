import {
  consolidateReleases,
  type CandidateRelease,
  type ConsolidatedRelease,
} from '../domain/release';

import type { ReleaseQuery } from './releases-query';

export interface Clock {
  now(): Date;
}

export interface ReleaseRepositoryResult {
  candidates: CandidateRelease[];
  sourceTruncated: boolean;
}

export interface ReleaseRepository {
  findUpcoming(query: ReleaseQuery): Promise<ReleaseRepositoryResult>;
}

export interface ListUpcomingReleasesDependencies {
  clock: Clock;
  repository: ReleaseRepository;
}

export interface ListUpcomingReleasesResult {
  data: ConsolidatedRelease[];
  meta: {
    from: string;
    to: string;
    count: number;
    limit: number;
    generatedAt: string;
    sourceTruncated: boolean;
  };
}

export async function listUpcomingReleases(
  query: ReleaseQuery,
  dependencies: ListUpcomingReleasesDependencies,
): Promise<ListUpcomingReleasesResult> {
  const result = await dependencies.repository.findUpcoming(query);
  const data = consolidateReleases(result.candidates, query.limit);

  return {
    data,
    meta: {
      from: query.from,
      to: query.to,
      count: data.length,
      limit: query.limit,
      generatedAt: dependencies.clock.now().toISOString(),
      sourceTruncated: result.sourceTruncated,
    },
  };
}
