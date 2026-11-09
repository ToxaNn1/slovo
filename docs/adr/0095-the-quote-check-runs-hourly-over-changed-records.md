# The quote check runs hourly over changed records

Owner defaults of 2026-11-08 (ticket #1721, spec #1708). ADR 0090 moves `pnpm content verify` (ADR 0084) into a background job on the Deployment; this records how. It amends ADR 0084 and 0090.

**Decision.** The job checks the quoted text of Words, Corrections, Idioms, Synonym Rows and Tips against their first source's page, never Literary Uses. A record is unverified while its record version has no check: every write other than an import raises it. Imported records count as checked, since CI verified them; a record with no source page is not checked and counts neither unverified nor failed. The job runs hourly (`0 * * * *`, UTC) as a Railway Cron service, `pnpm quote-check` on the backend image. Fetched pages stay in the Postgres sourcing cache for 30 days. A quote not found is flagged for the Content queue with the finding by the command `quote-check`; the record stays live. A page that cannot be fetched leaves the record for the next run.

**Consequences.** The matching lives in `@slovo/content-rules`, shared by `verify` and the backend. The admin content report carries `quoteCheck: {unverified, failed}`.
