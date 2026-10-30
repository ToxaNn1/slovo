# The API only grows within a version

The app talks to the backend (ADR 0003, 0030). An app in the field updates late: a reader may run a build from months ago, and an old build can't be fixed from the server. So a change of the API that an old app doesn't understand breaks a reader's app, not a test.

The API is described once, as a contract-first oRPC contract in `packages/contracts` (`apiContract`, built with oRPC's contract builder and Zod). It has its own entry point, `@slovo/contracts/api`, as the Language Pack's Edition reader has (ADR 0035), so what loads the package's main entry alone, such as the Language Pack build, never loads oRPC. The backend implements it and serves it through oRPC's OpenAPI handler: every procedure has a readable REST address, and the generated OpenAPI description is at `/docs`. The Core calls it through `createApiClient`, the client built from the same contract, which the app builds for it as its one Backend port (ADR 0064), as the backend's tests do; the Core, and the UI over it, load the client this way and never the server. Neither side depends on the other, and a mismatch fails typecheck. The contract has one router per domain (`account`, `content`, `edition`, `sync`).

Within a version the contract only grows:

- **The version is in the address.** Every procedure lives under `/v1`, the contract's prefix.
- **Additive changes only.** Within `/v1` the contract gains procedures, optional input fields and output fields. Nothing is removed or renamed, nothing optional becomes required, no type narrows, and no error code changes meaning or leaves a procedure that could answer it.
- **A breaking change takes the next version.** It goes to `/v2`, a contract of its own, while the backend keeps serving `/v1` for as long as apps in the field call it.
- **Clients accept unknown fields.** The contract's output schemas are plain objects, never strict ones, and the app reads only the fields it knows, so an output can grow under an old app. Input schemas are strict: the backend refuses a field it doesn't know as `BAD_REQUEST`, so a typo never passes silently.
- **Errors are contract codes.** Every procedure lists the error codes it can answer (`BAD_REQUEST` on every procedure, its own beside it, such as `NOT_FOUND`). A failure the contract doesn't list is a bare `500 { code: "INTERNAL" }`, logged with its stack and request id, with nothing internal in the answer.

**A committed description holds the rule.** The description of `/v1` is committed as `packages/contracts/src/api/v1.openapi.json`, the record of what `/v1` has promised. `describeApi` (`@slovo/contracts/api-description`) builds it from `apiContract` alone, with no backend or database, and the backend serves the same one at `/docs`. A comparison with the promised description lists every change an app in the field would not understand: a procedure gone or moved; an output field gone, now possibly missing, or of a new kind, `null` included; an input field, parameter or body no longer accepted or newly required; an error code a procedure no longer answers, or whose status or data changes; a successful answer gone or new; a type or constraint that changes, save an input bound or enum that only widens and an output one that only narrows. Summaries, descriptions and a default in an answer change nothing. It knows what oRPC's generator writes: inline schemas, no `$ref`.

- **The contracts' tests** fail when the contract breaks the committed description, and when the committed description isn't the contract's, so an addition is recorded in the change that makes it.
- **`pnpm describe:api`** writes the contract's description over the committed one, and writes nothing and fails, listing the changes, when the contract breaks it.
- **CI** also runs it against the description on the pull request's base branch, so a description edited by hand to match a breaking change still fails.
- **The backend's tests** check that `/docs/openapi.json` is the contract's description.

## Considered Options

- **Hono routes with a hand-written client**: rejected. Two descriptions of one API drift, and the drift shows up in a reader's app.
- **oRPC's own RPC protocol** instead of its OpenAPI handler: rejected. The addresses would not be readable, and the API could not be tried with curl or read at `/docs`.
- **Version by header or by negotiating fields**: rejected. A version in the address is visible in every log line and every request, and `/v1` and `/v2` can be served side by side.
- **Strict output schemas**: rejected. An app would reject an answer the moment the backend added a field, which is exactly the change this ADR allows.
- **A general OpenAPI diff tool, such as oasdiff, in CI**: rejected. It is a binary outside the workspace that would run only in CI, while the check runs in the contracts' tests on every machine, is tested through oRPC's own generator, and lists its changes in the words of this ADR.
- **A snapshot test of the description**: rejected. It fails on an addition as on a removal, so updating it would hide a breaking change as easily as it records an addition.
