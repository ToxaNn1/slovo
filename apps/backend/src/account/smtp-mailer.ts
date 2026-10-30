import type { Mailer } from '@slovo/server-core';
import { createTransport } from 'nodemailer';

/** Where and how the SMTP client sends, from the environment (`config.ts`). */
export interface SmtpOptions {
  readonly host: string;
  readonly port: number;
  /** TLS from the first byte; otherwise STARTTLS when the server offers it. */
  readonly tls: boolean;
  readonly credentials: { readonly user: string; readonly password: string } | undefined;
  /** The sender's address; the server Core names the sender. */
  readonly from: string;
}

/**
 * Sends the emails over SMTP: to Mailpit locally (`compose.yaml`), to a real
 * provider in production.
 */
export function createSmtpMailer({ host, port, tls, credentials, from }: SmtpOptions): Mailer {
  const transport = createTransport({
    host,
    port,
    secure: tls,
    auth: credentials && { user: credentials.user, pass: credentials.password },
  });
  return {
    async send({ to, senderName, subject, text }) {
      try {
        await transport.sendMail({ from: { name: senderName, address: from }, to, subject, text });
      } catch (error) {
        // The SMTP server's answer may name the address, which a log never
        // shows, so the error keeps only its reply code and no cause.
        const reply = (error as { responseCode?: number }).responseCode;
        // eslint-disable-next-line preserve-caught-error -- the cause holds the address
        throw new Error(`the email was not sent (SMTP ${String(reply ?? 'unreachable')})`);
      }
    },
  };
}
