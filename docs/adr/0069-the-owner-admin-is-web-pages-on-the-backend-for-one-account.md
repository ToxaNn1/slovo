# The owner admin is web pages on the backend for one Account

The owner read the product's health with local scripts and turned a feature off with `pnpm switch:off` (ADR 0040). For 1.0 the backend serves a minimal web admin at `/admin` (#1388).

- **One Account.** `OWNER_EMAIL` names the one Account allowed in. Unset, the backend has no `/admin` at all (404): that is the admin's switch. The owner signs in with a Sign-in code (ADR 0030) sent in the language of the AppConfig's default Edition; any other email gets 403 and no code. The Session's token rides in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie on `/admin` only, and every page and form checks that the Session's Account is the owner's, so an app Session of another Account is refused with 403.
- **Remote switches.** Per Edition, every Feature Switch shows its effective value: a feature the Edition has on can be turned off, and a feature off remotely can be cleared. A feature the Edition has off shows «off in the Edition» with no control, and a clear for it is refused, so the admin never turns on what an Edition hasn't shipped (ADR 0040). It goes through the Edition registry's `switchOff` and `clearSwitch`, like the commands.
- **Summary.** Accounts (a count), the Community Counters summed per Edition, the questionnaire counters (ADR 0068), and links to PostHog and App Store Connect. Read live from the database at each page view. No list of Accounts.
- **Mistake Report inbox.** The kept reports, newest first, each with Resolve, which deletes it as `reports resolve` does (ADR 0056).
- **Look.** Server-rendered HTML with Hono, no styling and no client script; every value is escaped.

## Considered Options

- **A separate admin app or a hosted dashboard**: rejected. Another deploy and another sign-in for one person.
- **A role column on Accounts**: rejected. One owner needs no roles; an environment variable keeps the allow-list out of the database.
- **A Bearer token in local storage**: rejected. A cookie scoped to `/admin` with `SameSite=Strict` keeps the token from scripts and cross-site forms.
