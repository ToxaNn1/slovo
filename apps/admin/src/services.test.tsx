import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { server } from './mock/server';
import { SERVICES } from './mock/services-fixtures';
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
    http.get('*/admin/me', () => HttpResponse.json({ email: 'a@example.com', role: 'admin' })),
    http.get('*/admin/services', () => {
      asked = true;
      return HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
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

test('the eleven Services are blocks at their places, joined by solid and dashed lines', async () => {
  render(<Admin />);
  const blocks = await canvas();

  for (const service of SERVICES) {
    const block = blocks.getByRole('button', { name: service.name });
    expect(block.style.left).toBe(`${String(service.position.x)}px`);
    expect(block.style.top).toBe(`${String(service.position.y)}px`);
  }
  const lines = within(blocks.getByRole('img', { name: 'Зв’язки між Сервісами' }));
  const dashed = (name: string) => lines.getByLabelText(name).getAttribute('stroke-dasharray');
  expect(dashed('Railway → Neon')).toBeNull();
  expect(dashed('GitHub → Railway')).toBeNull();
  expect(dashed('Railway → Telegram bot')).not.toBeNull();
  const total = SERVICES.reduce((sum, service) => sum + service.links.length, 0);
  expect(lines.getAllByLabelText(/→/)).toHaveLength(total);
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

test('the canvas stays dark in both admin themes', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const dark = async () =>
    (await screen.findByRole('group', { name: 'Полотно Сервісів' })).closest('[data-theme]');

  expect((await dark())?.getAttribute('data-theme')).toBe('dark');
  expect(document.documentElement.dataset['theme']).toBe('light');
  expect((await dark())?.className).toContain('bg-black');

  await user.click(screen.getByRole('button', { name: 'owner@example.com Власник' }));
  await user.click(screen.getByRole('button', { name: 'Темна' }));
  expect(document.documentElement.dataset['theme']).toBe('dark');
  expect((await dark())?.getAttribute('data-theme')).toBe('dark');
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
