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

/** Waits for a section's content: its empty state, or what a filled section reads. */
async function settled(section: HTMLElement, title: string) {
  const inside = within(section);
  if (title !== 'Якість') return inside.getByText('Поки що порожньо');
  await inside.findByRole('listitem', { name: 'Без збоїв' });
  return inside.findByRole('figure', { name: 'Тривалість CI' });
}

test('each section opens with the same texts in both themes, the ones not yet filled in their empty state', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const theme = await screen.findByRole('button', { name: 'Темна тема' });
  for (const title of ORDER) {
    await user.click((await sidebar()).getByRole('link', { name: title }));
    const section = await screen.findByRole('region', { name: title });
    expect(await settled(section, title)).toBeDefined();
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
