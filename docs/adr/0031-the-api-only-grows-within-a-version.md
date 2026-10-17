# The API only grows within a version

From 0.7 the app talks to the backend (ADR 0003, 0030). An app in the field updates late: a reader may run a build from months ago, and an old build can't be fixed from the server. So a change of the API that an old app doesn't understand breaks a reader's app, not a test.

The API is described once, as a contract-first oRPC contract in `packages/contracts` (`apiContract`, built with oRPC's contract builder and Zod). It has its own entry point, `@slovo/contracts/api`, as the Language Pack's Edition reader has (ADR 0035), so the Core and the UI, which load the package's main entry, never load oRPC. The backend implements it and serves it through oRPC's OpenAPI handler: every procedure has a readable REST address, and the generated OpenAPI description is at `/docs`. The app calls it through `createApiClient`, the client built from the same contract, as the backend's tests do. Neither side depends on the other, and a mismatch fails typecheck. The contract has one router per domain (`account`, `content`, `edition`), each added with its first procedure.

Within a version the contract only grows:

- **The version is in the address.** Every procedure lives under `/v1`, the contract's prefix.
- **Additive changes only.** Within `/v1` the contract gains procedures, optional input fields and output fields. Nothing is removed or renamed, nothing optional becomes required, no type narrows, and no error code changes meaning or leaves a procedure that could answer it.
- **A breaking change takes the next version.** It goes to `/v2`, a contract of its own, while the backend keeps serving `/v1` for as long as apps in the field call it.
- **Clients accept unknown fields.** The contract's output schemas are plain objects, never strict ones, and the app reads only the fields it knows, so an output can grow under an old app. Input schemas are strict: the backend refuses a field it doesn't know as `BAD_REQUEST`, so a typo never passes silently.
- **Errors are contract codes.** Every procedure lists the error codes it can answer (`BAD_REQUEST` on every procedure, its own beside it, such as `NOT_FOUND`). A failure the contract doesn't list is a bare `500 { code: "INTERNAL" }`, logged with its stack and request id, with nothing internal in the answer.

## Considered Options

- **Hono routes with a hand-written client**: rejected. Two descriptions of one API drift, and the drift shows up in a reader's app.
- **oRPC's own RPC protocol** instead of its OpenAPI handler: rejected. The addresses would not be readable, and the API could not be tried with curl or read at `/docs`.
- **Version by header or by negotiating fields**: rejected. A version in the address is visible in every log line and every request, and `/v1` and `/v2` can be served side by side.
- **Strict output schemas**: rejected. An app would reject an answer the moment the backend added a field, which is exactly the change this ADR allows.

## Amendment: the rule is held by a committed description of `/v1` (architecture review 2)

Until now nothing checked the rule: a field or an error code could leave `/v1` and CI stayed green. The description of `/v1` is now committed beside the contract, as `packages/contracts/src/api/v1.openapi.json`, and it is the record of what `/v1` has promised. `describeApi` (`@slovo/contracts/api-description`) builds the OpenAPI description from `apiContract` alone, with no backend and no database, and the backend serves the same one at `/docs`, with the same options. A comparison of a description with the promised one lists every change an app in the field would not understand: a procedure gone or moved; an output field gone, one that may now be missing, or one of a new kind, `null` included; an input field, parameter or body no longer accepted, or one that becomes required; an error code a procedure no longer answers, or whose status or data changes; a successful answer gone or new; and a type or constraint that changes, save a bound or an enum of an input that only widens and of an output that only narrows. Notes for the reader, such as summaries, descriptions and a default in an answer, change nothing. It knows what oRPC's generator writes: inline schemas, no `$ref`.

- **The contracts' tests** fail when the contract breaks the committed description, and when the committed description isn't the contract's, so an addition is recorded in the change that makes it.
- **`pnpm describe:api`** records an addition: it writes the contract's description over the committed one, and writes nothing and fails, listing the changes, when the contract breaks it.
- **CI** also runs it against the description on the pull request's base branch, so a description edited by hand to match a breaking change still fails.
- **The backend's tests** check that `/docs/openapi.json` is the contract's description, with the server it is read from.

### Considered Options

- **A general OpenAPI diff tool, such as oasdiff, in CI**: rejected. It is a binary outside the workspace that would run only in CI, while the check runs in the contracts' tests on every machine, is tested through oRPC's own generator, and lists its changes in the words of this ADR.
- **A snapshot test of the description**: rejected. It fails on an addition as on a removal, so updating it would hide a breaking change as easily as it records an addition.
