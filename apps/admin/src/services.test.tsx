import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { override, refusal } from './mock/handlers';
import { server } from './mock/server';
import { SENTRY_USAGE, SERVICE_IDS, SERVICES } from './mock/services-fixtures';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/services');
});

/** The screen as wide as `width` in CSS pixels: `matchMedia` answers its min-width queries. */
function screenOf(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => {
      const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query)?.[1];
      return {
        matches: minWidth !== undefined && width >= Number(minWidth),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      };
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

async function canvas() {
  return within(await screen.findByRole('group', { name: 'Полотно Сервісів' }));
}

test('an Адмін has no «Сервіси» in the sidebar and does not open it', async () => {
  let asked = false;
  server.use(
    override('me', () => ({ email: 'a@example.com', role: 'admin' })),
    override('services.list', () => {
      asked = true;
      return refusal(403, { code: 'FORBIDDEN' });
    }),
  );
  render(<Admin />);

  const sidebar = within(await screen.findByRole('navigation', { name: 'Розділи' }));
  expect(sidebar.getByRole('link', { name: 'Розробка' })).toBeDefined();
  expect(sidebar.queryByRole('link', { name: 'Сервіси' })).toBeNull();
  expect(await screen.findByText('Цей розділ відкриває тільки Власник.')).toBeDefined();
  expect(screen.queryByRole('group', { name: 'Полотно Сервісів' })).toBeNull();
  expect(asked).toBe(false);
});

test('the eleven Services are 230 × 115 blocks at their places, joined by solid and dashed lines', async () => {
  render(<Admin />);
  const blocks = await canvas();

  for (const service of SERVICES) {
    const block = blocks.getByRole('button', { name: service.name });
    expect(block.style.left).toBe(`${String(service.position.x)}px`);
    expect(block.style.top).toBe(`${String(service.position.y)}px`);
    expect([block.style.width, block.style.height]).toEqual(['230px', '115px']);
  }
  const lines = within(blocks.getByRole('img', { name: 'Зв’язки між Сервісами' }));
  const dashed = (name: string) => lines.getByLabelText(name).getAttribute('stroke-dasharray');
  expect(dashed('Railway → Neon')).toBeNull();
  expect(dashed('GitHub → Railway')).toBeNull();
  expect(dashed('Railway → Telegram bot')).not.toBeNull();
  const total = SERVICES.reduce((sum, service) => sum + service.links.length, 0);
  expect(lines.getAllByLabelText(/→/)).toHaveLength(total);
});

test('the canvas zooms out, in and back to fit its window, as Railway’s does', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const zoom = within(await screen.findByRole('toolbar', { name: 'Масштаб полотна' }));
  const group = await screen.findByRole('group', { name: 'Полотно Сервісів' });

  expect(zoom.getByText('100 %')).toBeDefined();
  await user.click(zoom.getByRole('button', { name: 'Зменшити' }));
  await user.click(zoom.getByRole('button', { name: 'Зменшити' }));
  expect(zoom.getByText('80 %')).toBeDefined();
  expect(group.style.transform).toMatch(/^translate\(0px(, 0px)?\) scale\(0\.8\)$/);
  await user.click(zoom.getByRole('button', { name: 'Збільшити' }));
  expect(zoom.getByText('90 %')).toBeDefined();
  await user.click(zoom.getByRole('button', { name: 'Вмістити' }));
  expect(zoom.getByText('100 %')).toBeDefined();
  expect(group.style.transform).toMatch(/^translate\(0px(, 0px)?\) scale\(1\)$/);
});

