import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { FIXTURES } from './mock/fixtures';
import { server } from './mock/server';
import { Admin } from './router';

/** A backend that keeps the ticks it is sent; the paths and bodies of the ticks, in order. */
function ownerChecksBackend() {
  let checks = FIXTURES.ownerChecks.checks;
  const bodies: unknown[] = [];
  const open = () => {
    const counts: Record<string, number> = {};
    for (const check of checks) {
      counts[check.version] = (counts[check.version] ?? 0) + (check.ticked === null ? 1 : 0);
    }
    return counts;
  };
  server.use(
    http.get('*/admin/owner-checks', () => HttpResponse.json({ checks, open: open() })),
    http.post('*/admin/owner-checks/:id/tick', async ({ params, request }) => {
      bodies.push([new URL(request.url).pathname, await request.text()]);
      const id = Number(params['id']);
      const ticked = { at: '2026-11-08T10:00:00.000Z', by: 'owner@example.com' };
      checks = checks.map((check) => (check.id === id ? { ...check, ticked } : check));
      return HttpResponse.json({ check: checks.find((check) => check.id === id) });
    }),
  );
  return bodies;
}

test('Розробка shows the Owner checks per version, and a tick needs no reason', async () => {
  const bodies = ownerChecksBackend();
  window.history.replaceState(null, '', '/admin/development');
  const user = userEvent.setup();
  render(<Admin />);

  const checks = await screen.findByRole('region', { name: 'Перевірки власника' });
  const versions = within(checks).getAllByRole('region');
  expect(versions.map((version) => within(version).getByRole('heading').textContent)).toEqual([
    '1.0',
    '0.9',
  ]);
  const v09 = within(checks).getByRole('region', { name: '0.9' });
  expect(within(v09).getByText('відкрито 1')).toBeDefined();
  expect(within(v09).getByText('позначив owner@example.com 07.11.2026')).toBeDefined();

  await user.click(within(v09).getByRole('checkbox', { name: 'Пошук знаходить слово.' }));

  expect(await within(v09).findByText('усе перевірено')).toBeDefined();
  expect(within(checks).getByRole('region', { name: '1.0' }).textContent).toContain('відкрито 1');
  expect(screen.queryByRole('dialog')).toBeNull();
  // The id alone, in the path: no reason goes with a tick.
  expect(bodies).toEqual([['/v1/admin/owner-checks/1/tick', '']]);
});
