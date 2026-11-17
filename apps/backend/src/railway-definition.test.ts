import { describe, expect, it } from 'vitest';

import railway from '../../../.railway/railway';

type Context = Parameters<typeof railway>[0];
type Definition = Awaited<ReturnType<typeof railway>>;

/** The Railway project `.railway/railway.ts` declares for an environment (ADR 0103). */
async function projectIn(environment: string): Promise<Definition> {
  const context: Context = {
    environment,
    environmentName: environment,
    isEnvironment: (name) => name === environment,
    randomString: () => 'random',
    shared: {},
  };
  return railway(context, (name, definition) => ({ name, ...definition }));
}

/** Each service the project declares, by name, as Railway is given it. */
function servicesOf(definition: Definition) {
  return new Map(
    (definition.resources ?? []).flatMap((resource) =>
      'type' in resource && resource.type === 'service'
        ? [[resource.name, JSON.parse(JSON.stringify(resource)) as ServiceShape] as const]
        : [],
    ),
  );
}

interface ServiceShape {
  readonly deploy?: { cronSchedule?: string; sleepApplication?: boolean; healthcheckPath?: string };
  readonly variables?: Record<string, { type?: string; value?: string } | string>;
  readonly networking?: { customDomains?: Record<string, unknown> };
}

describe('the Railway project file', () => {
  it('declares the Staging Deployment: the backend alone, with no Cron service', async () => {
    const services = servicesOf(await projectIn('staging'));

    expect([...services.keys()]).toEqual(['backend']);
    expect([...services.values()].filter((service) => service.deploy?.cronSchedule)).toEqual([]);
  });

  it('lets the Staging Deployment sleep, on its own domain', async () => {
    const backend = servicesOf(await projectIn('staging')).get('backend');

    expect(backend?.deploy?.sleepApplication).toBe(true);
    expect(Object.keys(backend?.networking?.customDomains ?? {})).toEqual(['staging.slovoapp.org']);
  });

  it('runs the Staging Deployment with Analytics off and Sentry environment `staging`', async () => {
    const variables = servicesOf(await projectIn('staging')).get('backend')?.variables ?? {};

    expect(JSON.stringify(variables['DEPLOYMENT'])).toContain('"staging"');
    expect(Object.keys(variables).filter((name) => name.startsWith('POSTHOG_'))).toEqual([]);
    expect(Object.keys(variables).filter((name) => name.startsWith('R2_'))).toEqual([]);
  });

  it('keeps the Deployment as it was: the backend awake and its three Cron services', async () => {
    const services = servicesOf(await projectIn('production'));

    expect([...services.keys()]).toEqual(['backend', 'alerts', 'quote-check', 'recordings']);
    expect(services.get('backend')?.deploy?.sleepApplication).toBeUndefined();
    expect(services.get('backend')?.variables?.['DEPLOYMENT']).toBeUndefined();
  });
});
