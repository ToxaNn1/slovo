import type { Mailer } from '@slovo/server-core';
import { createTransport } from 'nodemailer';

/**
 * Sends the emails over SMTP: to Mailpit locally (`compose.yaml`), to a real
 * provider from 0.9. `from` is the sender's address; the server Core names
 * the sender.
 */
export function createSmtpMailer({ url, from }: { url: string; from: string }): Mailer {
  const transport = createTransport(url);
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
