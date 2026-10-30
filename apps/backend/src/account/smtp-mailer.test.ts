import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer, type AddressInfo, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tls from 'node:tls';

import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';

import { createSmtpMailer } from './smtp-mailer';

/** What a fake SMTP server received in one email. */
interface Received {
  readonly encrypted: boolean;
  readonly login: string | undefined;
  readonly envelopeFrom: string;
  readonly envelopeTo: string;
  readonly message: string;
}

/**
 * Speaks just enough SMTP to take one email per connection and keep what it
 * got: a plain server, or one that speaks TLS from the first byte.
 */
async function startFakeSmtpServer(tlsOptions?: tls.TlsOptions) {
  const received: Received[] = [];
  const onConnection = (socket: Socket) => {
    const encrypted = socket instanceof tls.TLSSocket;
    let login: string | undefined;
    let envelopeFrom = '';
    let envelopeTo = '';
    let message: string[] | undefined;
    let pending = '';
    socket.setEncoding('utf8');
    socket.write('220 fake ESMTP\r\n');
    socket.on('data', (chunk: string) => {
      pending += chunk;
      let end = pending.indexOf('\r\n');
      while (end !== -1) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        end = pending.indexOf('\r\n');
        if (message !== undefined) {
          if (line !== '.') {
            message.push(line);
            continue;
          }
          received.push({
            encrypted,
            login,
            envelopeFrom,
            envelopeTo,
            message: message.join('\n'),
          });
          message = undefined;
          socket.write('250 queued\r\n');
        } else if (/^(EHLO|HELO) /.test(line)) {
          socket.write('250-fake\r\n250 AUTH PLAIN\r\n');
        } else if (line.startsWith('AUTH PLAIN ')) {
          login = Buffer.from(line.slice('AUTH PLAIN '.length), 'base64').toString();
          socket.write('235 accepted\r\n');
        } else if (line.startsWith('MAIL FROM:')) {
          envelopeFrom = line;
          socket.write('250 ok\r\n');
        } else if (line.startsWith('RCPT TO:')) {
          envelopeTo = line;
          socket.write('250 ok\r\n');
        } else if (line === 'DATA') {
          message = [];
          socket.write('354 go on\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 bye\r\n');
        } else {
          socket.write('250 ok\r\n');
        }
      }
    });
  };
  const server: Server =
    tlsOptions === undefined
      ? createServer(onConnection)
      : tls.createServer(tlsOptions, onConnection);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  onTestFinished(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  );
  return { port: (server.address() as AddressInfo).port, received };
}

/** A certificate for 127.0.0.1 made for this file alone, which the process trusts. */
let certificate: { key: string; cert: string };
const defaultCertificates = tls.getCACertificates('default');

beforeAll(() => {
  const folder = mkdtempSync(join(tmpdir(), 'smtp-mailer-'));
  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    '/CN=127.0.0.1',
    '-addext',
    'subjectAltName=IP:127.0.0.1',
    '-keyout',
    join(folder, 'key.pem'),
    '-out',
    join(folder, 'cert.pem'),
  ]);
  certificate = {
    key: readFileSync(join(folder, 'key.pem'), 'utf8'),
    cert: readFileSync(join(folder, 'cert.pem'), 'utf8'),
  };
  tls.setDefaultCACertificates([...defaultCertificates, certificate.cert]);
});

afterAll(() => {
  tls.setDefaultCACertificates(defaultCertificates);
});

const CODE_EMAIL = {
  to: 'reader@example.com',
  senderName: 'Slovo',
  subject: 'Your sign-in code',
  text: 'Your sign-in code: 482913',
};

describe('the SMTP client', () => {
  it('delivers the code email from the configured sender, in the clear when TLS is off', async () => {
    const server = await startFakeSmtpServer();
    const mailer = createSmtpMailer({
      host: '127.0.0.1',
      port: server.port,
      tls: false,
      credentials: undefined,
      from: 'codes@slovo.test',
    });

    await mailer.send(CODE_EMAIL);

    expect(server.received).toHaveLength(1);
    const [email] = server.received;
    expect(email?.encrypted).toBe(false);
    expect(email?.envelopeFrom).toBe('MAIL FROM:<codes@slovo.test>');
    expect(email?.envelopeTo).toBe('RCPT TO:<reader@example.com>');
    expect(email?.message).toMatch(/^From: Slovo <codes@slovo\.test>$/m);
    expect(email?.message).toContain('Your sign-in code: 482913');
  });

  it('delivers the code email over TLS with the configured credentials when TLS is on', async () => {
    const server = await startFakeSmtpServer(certificate);
    const mailer = createSmtpMailer({
      host: '127.0.0.1',
      port: server.port,
      tls: true,
      credentials: { user: 'slovo', password: 'a-password' },
      from: 'codes@slovo.test',
    });

    await mailer.send(CODE_EMAIL);

    expect(server.received).toHaveLength(1);
    const [email] = server.received;
    expect(email?.encrypted).toBe(true);
    expect(email?.login).toBe('\0slovo\0a-password');
    expect(email?.envelopeFrom).toBe('MAIL FROM:<codes@slovo.test>');
    expect(email?.message).toMatch(/^From: Slovo <codes@slovo\.test>$/m);
    expect(email?.message).toContain('Your sign-in code: 482913');
  });

  it('sends nothing to a server that does not speak TLS when TLS is on', async () => {
    const server = await startFakeSmtpServer();
    const mailer = createSmtpMailer({
      host: '127.0.0.1',
      port: server.port,
      tls: true,
      credentials: undefined,
      from: 'codes@slovo.test',
    });

    await expect(mailer.send(CODE_EMAIL)).rejects.toThrow('the email was not sent');
    expect(server.received).toHaveLength(0);
  });
});
