# Each Edition declares its content targets, and the pack build enforces them

An Edition may declare the floor its content must reach in `content/targets.json`: a minimum number of Words, of Corrections and of Words per Category, every rarity present, and every Word with a Stress. The Language Pack build checks the content report against those targets. A missed target does not stop the pack from being written, but `pnpm build:pack` exits non-zero and lists every miss, so CI fails. Word counts leave Retired Words out, as the content report does.

The numbers belong to the Edition, not to the Core or the build tool. The Core stays language-agnostic, and a new Edition starts with no targets and adds them as its content grows. A target the file leaves out is not checked; an unknown key in the file is a build error, so a typo never switches a target off.

## Considered Options

- **Hard-coded Ukrainian numbers in the build tool or the CI workflow**: rejected. They would put one language's content plan into shared tooling.
- **Targets in `edition.json`**: rejected. That file is the runtime Edition config the Core loads; the targets only matter when the pack is built.

## Amendment: the Categories in `edition.json` are read at build time only (ADR 0033)

`edition.json` is still the Edition config the Core loads, but its Categories are now only the content source the pack build writes into the pack. The app reads Categories from the Language Pack, so a content update can add one (ADR 0033).
