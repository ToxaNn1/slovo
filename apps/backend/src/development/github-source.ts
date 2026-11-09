import type { MainCi } from '@slovo/contracts/admin-api';
import type { GitHubSource } from '@slovo/server-core';
import type { Logger } from 'pino';
import { z } from 'zod';

import { readJson, unavailableRead } from './read-json';

const PullsSchema = z.array(
  z.object({
    number: z.number().int(),
    title: z.string(),
    user: z.object({ login: z.string() }).nullable(),
    html_url: z.string(),
    draft: z.boolean().default(false),
    updated_at: z.iso.datetime(),
  }),
);

const RunsSchema = z.object({
  workflow_runs: z.array(
    z.object({
      status: z.string().nullable(),
      conclusion: z.string().nullable(),
      html_url: z.string(),
      updated_at: z.iso.datetime(),
    }),
  ),
});

const MilestonesSchema = z.array(
  z.object({
    title: z.string(),
    open_issues: z.number().int(),
    closed_issues: z.number().int(),
    due_on: z.iso.datetime().nullable(),
  }),
);

const ReleasesSchema = z.array(
  z.object({
    tag_name: z.string(),
    name: z.string().nullable(),
    draft: z.boolean(),
    published_at: z.iso.datetime().nullable(),
    html_url: z.string(),
  }),
);

/** What a CI run's status and conclusion mean on Розробка. */
function ciOf(run: z.infer<typeof RunsSchema>['workflow_runs'][number] | undefined): MainCi {
  if (run === undefined) return { state: 'none' };
  if (run.status !== 'completed') return { state: 'pending', url: run.html_url };
  return {
    state: run.conclusion === 'success' ? 'success' : 'failure',
    url: run.html_url,
    finishedAt: run.updated_at,
  };
}

/**
 * The repository on GitHub over its REST API, with a read-only fine-grained
 * token. Without a token every read answers `unavailable`.
 */
export function createGitHubSource({
  token,
  repository,
  logger,
  fetch = globalThis.fetch,
}: {
  token: string | undefined;
  repository: string;
  logger: Logger;
  fetch?: typeof globalThis.fetch;
}): GitHubSource {
  if (token === undefined) {
    return {
      pullRequests: unavailableRead,
      mainCi: unavailableRead,
      milestones: unavailableRead,
      releases: unavailableRead,
    };
  }
  const init = {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  };
  const read = <Schema extends z.ZodType>(path: string, schema: Schema) =>
    readJson(fetch, logger, `https://api.github.com/repos/${repository}${path}`, init, schema);
  return {
    async pullRequests() {
      const pulls = await read(
        '/pulls?state=open&sort=updated&direction=desc&per_page=30',
        PullsSchema,
      );
      if (!pulls.ok) return pulls;
      return {
        ok: true,
        value: pulls.value.map((pull) => ({
          number: pull.number,
          title: pull.title,
          author: pull.user?.login ?? '',
          url: pull.html_url,
          draft: pull.draft,
          updatedAt: pull.updated_at,
        })),
      };
    },
    async mainCi() {
      const runs = await read(
        '/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=1',
        RunsSchema,
      );
      return runs.ok ? { ok: true, value: ciOf(runs.value.workflow_runs[0]) } : runs;
    },
    async milestones() {
      const milestones = await read('/milestones?state=all&per_page=100', MilestonesSchema);
      if (!milestones.ok) return milestones;
      return {
        ok: true,
        value: milestones.value.map((milestone) => ({
          title: milestone.title,
          open: milestone.open_issues,
          closed: milestone.closed_issues,
          dueOn: milestone.due_on,
        })),
      };
    },
    async releases() {
      const releases = await read('/releases?per_page=10', ReleasesSchema);
      if (!releases.ok) return releases;
      return {
        ok: true,
        value: releases.value.flatMap((release) =>
          release.draft || release.published_at === null
            ? []
            : [
                {
                  tag: release.tag_name,
                  name: release.name ?? release.tag_name,
                  publishedAt: release.published_at,
                  url: release.html_url,
                },
              ],
        ),
      };
    },
  };
}
