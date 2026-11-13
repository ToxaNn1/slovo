import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { silentLogger } from '../test-support';
import { createOwnerChat } from './owner-chat';
import { createTelegramBot } from './telegram-bot';

const OWNER = '123456';

/** A Telegram bot over a fetch that keeps every request and answers `status`. */
function bot(status = 200) {
  const requests: { url: string; body: unknown }[] = [];
  const telegram = createTelegramBot({
    token: 'test-token',
    chatId: OWNER,
    fetch: (url, init) => {
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      requests.push({ url: url instanceof URL ? url.href : 'not a URL', body });
      return Promise.resolve(new Response('{}', { status }));
    },
  });
  return { telegram, requests };
}

describe('the Telegram bot', () => {
  it('never lets a message to another chat leave', async () => {
    const { telegram, requests } = bot();
    expect(await telegram.sendMessage('654321', 'hello')).toBe('refused');
    expect(await telegram.sendMessage(`${OWNER}0`, 'hello')).toBe('refused');
    expect(requests).toEqual([]);
  });

  it("sends to the owner's chat, and answers failed when Telegram refuses", async () => {
    const ok = bot();
    expect(await ok.telegram.sendMessage(OWNER, 'hello')).toBe('sent');
    expect(ok.requests).toEqual([
      {
        url: 'https://api.telegram.org/bottest-token/sendMessage',
        body: { chat_id: OWNER, text: 'hello' },
      },
    ]);
    expect(await bot(500).telegram.sendMessage(OWNER, 'hello')).toBe('failed');
  });

  it("sends the owner chat's messages to the configured chat alone", async () => {
    const { telegram, requests } = bot();
    const chat = createOwnerChat({ telegram, chatId: OWNER }, silentLogger);
    expect(await chat.send({ kind: 'alert', alert: { kind: 'backend-down' } })).toBe(true);
    expect(requests).toEqual([
      {
        url: 'https://api.telegram.org/bottest-token/sendMessage',
        body: { chat_id: OWNER, text: '🚨 Бекенд не відповідає на перевірку здоров’я.' },
      },
    ]);
    const astray = createOwnerChat({ telegram, chatId: '654321' }, silentLogger);
    expect(await astray.send({ kind: 'alert', alert: { kind: 'backend-down' } })).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it("logs only the alert's kind while the bot is not set up, never who turned a switch off", async () => {
    const lines: string[] = [];
    const chat = createOwnerChat(
      undefined,
      pino({}, { write: (line: string) => lines.push(line) }),
    );

    const sent = await chat.send({
      kind: 'alert',
      alert: {
        kind: 'kill-switch',
        feature: 'sync',
        editionIds: ['uk'],
        who: { kind: 'admin-user', email: 'owner@example.com' },
        reason: 'a broken release',
      },
    });

    expect(sent).toBe(false);
    expect(lines.join('')).toContain('kill-switch');
    expect(lines.join('')).not.toContain('owner@example.com');
    expect(lines.join('')).not.toContain('a broken release');
  });
});
