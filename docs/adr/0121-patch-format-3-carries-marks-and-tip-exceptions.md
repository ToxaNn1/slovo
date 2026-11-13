# Patch format 3 carries standard-form marks and Tip exceptions

A Patch now carries content that an app of Patch format 2 cannot draw: a Correction's `examplePair.standard` marks its standard form `**like this**` (ADR 0117), and a Tip may have `exceptions` (ADR 0120). An app on format 2 would show the raw `**` and drop the exceptions. The owner decided (13.11.2026, review item R136) to bump the Patch format.

**The format.** `PATCH_FORMAT` goes from 2 to 3. Patch format 3 means a Patch may carry `**` marks in a standard example and Tip `exceptions`. The backend serves only format 3; a request with `patchFormat` 2 (or any other) gets `unsupported-format` with `patchFormat: 3`, and the app keeps its content as it is (ADR 0090) until it is updated to read format 3. The ETag and the CDN key carry the format (ADR 0099), so a format-2 answer is never served to a format-3 app.

## Considered Options

- **Keep format 2 and send the marks**: rejected. An app on format 2 shows `**` around the standard form.
- **Strip marks and exceptions for format-2 requests**: rejected. Two Patch shapes to serve and test for apps that update through the store anyway; their content stays correct as it is.
