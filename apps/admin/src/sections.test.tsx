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
  expect(links.map((link) => link.textContent)).toEqual(ORDER);
});

/**
 * Безпека shows the Власник its blocks: `security.test.tsx`. Розробка is built
 * and shows the Owner checks: `development.test.tsx`, `owner-checks.test.tsx`.
 * Контент shows the content editor: `content-editor.test.tsx`.
 */
const BUILT = ['Безпека', 'Розробка', 'Контент'];
const EMPTY = ORDER.filter((title) => !BUILT.includes(title));

test('each section not yet built opens its empty state with the same texts in both themes', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const theme = await screen.findByRole('button', { name: 'Темна тема' });
  for (const title of EMPTY) {
    await user.click((await sidebar()).getByRole('link', { name: title }));
    const section = await screen.findByRole('region', { name: title });
    expect(within(section).getByText('Поки що порожньо')).toBeDefined();
    const light = section.textContent;
    expect(document.documentElement.dataset['theme']).toBe('light');

    await user.click(theme);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(theme.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: title }).textContent).toBe(light);
    await user.click(theme);
  }
});

test('the dark Theme the owner picked is kept for the next visit', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<Admin />);
  await user.click(await screen.findByRole('button', { name: 'Темна тема' }));
  unmount();
  delete document.documentElement.dataset['theme'];

  render(<Admin />);
  await screen.findByRole('region', { name: 'Огляд' });
  expect(document.documentElement.dataset['theme']).toBe('dark');
});
