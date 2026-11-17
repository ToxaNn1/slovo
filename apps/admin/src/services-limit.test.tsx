import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { server } from './mock/server';
import { SERVICE_COSTS, SERVICE_IDS, SERVICES } from './mock/services-fixtures';
import { Admin } from './router';

/** A fresh metered reading of the limits, read now. */
const metered = (usage: { name: string; unit: string; used: number; limit: number }[]) => ({
  state: 'read',
  reading: { kind: 'metered', usage },
  readAt: new Date().toISOString(),
  stale: false,
});

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/services');
  server.use(
    http.get('*/admin/services', () =>
      HttpResponse.json({ services: SERVICES, costs: SERVICE_COSTS }),
    ),
    http.get('*/admin/services/usage', () =>
      HttpResponse.json({
        usage: [
          {
            serviceId: SERVICE_IDS.Sentry,
            read: metered([{ name: 'errors', unit: 'errors', used: 4500, limit: 5000 }]),
          },
          {
            serviceId: SERVICE_IDS.PostHog,
            read: metered([{ name: 'events', unit: 'events', used: 899_999, limit: 1_000_000 }]),
          },
        ],
      }),
    ),
  );
});

test('a block at 90 % of a limit has the yellow mark, one below it none', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const blocks = within(await screen.findByRole('group', { name: 'Полотно Сервісів' }));

  const sentry = within(blocks.getByRole('button', { name: 'Sentry' }));
  expect(await sentry.findByText('Ліміт майже вичерпано')).toBeDefined();
  const posthog = within(blocks.getByRole('button', { name: 'PostHog' }));
  expect(await posthog.findByText('90%')).toBeDefined();
  expect(posthog.queryByText('Ліміт майже вичерпано')).toBeNull();

  await user.click(blocks.getByRole('button', { name: 'Sentry' }));
  const panel = within(await screen.findByRole('dialog', { name: 'Sentry' }));
  expect(panel.getByText('Ліміт майже вичерпано')).toBeDefined();
});
