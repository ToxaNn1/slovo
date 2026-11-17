/** One request the fake Railway was given: its headers and its GraphQL variables. */
export interface RailwayRequest {
  readonly headers: Headers;
  readonly variables: unknown;
}

/** A fake of Railway's GraphQL API: the project's backend and three Crons, in `production`. */
export interface FakeRailway {
  readonly fetch: typeof globalThis.fetch;
  /** Every request, oldest first. */
  readonly asked: readonly RailwayRequest[];
  /** The status of the backend's latest deployment, `SUCCESS` until set. */
  setBackend(status: string): void;
  /** Makes the next answers a GraphQL error, as Railway refusing the token. */
  fail(): void;
}

/** A service instance of the project in an environment. */
function instance(
  environmentId: string,
  latestDeployment: { status: string; updatedAt: string } | null,
  nextCronRunAt: string | null = null,
) {
  return { node: { environmentId, nextCronRunAt, latestDeployment } };
}

/** A fake Railway whose project holds the backend and the alerts, quote-check and recordings Crons. */
export function createFakeRailway(): FakeRailway {
  const asked: RailwayRequest[] = [];
  let backend = 'SUCCESS';
  let failing = false;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const { variables } = (await request.json()) as { variables: unknown };
    asked.push({ headers: request.headers, variables });
    if (failing) return Response.json({ errors: [{ message: 'Not Authorized' }], data: null });
    const service = (name: string, instances: ReturnType<typeof instance>[]) => ({
      node: { name, serviceInstances: { edges: instances } },
    });
    return Response.json({
      data: {
        project: {
          services: {
            edges: [
              service('backend', [
                instance('staging', { status: 'CRASHED', updatedAt: '2026-11-17T08:00:00.000Z' }),
                instance('production', { status: backend, updatedAt: '2026-11-16T12:00:00.000Z' }),
              ]),
              service('alerts', [
                instance(
                  'production',
                  { status: 'SUCCESS', updatedAt: '2026-11-17T09:15:40.000Z' },
                  '2026-11-17T09:45:00.000Z',
                ),
              ]),
              service('quote-check', [
                instance(
                  'production',
                  { status: 'CRASHED', updatedAt: '2026-11-17T09:00:12.000Z' },
                  '2026-11-17T10:00:00.000Z',
                ),
              ]),
              service('recordings', [instance('production', null, '2026-11-17T10:00:00.000Z')]),
            ],
          },
        },
        usage: [
          { measurement: 'CPU_USAGE', value: 1200 },
          { measurement: 'MEMORY_USAGE_GB', value: 5000 },
          { measurement: 'NETWORK_TX_GB', value: 1.8 },
          { measurement: 'DISK_USAGE_GB', value: 0 },
        ],
      },
    });
  };
  return {
    fetch,
    asked,
    setBackend(status) {
      backend = status;
    },
    fail() {
      failing = true;
    },
  };
}
