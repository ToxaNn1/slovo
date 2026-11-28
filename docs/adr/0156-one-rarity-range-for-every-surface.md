---
summary: «Рідкість» is one Rarity Range «від N до M» (default 1–5, «лише N» allowed) that every surface obeys, picked on five bars in Settings or on the tab «Теми»; the Rarity Test alone sets the top (and opens the bottom to 1), «Рівень» sets nothing; `settings.rarityRange`, migration 9 from the Ceiling; switch `rarityCeiling` alone, `rarityRange` retired (supersedes the earlier Rarity Ceiling).
---

# One Rarity Range for every surface

The earlier design left one bound, the Rarity Ceiling «до 1»…«до 5». The owner wants to leave out the commonest Words too, «від 2 до 4», without the two settings that pulled against each other before 1.0.

**One setting, «Рідкість»: the Rarity Range, «від N до M», default «від 1 до 5».** Both ends are rarities 1 to 5, the bottom never above the top; a range of one rarity is allowed and reads «лише 3». Only Words within it appear anywhere new: the Feed, notifications, widgets, every Game Mode and the Daily Crossword's choice of Words. Entries of other kinds have no rarity and are not affected. It stays a setting of its own, not a part of the Mix.

**The picker.** One picker on five bars sets both ends, in Settings or on the tab «Теми» (ADR 0201), which shows it where it is shown: one setting, not a part of the Mix.

**Who sets it.** The reader in Settings sets both ends. The Rarity Test alone sets the top, and the bottom goes back to 1. Onboarding's «Рівень» sets nothing.

**The Core.** `entries/rarity-range.ts` holds the rule every surface filters by (`withinRarityRange`) and the setting (`RarityRangeSetting`); the Daily Crossword takes `wordsInRarityRange`. A Mood's band clips to the range: `upper` is its top and the one below, `lower` its bottom and the one above. The app's hook is `useRarityRange` in `mix/`.

**Stored state is parsed once, where it enters.** The record is `settings.rarityRange` `{from, to}`, synced last write wins (ADR 0041). Migration 9 of the user-state schema (ADR 0013) turns a stored `settings.rarityCeiling` of N into «від 1 до N» with a pending change, and deletes the old key.

**Feature Switch.** `rarityCeiling` is the switch of the setting as a whole: off, every Word is in and the Rarity Test is off; on, «Рідкість» is the picker of both ends. The former switch `rarityRange` is retired: the «до 1»…«до 5» row of the top alone is gone. The Edition's `userSettingDefaults.rarityCeiling` keeps its name and means the top; the values of the questionnaire's `rarityCeiling` options are read by nothing.

This supersedes the earlier design and its removal of the Rarity Floor.

## Considered Options

- **Two settings, a Floor and a Ceiling**: rejected again, as before. One range on one picker cannot cross itself.
- **A slider with two thumbs**: rejected. Five numbered bars match the owner's shots and the five rarities exactly; a thumb on a five-step track is a small target.
- **Let the Rarity Test keep the bottom**: rejected by the owner. It answers «how rare can it be», so it sets the top and opens the range from 1.
