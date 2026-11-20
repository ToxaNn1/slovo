---
summary: Who may call each admin procedure (Власник, Адмін, Агент, CI, sign-in) and whether it reads or writes is declared once in the backend table `ADMISSION`, typed over the admin contract so a procedure without one does not compile; one middleware admits every call before its input is read, and handlers only read the caller from the context.
---

# Admin admission is declared once per procedure

Decision of 2026-11-19 (ticket #2054, spec #2049). It refines ADR 0088, 0096 and 0164; their rules on who may call what are unchanged.

**Why.** Each admin handler chose one of seven admission helpers with flags of opposite defaults. A write without the admin header compiled, and no test walked the contract.

## Decision

- `apps/backend/src/admin/admission.ts` holds `ADMISSION`: one entry per procedure of `apiContract.admin`, typed as a mapped type over it. An entry names its callers (`owner`, `owner`+`admin`, `owner`+`admin`+`agent`, `ci` or `sign-in`) and `read` or `write`. It lives in the backend, not the contract: only the backend reads it.
- One middleware on the admin router admits every call by the entry of its path, before the input is read, and puts the caller in the context. Handlers choose no admission.
- The order of refusals: 404 while no Власник exists; CI by its token (401); a write that no Агент may call needs the admin header first (403); then a Bearer token (an unknown one 401, an Агент not declared 403), the session (401), the role (403); a write an Агент may call asks the header of an admin session after it.
- `admission.test.ts` walks the contract through `testApp`: no session, a write without the header, a caller left out.

## Consequences

- An unadmitted call is refused before its input is validated: it answers 401/403/404 where an invalid input answered 400 before.
- `content.check`, `checkAll` and `addOtherVoices` declare no Агент, so the header comes first: a call with neither a session nor the header answers 403 where it answered 401.
