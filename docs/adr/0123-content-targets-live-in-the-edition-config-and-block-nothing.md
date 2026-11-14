# Content targets live in the Edition config and block nothing

Content lives in Postgres (ADR 0090), so an Edition's content folder has nothing left to hold, and a floor that stops the pack build only stops a build whose content was already published. The owner decided (14.11.2026) that the floors leave the content folder, stay in the repo with the Edition config, and stop blocking.

**Where they live.** An Edition may declare its content targets in `contentTargets` of `edition.json` (`ContentTargetsSchema`, parsed once with the config): a minimum number of Words (`minWords`), of Corrections (`minCorrections`) and of Idioms (`minIdioms`), of Words per Category (`minWordsPerCategory`), of Corrections per Category of Corrections (`minCorrectionsPerCategory`, ADR 0033), every rarity present (`everyRarity`) and every Word with a Stress (`everyWordHasStress`). `minWordsByCategory` names Categories and gives each its own floor of Words, taken over `minWordsPerCategory` for that Category only, so a new Category can grow over several content updates while the full ones stay guarded; a floor that names a Category the Edition doesn't have is a missed target. A target left out is not checked; an unknown key is a config error, so a typo never switches a target off. `content/targets.json` is gone.

**What they do.** The admin's content report (`admin.content.report`, and `pnpm content counts` over it) counts the live content and lists every target it misses, as a check that blocks nothing: no save, no Patch and no build waits on it. Counts leave Retired Entries out. The Language Pack build neither reads the targets nor fails on them; it prints the content report and exits non-zero only when it cannot build the pack.

The numbers belong to the Edition, not to the Core or the build tool: the Core stays language-agnostic, and a new Edition starts with no targets and adds them as its content grows.

This supersedes ADR 0009.

## Considered Options

- **Keep `content/targets.json`**: rejected. The content folder goes with ADR 0090, and a file kept alone in it would be the image's only reason to copy the folder.
- **Targets in Postgres, edited in the admin**: rejected. They are part of an Edition's plan, reviewed in a change like the rest of its config.
- **Keep failing the build on a miss**: rejected. The content is already live when the pack is built; failing there blocks a release over a count the admin already shows.
- **Hard-coded Ukrainian numbers in shared tooling**: rejected, as in ADR 0009. They would put one language's content plan into shared tooling.
