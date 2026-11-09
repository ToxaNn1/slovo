import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { FIXTURES } from './mock/fixtures';
import { server } from './mock/server';
import { Admin } from './router';

const ISSUED = FIXTURES.issueAgentToken;

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/security');
});

/** A backend that lists the issued token by name once it is issued; the bodies of the writes. */
function backend() {
  let issued = false;
  const bodies: unknown[] = [];
  server.use(
    http.get('*/admin/agent-tokens', () =>
      HttpResponse.json({
        tokens: [
          ...FIXTURES.agentTokens.tokens,
          ...(issued
            ? [{ name: ISSUED.name, createdAt: '2026-11-08T10:00:00.000Z', revokedAt: null }]
            : []),
        ],
      }),
    ),
    http.post('*/admin/agent-tokens', async ({ request }) => {
      bodies.push(await request.json());
      issued = true;
      return HttpResponse.json(ISSUED);
    }),
  );
  return bodies;
}

/** Confirms the open write: its button is disabled until a reason is typed. */
async function confirmWith(reason: string, button: string) {
  const user = userEvent.setup();
  const dialog = within(await screen.findByRole('dialog'));
  const confirm = dialog.getByRole('button', { name: button });
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByLabelText('Причина'), '   ');
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByLabelText('Причина'), reason);
  expect(confirm).toHaveProperty('disabled', false);
  await user.click(confirm);
}

test('an issued Агент token is shown once, then only by its name', async () => {
  const bodies = backend();
  const user = userEvent.setup();
  render(<Admin />);
  const tokens = within(await screen.findByRole('region', { name: 'Токени Агентів' }));

  await user.type(tokens.getByLabelText('Назва Агента'), ISSUED.name);
  await user.click(tokens.getByRole('button', { name: 'Видати токен' }));
  await confirmWith('content batches', 'Видати токен');

  expect(await tokens.findByText(ISSUED.token)).toBeDefined();
  expect(bodies).toEqual([{ name: ISSUED.name, reason: 'content batches' }]);
  await user.click(tokens.getByRole('button', { name: 'Закрити' }));

  const list = within(tokens.getByRole('list', { name: 'Токени' }));
  expect(await list.findByText(new RegExp(ISSUED.name))).toBeDefined();
  expect(screen.queryByText(ISSUED.token)).toBeNull();
  expect(document.body.textContent).not.toContain(ISSUED.token);
});

test('every write opens the confirmation, its button disabled until a reason is typed', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const people = within(await screen.findByRole('region', { name: 'Люди і доступ' }));
  const tokens = within(screen.getByRole('region', { name: 'Токени Агентів' }));
  await people.findByText(/editor@example.com/);

  await user.type(people.getByLabelText('Пошта'), 'new@example.com');
  await user.click(people.getByRole('button', { name: 'Запросити' }));
  await confirmWith('a new editor', 'Запросити');

  await user.click(people.getByRole('button', { name: 'Зробити Власником' }));
  await confirmWith('trusted', 'Змінити роль');

  await user.click(people.getByRole('button', { name: 'Забрати доступ' }));
  await confirmWith('left', 'Забрати доступ');

  await user.click(await tokens.findByRole('button', { name: 'Відкликати' }));
  await confirmWith('leaked', 'Відкликати');

  await user.type(tokens.getByLabelText('Назва Агента'), 'claude-next');
  await user.click(tokens.getByRole('button', { name: 'Видати токен' }));
  await confirmWith('batches', 'Видати токен');

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

test('an alert threshold changes only with a reason, and shows its default', async () => {
  const bodies: unknown[] = [];
  server.use(
    http.post('*/admin/alert-thresholds/:key', async ({ params, request }) => {
      bodies.push({ key: params['key'], ...Object(await request.json()) });
      return HttpResponse.json(FIXTURES.setAlertThreshold);
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const thresholds = within(await screen.findByRole('region', { name: 'Пороги сповіщень' }));
  const crashFree = within(
    await thresholds.findByRole('form', { name: 'Поріг: Сесії без падінь, %' }),
  );
  const value = crashFree.getByLabelText('Сесії без падінь, %');

  expect(value).toHaveProperty('value', '99');
  expect(crashFree.getByText('Типово 99,5')).toBeDefined();
  await user.clear(value);
  await user.type(value, '99.5');
  await user.click(crashFree.getByRole('button', { name: 'Змінити поріг' }));
  expect(bodies).toEqual([]);
  await confirmWith('too noisy', 'Змінити поріг');

  await waitFor(() => {
    expect(bodies).toEqual([{ key: 'crashFree', value: 99.5, reason: 'too noisy' }]);
  });
});

test('the Action log names its author, with the same texts in both Themes', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const log = within(await screen.findByRole('region', { name: 'Журнал дій' }));

  expect(await log.findByText('команда switches off')).toBeDefined();
  expect(log.getByText('the Game loses scores')).toBeDefined();
  const section = screen.getByRole('region', { name: 'Безпека' });
  const light = section.textContent;
  await user.click(screen.getByRole('button', { name: 'Темна тема' }));
  expect(document.documentElement.dataset['theme']).toBe('dark');
  expect(screen.getByRole('region', { name: 'Безпека' }).textContent).toBe(light);
  await user.click(screen.getByRole('button', { name: 'Темна тема' }));
});

test('a write keeps its confirmation open until it ends, and a refusal stays in it', async () => {
  let answer: (response: Response) => void = () => undefined;
  const writes: unknown[] = [];
  server.use(
    http.post('*/admin/agent-tokens', async ({ request }) => {
      writes.push(await request.json());
      return new Promise<Response>((resolve) => {
        answer = resolve;
      });
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const tokens = within(await screen.findByRole('region', { name: 'Токени Агентів' }));

  await user.type(tokens.getByLabelText('Назва Агента'), 'claude-next');
  await user.click(tokens.getByRole('button', { name: 'Видати токен' }));
  await confirmWith('batches', 'Видати токен');

  const dialog = within(screen.getByRole('dialog'));
  await waitFor(() => {
    expect(writes).toHaveLength(1);
  });
  expect(dialog.getByRole('button', { name: 'Видати токен' })).toHaveProperty('disabled', true);
  answer(
    HttpResponse.json(
      {
        defined: true,
        code: 'CONFLICT',
        status: 409,
        message: 'CONFLICT',
        data: { refusal: 'name-taken' },
      },
      { status: 409 },
    ),
  );

  expect(await dialog.findByText('Цю назву вже видано; оберіть іншу.')).toBeDefined();
  expect(screen.getByRole('dialog')).toBeDefined();
  expect(writes).toHaveLength(1);
});
