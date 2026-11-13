# Backend mail goes over the ZeptoMail HTTPS API

Owner decision of 2026-11-13 (ticket #1796). ADR 0063 sent the Sign-in codes over SMTP with the owner's credentials. Railway's Hobby plan blocks every outbound SMTP port (25, 465, 587 and 2525), so a backend on Railway cannot reach any SMTP server, and no Sign-in code leaves.

**Decision.** The backend sends its emails over HTTPS to ZeptoMail, Zoho's transactional mail service, in its EU data centre. No email goes over SMTP.

- **One client, two transports.** `apps/backend/src/account/mailer.ts` implements the `Mailer` port with `fetch`. With `ZEPTOMAIL_TOKEN` set it posts each email as JSON to `ZEPTOMAIL_API_URL` (default `https://api.zeptomail.eu/v1.1/email`, `https://` only) with `Authorization: Zoho-enczapikey <token>`, the Send Mail token of the sending domain's Mail Agent. Without the token it posts to Mailpit's send API at `MAILPIT_URL` (default `http://localhost:8025`), so a local backend, CI and the Maestro flows keep reading the codes in Mailpit. `MAIL_FROM` names the sender's address either way.
- **Production needs ZeptoMail.** With `NODE_ENV=production` the server refuses to start without `ZEPTOMAIL_TOKEN` and `MAIL_FROM`, naming each, so a Deployment never sends to a Mailpit that is not there.
- **No secret in an error.** A refused email throws an error that names the service's HTTP status and ZeptoMail's error codes (`TM_4001 SERR_157`), never the token and never ZeptoMail's messages, which may name the address.
- **The repository holds no token.** It lives in the Railway variables of the backend; `.railway/railway.ts` preserves `ZEPTOMAIL_API_URL` and `ZEPTOMAIL_TOKEN`.

**Testing.** The mail client against a fake `fetch`: the request ZeptoMail and Mailpit get, and the error of a refusal. The configuration through `ServerConfigSchema` and the server's start. A Sign-in code in a real inbox stays the owner's check.

## Considered Options

- **A paid Railway plan, which opens SMTP.** It costs every month for one port; the HTTPS API works on any host.
- **Another provider's API (Resend, Postmark, SES).** The owner's Zoho Mail Lite plan already includes ZeptoMail credits, the domain is verified at Zoho (SPF, DKIM, DMARC), and ZeptoMail's EU data centre keeps the readers' addresses in the EU.
- **Keep SMTP for Mailpit locally.** Two transports over two protocols, and nodemailer kept for development alone; Mailpit's send API takes the same JSON-over-HTTP path.

## Consequences

- nodemailer and the `SMTP_*` variables are gone; `MAILPIT_URL` moves a local Mailpit.
- Changing providers changes code: one more transport in `mailer.ts`.
- ZeptoMail's credits run out; the owner watches them in ZeptoMail.
