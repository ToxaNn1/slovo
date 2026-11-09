import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { FIXTURES } from './mock/fixtures';
import { server } from './mock/server';
import { Admin } from './router';

/** The admin API's refusal as the backend answers it. */
const refusal = (status: number, code: string, data?: object) =>
  HttpResponse.json({ defined: true, code, status, message: code, data }, { status });

/** A backend with no session until a sign-in succeeds; the bodies it was sent, in order. */
function signedOut(role: 'owner' | 'admin' = 'owner') {
  let signedIn = false;
  const bodies: unknown[] = [];
  const me = { email: `${role}@example.com`, role };
  server.use(
    http.get('*/admin/me', () => (signedIn ? HttpResponse.json(me) : refusal(401, 'UNAUTHORIZED'))),
    http.post('*/admin/sign-in/code', async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({ sent: true });
    }),
    http.post('*/admin/sign-in/code/verify', async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(FIXTURES.verifyCode);
    }),
    http.post('*/admin/sign-in', async ({ request }) => {
      bodies.push(await request.json());
      signedIn = true;
      return HttpResponse.json(me);
    }),
    http.post('*/admin/sessions/sign-out', () => {
      signedIn = false;
      return HttpResponse.json({ signedOut: true });
    }),
  );
  return bodies;
}

/** The step the sign-in's step bar marks as the current one. */
function currentStep() {
  const steps = within(screen.getByRole('list', { name: 'Кроки входу' })).getAllByRole('listitem');
  return steps.find((step) => step.getAttribute('aria-current') === 'step')?.textContent;
}

async function typeInto(label: string, text: string, button: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(label), text);
  await user.click(screen.getByRole('button', { name: button }));
}

test('without a session the admin signs in by the emailed code and a TOTP it sets up', async () => {
  const bodies = signedOut();
  render(<Admin />);

  expect(await screen.findByRole('heading', { name: 'Увійти' })).toBeDefined();
  expect(currentStep()).toBe('Email');
  expect(screen.queryByRole('navigation', { name: 'Розділи' })).toBeNull();
  await typeInto('Пошта', 'owner@example.com', 'Надіслати код');
  expect(await screen.findByRole('heading', { name: 'Код з листа' })).toBeDefined();
  expect(currentStep()).toBe('Код з листа');
  await typeInto('Код із листа', '123456', 'Далі');
  expect(await screen.findByRole('heading', { name: 'Налаштуйте TOTP' })).toBeDefined();
  expect(currentStep()).toBe('Коди');
  expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeDefined();
  const codes = within(screen.getByRole('list', { name: 'Коди відновлення' }));
  expect(codes.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'k7Qm2xPa',
    'Zr4tLw9e',
  ]);
  await typeInto('Код із застосунку', '654321', 'Увійти');

  expect(await screen.findByRole('navigation', { name: 'Розділи' })).toBeDefined();
  expect(bodies).toEqual([
    { email: 'owner@example.com' },
    { email: 'owner@example.com', code: '123456' },
    {
      email: 'owner@example.com',
      code: '123456',
      factor: { kind: 'totp', totp: '654321' },
    },
  ]);
});

test('a wrong code shows the attempts left, and a blocked email when to try again', async () => {
  signedOut();
  let attemptsLeft = 2;
  server.use(
    http.post('*/admin/sign-in/code/verify', () =>
      attemptsLeft > 0
        ? refusal(401, 'UNAUTHORIZED', { attemptsLeft: attemptsLeft-- })
        : refusal(429, 'TOO_MANY_REQUESTS', { retryAfterSeconds: 900 }),
    ),
  );
  render(<Admin />);
  await typeInto('Пошта', 'owner@example.com', 'Надіслати код');

  await typeInto('Код із листа', '000000', 'Далі');
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Код неправильний або застарів. Спроб лишилося: 2.',
  );
  await typeInto('Код із листа', '0', 'Далі');
  await typeInto('Код із листа', '0', 'Далі');
  expect(await screen.findByText('Забагато невдалих спроб. Спробуйте за 15 хв.')).toBeDefined();
});

test('an Адмін has no Безпека in the sidebar, and its page stays closed', async () => {
  server.use(
    http.get('*/admin/me', () => HttpResponse.json({ email: 'a@example.com', role: 'admin' })),
  );
  window.history.replaceState(null, '', '/admin/security');
  render(<Admin />);

  const sidebar = within(await screen.findByRole('navigation', { name: 'Розділи' }));
  expect(sidebar.getAllByRole('link').map((link) => link.textContent)).not.toContain('Безпека');
  expect(await screen.findByText('Безпека відкрита лише Власнику.')).toBeDefined();
});

test('«Мої сесії» lists the sessions, and «Вийти всюди» goes back to the sign-in', async () => {
  signedOut();
  render(<Admin />);
  await typeInto('Пошта', 'owner@example.com', 'Надіслати код');
  await typeInto('Код із листа', '123456', 'Далі');
  await typeInto('Код із застосунку', '654321', 'Увійти');
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'owner@example.com Власник' }));
  await user.click(screen.getByRole('link', { name: 'Мої сесії' }));
  const sessions = within(await screen.findByRole('list', { name: 'Сесії' }));
  expect(sessions.getAllByRole('listitem')).toHaveLength(2);
  expect(sessions.getByText(/ця сесія/)).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Вийти всюди' }));

  expect(await screen.findByRole('heading', { name: 'Увійти' })).toBeDefined();
});

test('a backend that fails to answer who is signed in offers to try again', async () => {
  let failing = true;
  server.use(
    http.get('*/admin/me', () =>
      failing
        ? refusal(502, 'INTERNAL_SERVER_ERROR')
        : HttpResponse.json({ email: 'owner@example.com', role: 'owner' }),
    ),
  );
  const user = userEvent.setup();
  render(<Admin />);

  expect(await screen.findByText('Не вдалося. Спробуйте ще раз.')).toBeDefined();
  failing = false;
  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

  expect(await screen.findByRole('navigation', { name: 'Розділи' })).toBeDefined();
  expect(screen.queryByText('Не вдалося. Спробуйте ще раз.')).toBeNull();
});
