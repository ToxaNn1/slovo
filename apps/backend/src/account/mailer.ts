import type { Mail, Mailer } from '@slovo/server-core';
import { z } from 'zod';

/**
 * Where the backend sends its emails, from the environment (`config.ts`,
 * ADR 0115): ZeptoMail's HTTPS API in the Deployment, Mailpit's send API on
 * a developer's machine (`compose.yaml`).
 */
export type MailTransport =
  | {
      readonly kind: 'zeptomail';
      /** The email endpoint of ZeptoMail's API, such as https://api.zeptomail.eu/v1.1/email. */
      readonly apiUrl: string;
      /** The Send Mail token of the ZeptoMail Agent. */
      readonly token: string;
      /** The sender's address; the server Core names the sender. */
      readonly from: string;
    }
  | {
      readonly kind: 'mailpit';
      /** Mailpit's web address, such as http://localhost:8025. */
      readonly url: string;
      readonly from: string;
    };

/** The codes of a refusal from ZeptoMail; its messages may name the address. */
const ZeptoMailRefusalSchema = z.object({
  error: z.object({
    code: z.string(),
    details: z.array(z.object({ code: z.string() })).default([]),
  }),
});

/** The request that sends `mail` over the transport. */
function requestOf(transport: MailTransport, { to, senderName, subject, text }: Mail) {
  const json = { 'content-type': 'application/json', accept: 'application/json' };
  return transport.kind === 'zeptomail'
    ? {
        url: transport.apiUrl,
        headers: { ...json, authorization: `Zoho-enczapikey ${transport.token}` },
        body: {
          from: { address: transport.from, name: senderName },
          to: [{ email_address: { address: to } }],
          subject,
          textbody: text,
        },
      }
    : {
        url: new URL('/api/v1/send', transport.url).href,
        headers: json,
        body: {
          From: { Email: transport.from, Name: senderName },
          To: [{ Email: to }],
          Subject: subject,
          Text: text,
        },
      };
}

/** What the error of a refused email names: the status and ZeptoMail's codes, never the address. */
async function refusalOf(name: string, response: Response): Promise<string> {
  const refusal = ZeptoMailRefusalSchema.safeParse(await response.json().catch(() => null));
  const codes = refusal.success
    ? [refusal.data.error.code, ...refusal.data.error.details.map((detail) => detail.code)]
    : [];
  return [name, String(response.status), ...codes].join(' ');
}

/**
 * Sends the emails over HTTPS to ZeptoMail, or to Mailpit locally. Railway
 * blocks outbound SMTP, so no email goes over SMTP (ADR 0115). An error names
 * the service's status and codes alone: never the token, never the address.
 */
export function createMailer(
  transport: MailTransport,
  fetchWith: typeof globalThis.fetch = fetch,
): Mailer {
  return {
    async send(mail) {
      const { url, headers, body } = requestOf(transport, mail);
      const name = transport.kind === 'zeptomail' ? 'ZeptoMail' : 'Mailpit';
      const response = await fetchWith(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }).catch((error: unknown) => {
        throw new Error(`the email was not sent (${name} unreachable)`, { cause: error });
      });
      if (!response.ok) {
        throw new Error(`the email was not sent (${await refusalOf(name, response)})`);
      }
    },
  };
}
