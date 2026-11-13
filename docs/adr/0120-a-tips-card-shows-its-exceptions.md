# A Tip's card shows its exceptions in «Винятки»

ADR 0119 drew a Tip card as board e9 does, with the tabs «Правило · Винятки», but gave the content model no field for exceptions, so no Tip showed «Винятки». The owner asked for the tab now (decision 17, 13.11.2026): a rule such as «Апостроф після «р»» has words that break it (буряк, крякати, Рязань), and the reader looks for them next to the rule.

**The field.** A Tip may have `exceptions` (`TipExceptionsSchema`): an `explanation` of at most 300 characters, as the Tip's own explanation, and `words`, at least one. A Tip with no exceptions has no field, never an empty one, so «exceptions with no words» cannot be written. The Core's card model passes them on (`TipCardModel.exceptions`).

**The tab.** Behind `tipExceptions` (needs `wordTabs`) a Tip with exceptions gets the tab «Винятки» (`tipCard.tabs.exceptions`) after «Правило»: the explanation in reading text and the words in chips (`LinkChips`), with no source line; with `sourceTab` on, «Джерело» stays the last tab (ADR 0116). A Tip without exceptions keeps «Правило» alone, and with the switch off no Tip shows the tab. Which tabs a Tip has stays one pure function (`tipTabsOf(card, { exceptions })`). The mobile app reads the switch once (`useShown().tipExceptions`).

**Pack format 13.** The Language Pack stores the explanation in the Tip's column `exceptions_explanation` (null for none) and the words in the table `tip_exception_words (tip_id, position, text)`, so the pack format goes from 12 to 13. `openPack` now refuses a pack of another pack format than the one the app reads, as `openLaunchPack` already assumed: a patched format 12 pack left on a device is replaced by the bundled one at launch instead of failing on the new column.

Amends ADR 0119 («Винятки» and its field). The admin's Tip form has no exceptions field yet; exceptions are written in the Edition's content files.

## Considered Options

- **No field until a content wave writes exceptions** (ADR 0119): replaced at the owner's word.
- **Exceptions as plain text in the explanation**: rejected. The board draws the words in chips, and a list of words can be checked and linked.
- **Keep pack format 12 and add the column quietly**: rejected. An app reading a pack without the column fails on every Tip; the format names what the app can read.
