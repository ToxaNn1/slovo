# Corrections have their own Categories

Corrections were grouped only by Correction Type, which says why a form is non-standard, not where a reader meets it, so a reader could not pick the Corrections of their own world (spec #680, C16). The Words' Categories don't fit Corrections: «Діалекти» or «Військова справа» group Words by what they name, while a Correction belongs to a place in a reader's day, such as work, a shop or a bus.

**An Edition defines a list of Categories for Corrections, apart from the Words' list.** `correctionCategories` in `edition.json` lists them, each an id and a display name in the Edition's language, in the order the Edition shows them; every Edition has at least one, and an id appears once. A Category of Corrections is a Category, with the same contract (`CategorySchema`) as a Category of Words.

**Every Correction names one Category of Corrections.** `categoryId` is a required field of the Correction. The Language Pack build refuses a Correction without it, and one whose Category is not in the Edition's `correctionCategories`, a Category of Words included.

**The Language Pack carries the list, as it carries the Words' Categories (ADR 0033).** The pack holds the list in the table `correction_categories` in the Edition's order and each Correction's Category in the column `category_id` of `corrections`, under pack format 4 (ADR 0032). The Core's content read port lists them with `listCorrectionCategories`, in the pack's order, also one whose Corrections are all Retired. The content checksum covers them like the rest of the content.

**A content target sets a floor per Category.** `minCorrectionsPerCategory` in `content/targets.json` names the fewest live Corrections each Category of Corrections holds; the content report counts the Corrections per Category.

**In the app they follow the rules of the Words' Categories.** The Correction card shows its Category as a chip. A Category of Corrections out of the Mix is a Hidden Category (ADR 0019), shown on the Hidden screen and put back from there; on the Mix screen the Categories of Corrections sit under the switch of Corrections as a whole, and a Correction is an Eligible Entry only while Corrections are in and its Category is in. The Mix holds the list apart from the Words' with the same rules, the last Category of the list included (ADR 0019): each Category's place is its own user-state record, `mix.correctionCategories.<id>`, which the Core owns (ADR 0013) and which syncs last write wins like the rest of the Mix (ADR 0041). The Edition's default Mix names the Categories of Corrections apart from the Words', `correctionCategories` in `userSettingDefaults.mix`, every one of the Language Pack or the listed ids; the Ukrainian Edition holds every one (owner, 2026-10-25).

## Considered Options

- **One list of Categories for Words and Corrections**: rejected by the owner (2026-10-25). A Category of Words would hold no Corrections, and a Category of Corrections no Words, so every list on the Mix screen would carry empty groups.
- **Group Corrections by Correction Type**: rejected. A reader knows where they speak, not which kind of mistake they make.
- **An optional Category on the Correction**: rejected. A Correction without one would have no chip and no place in the Mix, and the build can't tell an omission from a choice.