test('dragging the empty canvas or the wheel moves it anywhere, as on Railway; dragging a block does not', async () => {
  render(<Admin />);
  const group = await screen.findByRole('group', { name: 'Полотно Сервісів' });
  const drag = (from: Element, by: { x: number; y: number }) => {
    fireEvent.pointerDown(from, { button: 0, clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(from, { clientX: 500 + by.x, clientY: 300 + by.y, pointerId: 1 });
    fireEvent.pointerUp(from, { clientX: 500 + by.x, clientY: 300 + by.y, pointerId: 1 });
  };

  drag(group, { x: 120, y: 60 });
  expect(group.style.transform).toBe('translate(120px, 60px) scale(1)');
  drag(within(group).getByRole('button', { name: 'Neon' }), { x: 80, y: 40 });
  expect(group.style.transform).toBe('translate(120px, 60px) scale(1)');
  fireEvent.wheel(group, { deltaX: 20, deltaY: 100 });
  expect(group.style.transform).toBe('translate(100px, -40px) scale(1)');
});

test('a block opens the side panel with the Service’s name', async () => {
  const user = userEvent.setup();
  render(<Admin />);

  await user.click((await canvas()).getByRole('button', { name: 'Neon' }));

  const panel = within(await screen.findByRole('dialog', { name: 'Neon' }));
  await user.click(panel.getByRole('button', { name: 'Закрити' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

test('the canvas follows the admin Theme: white with black dots, then black with white dots', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const frame = async () =>
    (await screen.findByRole('toolbar', { name: 'Масштаб полотна' })).parentElement;

  expect((await frame())?.className).toMatch(/(^| )bg-white( |$)/);
  expect(document.documentElement.dataset['theme']).toBe('light');
  expect((await frame())?.className).toContain('bg-[radial-gradient(rgb(0_0_0/0.22)');
  expect((await frame())?.closest('[data-theme="dark"]')).toBeNull();

  await user.click(screen.getByRole('button', { name: /^owner@example\.com\s*Власник$/ }));
  await user.click(screen.getByRole('button', { name: 'Темна' }));
  expect(document.documentElement.dataset['theme']).toBe('dark');
  expect((await frame())?.className).toContain('dark:bg-black');
});

test('a phone gets a card list of the Services with the same panel', async () => {
  screenOf(390);
  const user = userEvent.setup();
  render(<Admin />);

  const cards = within(await screen.findByRole('list', { name: 'Сервіси' }));
  expect(cards.getAllByRole('listitem')).toHaveLength(SERVICES.length);
  expect(screen.queryByRole('group', { name: 'Полотно Сервісів' })).toBeNull();

  await user.click(cards.getByRole('button', { name: 'Railway' }));
  expect(await screen.findByRole('dialog', { name: 'Railway' })).toBeDefined();
});

test('the Sentry and PostHog blocks show a usage bar, PostHog’s marked stale', async () => {
  render(<Admin />);
  const blocks = await canvas();

  const sentry = within(blocks.getByRole('button', { name: 'Sentry' }));
  const bar = await sentry.findByRole('meter', { name: 'Помилки' });
  expect(bar.getAttribute('aria-valuenow')).toBe('1200');
  expect(bar.getAttribute('aria-valuemax')).toBe('5000');
  expect(sentry.queryByText('застаріло')).toBeNull();

  const posthog = within(blocks.getByRole('button', { name: 'PostHog' }));
  expect((await posthog.findByRole('meter', { name: 'Події' })).getAttribute('aria-valuenow')).toBe(
    '250000',
  );
  expect(posthog.getByText('застаріло')).toBeDefined();
  expect(within(blocks.getByRole('button', { name: 'Zoho Mail' })).queryByRole('meter')).toBeNull();
});

test('a Service whose read failed says so on its block', async () => {
  server.use(
    override('services.usage', () => ({
      usage: [{ serviceId: SERVICE_IDS.Sentry, read: { state: 'unavailable' } }],
    })),
  );
  render(<Admin />);
  const blocks = await canvas();

  const sentry = within(blocks.getByRole('button', { name: 'Sentry' }));
  expect(await sentry.findByText('не вдалося прочитати')).toBeDefined();
  expect(sentry.queryByRole('meter')).toBeNull();
});

test('the panel shows the usage numbers and the read time, and «Оновити» reads again', async () => {
  let refreshed: unknown;
  server.use(
    override('services.refreshUsage', async ({ request }) => {
      refreshed = await request.json();
      return {
        usage: {
          ...SENTRY_USAGE,
          read: {
            ...SENTRY_USAGE.read,
            reading: {
              kind: 'metered',
              usage: [{ name: 'errors', unit: 'events', used: 1300, limit: 5000 }],
            },
          },
        },
      };
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await user.click((await canvas()).getByRole('button', { name: 'Sentry' }));
  const panel = within(await screen.findByRole('dialog', { name: 'Sentry' }));

  expect(panel.getByText('1 200 з 5 000 подій')).toBeDefined();
  expect(panel.getByText(/Оновлено 17 листопада, 09:30/)).toBeDefined();

  await user.click(panel.getByRole('button', { name: 'Оновити' }));

  expect(refreshed).toEqual({ serviceId: SERVICE_IDS.Sentry });
  expect(await panel.findByText('1 300 з 5 000 подій')).toBeDefined();
});

test('the Neon panel names each limit and unit as the owner reads them', async () => {
  server.use(
    override('services.usage', () => ({
      usage: [
        {
          serviceId: SERVICE_IDS.Neon,
          read: {
            ...SENTRY_USAGE.read,
            reading: {
              kind: 'metered',
              usage: [
                { name: 'compute', unit: 'CU-hours', used: 25, limit: 100 },
                { name: 'egress', unit: 'GB', used: 4.5, limit: 5 },
              ],
            },
          },
        },
      ],
    })),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const blocks = await canvas();

  const neon = within(blocks.getByRole('button', { name: 'Neon' }));
  expect(
    (await neon.findByRole('meter', { name: 'Вихідний трафік' })).getAttribute('aria-valuenow'),
  ).toBe('4.5');
  await user.click(blocks.getByRole('button', { name: 'Neon' }));
  const panel = within(await screen.findByRole('dialog', { name: 'Neon' }));
  expect(panel.getByText('Обчислення')).toBeDefined();
  expect(panel.getByText('25 з 100 CU-год')).toBeDefined();
  expect(panel.getByText('4,5 з 5 ГБ')).toBeDefined();
});
