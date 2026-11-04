# One Rarity Ceiling for every surface

Until 1.0 the reader set rarity in two places inside the Mix: a Rarity Floor («від 1» to «від 5», the commonest Words left out) and a Rarity Ceiling («до 1» to «до 5», the rarest left out), with the Floor never above the Ceiling. The two pulled against each other, the Rarity Test and the self-rating set one while onboarding set the other, and the Daily Crossword ignored both (ADR 0052). The reader thinks of rarity as one thing, how hard SLOVO is for them (owner decision 03.11, spec #1540).

**One setting, «Рідкість»: the Rarity Ceiling, «до 1» to «до 5», default «до 5».** Only Words up to it appear anywhere new: the Feed, notifications, widgets, every Game Mode and the Daily Crossword's choice of Words. The Rarity Floor is removed. Entries without a rarity (Corrections, Idioms, Synonym Rows, Tips) are unaffected. Search, the Knowledge Marks and anything the reader keeps ignore the Ceiling, as they ignored the Mix (ADR 0015, 0043, 0054).

**It is a setting of its own, not a part of the Mix.** The Mix keeps the Categories, the kinds of Entry, the Mix kind weights and the frequency of the Quick Question, and loses both bounds. The Core's `entries/rarity-ceiling.ts` holds the one rule every surface filters by (`withinRarityCeiling`) and the setting itself (`openRarityCeiling`); the Entries module applies it to eligibility (ADR 0015 still: no other module filters by rarity) and gives the Daily Crossword the live Words up to it (`wordsUnderRarityCeiling`). The module sits in `entries/`, beside the one filter that applies it: in `settings/` it closed the folder cycle `settings/` → `community-counters/` → `knowledge/` → `entries/` → `settings/` (ADR 0027). The app's hook `useRarityCeiling` sits in `mix/`, beside the Mix choices that draw the setting, for the same reason (`settings/` → `feed/` → `mix/` → `settings/`). The record is `settings.rarityCeiling`, synced last write wins (ADR 0041); the Edition's `userSettingDefaults.rarityCeiling` is its default.

**Stored state is parsed once, where it enters.** Migration 7 of the user-state schema (ADR 0013) moves a stored `mix.rarityCeiling` that reads as a rarity to `settings.rarityCeiling`, with a pending change so a signed-in reader's Account gets it, and deletes `mix.rarityFloor` and `mix.rarityCeiling`. An existing reader keeps the Ceiling they had and sees no change on day one; one who never set it gets the Edition's default.

**Who sets it.** The reader in Settings; onboarding's «Хто ви» («Навчаюсь» «до 4», the others «до 5», ADR 0067); the Rarity Test, to the lowest rarity answered «Не знаю», «до 5» when every Word is known (ADR 0054). All go through the one `set` of the setting. The vocabulary self-rating sets no rarity any more: it only decides whether the Rarity Test is offered. The Rarity Test draws from every rarity, the Ceiling aside.

**One Feature Switch, `rarityCeiling`,** in edition.json; `rarityFloor` is gone. Off, the Ceiling is «до 5» in effect, so every Word is eligible as before 1.0, and the Rarity Test, which sets it, is off too (`rarityTest` depends on `rarityCeiling`).

This supersedes the Rarity Floor in ADR 0015, 0040, 0054 and 0067, and the clause of ADR 0052 that the Daily Crossword ignores rarity.

## Considered Options

- **Keep both bounds, the Floor and the Ceiling, in the Mix**: rejected by the owner. Two settings that pull against each other read as one too many, and a reader who sets «від 4» gets few Words and no easy ones to start with.
- **Keep the Floor and drop the Ceiling**: rejected. Onboarding's «Навчаюсь» already lowers the Ceiling, and the rarest Words are what a learner wants to leave out, not the commonest.
- **A new name such as «рівень» or «складність»**: rejected. The glossary keeps «Rarity Ceiling» and lists those words under _Avoid_; the UI string «Рідкість» names the setting.
- **Keep it inside the Mix**: rejected. It now bounds surfaces the Mix doesn't reach (the Daily Crossword), and its record syncs as a setting.
