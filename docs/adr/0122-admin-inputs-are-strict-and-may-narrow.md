# Admin inputs are strict and may narrow

ADR 0031 says every `/v1` input schema is strict, yet many admin procedures took plain objects, so a typo in a field passed silently, and the content writes took a reason of any length while every other admin write caps it at 500. Tightening them is a narrowing that ADR 0031 forbids within `/v1`. That rule exists because an app in the field updates late. The admin has no such caller: `apps/admin` is served built by the backend (ADR 0088), and the Агент tooling and CI's history push run from the same repository as the backend. The owner decided (13.11.2026, review items R125 and R165) to tighten them.

**The admin's inputs.** Every procedure under `/v1/admin/` takes a strict input (`z.strictObject`): the backend refuses an unknown field as `BAD_REQUEST`. Every admin reason, the content writes' included, is `ReasonSchema`: trimmed, 1 to 500 characters (optional where ADR 0088 makes it optional).

**May narrow.** The admin's request may change in any way within `/v1`: a field gone, newly required, or a bound or enum that narrows. The committed description still records it, and the breaking-change check skips the request of an admin path. An admin output is held as every other (ADR 0031): output schemas stay plain objects, and nothing is taken from an answer. This amends ADR 0031 for the admin routes only.

## Considered Options

- **Keep the admin inputs as they are**: rejected. A typo in an admin write passes silently, and a content reason may be longer than the Action log takes elsewhere.
- **Move the admin to `/v2`**: rejected. A second version for callers that always update with the backend.
- **Also let admin outputs change freely**: rejected. Not needed now, and the admin and a deployed backend may still differ for the minutes of a deploy.
