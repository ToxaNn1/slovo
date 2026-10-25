# Each Edition declares its content targets, and the pack build enforces them

An Edition may declare the floor its content must reach in `content/targets.json`: a minimum number of Words, of Corrections (`minCorrections`), of Idioms (`minIdioms`) and of Words per Category, every rarity present, and every Word with a Stress. The Language Pack build checks the content report against those targets. A missed target does not stop the pack from being written, but `pnpm build:pack` exits non-zero and lists every miss, so CI fails. Counts leave Retired Entries out, as the content report does.

`minWordsByCategory` names Categories and gives each its own floor of Words, which the build takes over `minWordsPerCategory` for that Category only, so a new Category can grow to the general floor over several content updates while the full ones stay guarded. A floor that names a Category the Edition doesn't have is a missed target.

The numbers belong to the Edition, not to the Core or the build tool. The Core stays language-agnostic, and a new Edition starts with no targets and adds them as its content grows. A target the file leaves out is not checked; an unknown key in the file is a build error, so a typo never switches a target off.

## Considered Options

- **Hard-coded Ukrainian numbers in the build tool or the CI workflow**: rejected. They would put one language's content plan into shared tooling.
- **Targets in `edition.json`**: rejected. That file is the Edition config; the targets only matter when the pack is built.
- **Lower `minWordsPerCategory` for every Category while a new one grows**: rejected. It would stop guarding the full Categories.
- **Hold a new Category back until it reaches the general floor**: rejected. Content ships in small reviewed steps.
