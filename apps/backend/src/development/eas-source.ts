import type { EasBuild } from '@slovo/contracts/admin-api';
import type { EasSource } from '@slovo/server-core';
import type { Logger } from 'pino';
import { z } from 'zod';

import { readJson, unavailableRead } from './read-json';

/** The app's newest builds, with what a build's page address needs. */
const BUILDS_QUERY = `query Builds($appId: String!, $limit: Int!) {
  app { byId(appId: $appId) {
    slug
    ownerAccount { name }
    builds(offset: 0, limit: $limit) {
      id platform status buildProfile appVersion appBuildVersion createdAt
    }
  } }
}`;

/**
 * One build as Expo answers it. Its status is any string, since Expo adds
 * statuses: one it does not know reads as still going.
 */
const BuildSchema = z.object({
  id: z.string(),
  platform: z.enum(['IOS', 'ANDROID']),
  status: z.string(),
  buildProfile: z.string().nullable(),
  appVersion: z.string().nullable(),
  appBuildVersion: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

/** The answer, each build read on its own, so one build it cannot read leaves out only that build. */
const BuildsSchema = z.object({
  data: z.object({
    app: z.object({
      byId: z.object({
        slug: z.string(),
        ownerAccount: z.object({ name: z.string() }),
        builds: z.array(z.unknown()),
      }),
    }),
  }),
});

/** What an EAS build status means on Розробка: done, failed, cancelled or still going. */
function statusOf(status: string): EasBuild['status'] {
  if (status === 'FINISHED') return 'finished';
  if (status === 'ERRORED') return 'errored';
  if (status === 'CANCELED') return 'canceled';
  return 'in-progress';
}

/**
 * The app's builds on EAS over Expo's GraphQL API, with a read token. It only
 * reads: no build is ever started (ADR 0004). Without a token every read
 * answers `unavailable`.
 */
export function createEasSource({
  token,
  projectId,
  logger,
  fetch = globalThis.fetch,
}: {
  token: string | undefined;
  projectId: string;
  logger: Logger;
  fetch?: typeof globalThis.fetch;
}): EasSource {
  if (token === undefined) return { latestBuilds: unavailableRead };
  return {
    async latestBuilds(limit) {
      const answer = await readJson(
        fetch,
        logger,
        'https://api.expo.dev/graphql',
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ query: BUILDS_QUERY, variables: { appId: projectId, limit } }),
        },
        BuildsSchema,
      );
      if (!answer.ok) return answer;
      const app = answer.value.data.app.byId;
      const builds = app.builds.flatMap((row) => {
        const build = BuildSchema.safeParse(row);
        return build.success ? [build.data] : [];
      });
      if (builds.length < app.builds.length) {
        logger.warn(
          { left: app.builds.length - builds.length },
          'EAS answered builds of an unknown shape',
        );
      }
      return {
        ok: true,
        value: builds.map((build) => ({
          id: build.id,
          platform: build.platform === 'IOS' ? 'ios' : 'android',
          profile: build.buildProfile ?? '',
          status: statusOf(build.status),
          appVersion: build.appVersion,
          buildNumber: build.appBuildVersion,
          createdAt: new Date(build.createdAt).toISOString(),
          url: `https://expo.dev/accounts/${app.ownerAccount.name}/projects/${app.slug}/builds/${build.id}`,
        })),
      };
    },
  };
}
