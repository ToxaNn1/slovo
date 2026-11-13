import { describe, expect, it } from 'vitest';

import { ServerConfigSchema } from '../config';
import { createMailer } from './mailer';

const CODE_EMAIL = {
  to: 'reader@example.com',
  senderName: 'Slovo',
  subject: 'Your sign-in code',
  text: 'Your sign-in code: 482913',
};

interface Sent {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

/** A fetch that keeps every request and answers each with `answer`. */
function endpoint(answer: () => Response) {
  const sent: Sent[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    sent.push({
      url: typeof input === 'string' ? input : 'not a string URL',
      method: init?.method,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });
    return Promise.resolve(answer());
  };
  return { fetch, sent };
}

const TOKEN = 'a-send-mail-token';

function zeptoMail(answer: () => Response) {
  const api = endpoint(answer);
  const mailer = createMailer(
    {
      kind: 'zeptomail',
      apiUrl: 'https://api.zeptomail.eu/v1.1/email',
      token: TOKEN,
      from: 'codes@slovo.test',
    },
    api.fetch,
  );
  return { mailer, sent: api.sent };
}

describe('the ZeptoMail client', () => {
  it('posts the code email from the configured sender, with the Send Mail token', async () => {
    const { mailer, sent } = zeptoMail(() => Response.json({ data: [] }, { status: 201 }));

    await mailer.send(CODE_EMAIL);

    expect(sent).toEqual([
      {
        url: 'https://api.zeptomail.eu/v1.1/email',
        method: 'POST',
        headers: {
          authorization: `Zoho-enczapikey ${TOKEN}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: {
          from: { address: 'codes@slovo.test', name: 'Slovo' },
          to: [{ email_address: { address: 'reader@example.com' } }],
          subject: 'Your sign-in code',
          textbody: 'Your sign-in code: 482913',
        },
      },
    ]);
  });

  it("names ZeptoMail's status and error codes when it refuses, never the token or the address", async () => {
    const { mailer } = zeptoMail(() =>
      Response.json(
        {
          error: {
            code: 'TM_4001',
            details: [{ code: 'SERR_157', message: 'Invalid API Token found', target: 'to' }],
            message: 'Access Denied reader@example.com',
          },
        },
        { status: 401 },
      ),
    );

    const failure = await mailer.send(CODE_EMAIL).then(
      () => new Error('sent'),
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    const message = failure instanceof Error ? failure.message : '';
    expect(message).toBe('the email was not sent (ZeptoMail 401 TM_4001 SERR_157)');
    expect(message).not.toContain(TOKEN);
    expect(message).not.toContain('reader@example.com');
  });

  it('names the status alone when the refusal has no error body', async () => {
    const { mailer } = zeptoMail(() => new Response('Bad Gateway', { status: 502 }));

    await expect(mailer.send(CODE_EMAIL)).rejects.toThrow(
      /^the email was not sent \(ZeptoMail 502\)$/,
    );
  });

  it('fails when ZeptoMail is unreachable', async () => {
    const mailer = createMailer(
      {
        kind: 'zeptomail',
        apiUrl: 'https://api.zeptomail.eu/v1.1/email',
        token: TOKEN,
        from: 'a@b.c',
      },
      () => Promise.reject(new TypeError('fetch failed')),
    );

    await expect(mailer.send(CODE_EMAIL)).rejects.toThrow(
      'the email was not sent (ZeptoMail unreachable)',
    );
  });
});

describe('the Mailpit client', () => {
  it("posts the code email to Mailpit's send API, from the configured sender", async () => {
    const api = endpoint(() => Response.json({ ID: 'x' }));
    const mailer = createMailer(
      { kind: 'mailpit', url: 'http://localhost:8025', from: 'codes@slovo.test' },
      api.fetch,
    );

    await mailer.send(CODE_EMAIL);

    expect(api.sent).toEqual([
      {
        url: 'http://localhost:8025/api/v1/send',
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: {
          From: { Email: 'codes@slovo.test', Name: 'Slovo' },
          To: [{ Email: 'reader@example.com' }],
          Subject: 'Your sign-in code',
          Text: 'Your sign-in code: 482913',
        },
      },
    ]);
  });

  it('fails when Mailpit refuses', async () => {
    const mailer = createMailer(
      { kind: 'mailpit', url: 'http://localhost:8025', from: 'codes@slovo.test' },
      () => Promise.resolve(new Response('no', { status: 400 })),
    );

    await expect(mailer.send(CODE_EMAIL)).rejects.toThrow('the email was not sent (Mailpit 400)');
  });
});

describe('the mail transport of the environment', () => {
  const env = {
    DATABASE_URL: 'postgres://slovo:slovo@localhost:55432/slovo',
    AUTH_SECRET: 'a-test-secret-that-is-at-least-32-characters',
  };

  it("is ZeptoMail's EU data centre with a token", () => {
    const { mail } = ServerConfigSchema.parse({
      ...env,
      ZEPTOMAIL_TOKEN: TOKEN,
      MAIL_FROM: 'codes@slovo.test',
    });

    expect(mail).toEqual({
      kind: 'zeptomail',
      apiUrl: 'https://api.zeptomail.eu/v1.1/email',
      token: TOKEN,
      from: 'codes@slovo.test',
    });
  });

  it('is the local Mailpit without one, as .env.example gives it', () => {
    const { mail } = ServerConfigSchema.parse({ ...env, ZEPTOMAIL_TOKEN: '' });

    expect(mail).toEqual({
      kind: 'mailpit',
      url: 'http://localhost:8025',
      from: 'no-reply@slovo.app',
    });
  });
});
