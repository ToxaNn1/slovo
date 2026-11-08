import type { Development, Milestone } from '@slovo/contracts/admin-api';

import type { Clock, EasSource, GitHubSource, SourceRead } from '../ports';
import { cachedRead } from '../sources/cached-source';

/** How long a read of GitHub is kept: five minutes. */
export const GITHUB_TTL_MS = 5 * 60 * 1000;
/** How long a read of EAS is kept: ten minutes. */
export const EAS_TTL_MS = 10 * 60 * 1000;
/** How many of the newest EAS builds Розробка shows. */
const EAS_BUILDS = 10;
/** The titles of the version milestones: 0.1 to 0.99 and 1.0. */
const VERSION = /^(0\.[1-9]\d*|1\.0)$/;

/** The Розробка section of the admin: GitHub and EAS, each read through a cache. */
export interface DevelopmentOverview {
  overview(): Promise<Development>;
}

/** The version milestones, lowest version first. */
function versionsOf(milestones: readonly Milestone[]): Milestone[] {
  const minor = ({ title }: Milestone) => (title === '1.0' ? Infinity : Number(title.slice(2)));
  return milestones.filter(({ title }) => VERSION.test(title)).sort((a, b) => minor(a) - minor(b));
}

export function createDevelopment({
  github,
  eas,
  clock,
}: {
  github: GitHubSource;
  eas: EasSource;
  clock: Clock;
}): DevelopmentOverview {
  const readGitHub = cachedRead(clock, GITHUB_TTL_MS, async () => {
    const [pullRequests, mainCi, milestones, releases] = await Promise.all([
      github.pullRequests(),
      github.mainCi(),
      github.milestones(),
      github.releases(),
    ]);
    if (!pullRequests.ok || !mainCi.ok || !milestones.ok || !releases.ok) {
      return { ok: false, reason: 'unavailable' } satisfies SourceRead<never>;
    }
    return {
      ok: true,
      value: {
        pullRequests: pullRequests.value,
        mainCi: mainCi.value,
        milestones: versionsOf(milestones.value),
        releases: releases.value,
      },
    } as const;
  });
  const readEas = cachedRead(clock, EAS_TTL_MS, () => eas.latestBuilds(EAS_BUILDS));

  return {
    async overview() {
      const [fromGitHub, fromEas] = await Promise.all([readGitHub(), readEas()]);
      return {
        github: fromGitHub.ok
          ? { state: 'ok', fetchedAt: fromGitHub.fetchedAt.toISOString(), ...fromGitHub.value }
          : { state: 'unavailable' },
        eas: fromEas.ok
          ? { state: 'ok', fetchedAt: fromEas.fetchedAt.toISOString(), builds: fromEas.value }
          : { state: 'unavailable' },
      };
    },
  };
}
