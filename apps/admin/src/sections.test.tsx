import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { Admin } from './router';

const ORDER = ['Огляд', 'Контент', 'Свічі', 'Аналітика', 'Якість', 'Розробка', 'Безпека'];

async function sidebar() {
  return within(await screen.findByRole('navigation', { name: 'Розділи' }));
}

test('the sidebar shows the seven sections in order', async () => {
  render(<Admin />);
  const links = (await sidebar()).getAllByRole('link');
  // Контент may carry the count of the Агент batches not reviewed yet.
  expect(links.map((link) => link.textContent.replace(/\d+$/, ''))).toEqual(ORDER);
});

/**
 * Огляд is built: `overview.test.tsx`. Аналітика is built: `analytics.test.tsx`.
 * Безпека shows the Власник its blocks: `security.test.tsx`. Розробка is built
 * and shows the Owner checks: `development.test.tsx`, `owner-checks.test.tsx`.
 * Свічі shows the switch screens: `switches/*.test.tsx`. Якість is filled and
 * checked here and in `quality.test.tsx`.
 * Контент shows the content editor: `content-editor.test.tsx`.
 */
const BUILT = ['Огляд', 'Аналітика', 'Безпека', 'Розробка', 'Свічі', 'Контент'];
const OPENED = ORDER.filter((title) => !BUILT.includes(title));

/** Waits for a section's content: its empty state, or what a filled section reads. */
async function settled(section: HTMLElement, title: string) {
  const inside = within(section);
  if (title !== 'Якість') return inside.getByText('Поки що порожньо');
  await inside.findByRole('listitem', { name: 'Без збоїв' });
  return inside.findByRole('figure', { name: 'Тривалість CI' });
}

test('each section not yet built opens with the same texts in both themes, the ones not yet filled in their empty state', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  for (const title of OPENED) {
    await user.click((await sidebar()).getByRole('link', { name: new RegExp(`^${title}`) }));
    const section = await screen.findByRole('region', { name: title });
    expect(await settled(section, title)).toBeDefined();
    const light = section.textContent;
    expect(document.documentElement.dataset['theme']).toBe('light');

    await user.click(screen.getByRole('button', { name: 'owner@example.com Власник' }));
    const dark = screen.getByRole('button', { name: 'Темна' });
    await user.click(dark);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(dark.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: title }).textContent).toBe(light);
    await user.click(screen.getByRole('button', { name: 'Світла' }));
  }
});

test('the dark Theme the owner picked is kept for the next visit', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<Admin />);
  await user.click(await screen.findByRole('button', { name: 'owner@example.com Власник' }));
  await user.click(screen.getByRole('button', { name: 'Темна' }));
  unmount();
  delete document.documentElement.dataset['theme'];

  render(<Admin />);
  await screen.findByRole('region', { name: 'Огляд' });
  expect(document.documentElement.dataset['theme']).toBe('dark');
});
