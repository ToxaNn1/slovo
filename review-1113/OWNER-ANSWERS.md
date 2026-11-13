# Owner answers (13.11 ~19:55Z, relayed by local coordinator #5)
## perf commits — answer A
Owner, verbatim: «А». Grant: ONE force-push of fix/1113-code-review that only rewords 032a3347c (R53), 45abddebc (R63), d9034973b (R138) from `perf(<scope>)` to `refactor(<scope>)`; content unchanged.
Do it once, after every lane is merged into fix/1113-code-review and before the PR (or before the final push), so no live lane/merger pushes on top of the old history. Lane branches stay as they are. Then confirm CI «Commit messages» is green and log it in HANDOFF.md. No commitlint change, no main merge.

## Commit types for every implementer and merger
Allowed types only: feat fix docs chore test refactor style (commitlint.config.js). Never `perf:`; a speed-up is `refactor:` (or `fix:` when it fixes a bug). Tell every lane brief / relaunch this.
