---
summary: «Рідкість» is one Rarity Range «від N до M» (default 1–5, «лише N» allowed) that every surface obeys, picked on five slanted bars by tap or drag; onboarding and the Rarity Test set only the top; `settings.rarityRange`, migration 9 from the Ceiling; switch `rarityCeiling` alone, `rarityRange` retired by 0176 (supersedes 0072). Amended by 0183.
---

# One Rarity Range for every surface

ADR 0072 left one bound, the Rarity Ceiling «до 1»…«до 5». The owner wants to leave out the commonest Words too, «від 2 до 4», without the two settings that pulled against each other before 1.0.

**One setting, «Рідкість»: the Rarity Range, «від N до M», default «від 1 до 5».** Both ends are rarities 1 to 5, the bottom never above the top; a range of one rarity is allowed and reads «лише 3». Only Words within it appear anywhere new: the Feed, notifications, widgets, every Game Mode and the Daily Crossword's choice of Words. Entries of other kinds have no rarity and are not affected. It stays a setting of its own, not a part of the Mix.

**The picker.** Settings draws five slanted bars of rising height, numbered 1 to 5, with «РІДКІСТЬ» and the range over them; the bars of the range are the accent. A tap on a bar outside the range pulls the nearer end out to it; a tap on an end of a range of several bars leaves that rarity alone; a tap inside moves the nearer end in to it, the top on a tie; a tap on the one bar of a single rarity takes every rarity back. A line under the bars says how a range is picked. A drag across the bars picks the range from the bar it starts on to the one under the finger, shown as it goes and kept when the finger lifts. A bar that joins the range springs up as it reddens, with a light haptic; under Reduce Motion it only fades.

**Who sets it.** The reader in Settings sets both ends. Onboarding's «Рівень» and the Rarity Test set the top alone, and the bottom goes back to 1 (ADR 0054, 0067). Amended by ADR 0183: «Рівень» sets nothing, so the Rarity Test alone sets the top (by the rule of ADR 0182).

**The Core.** `entries/rarity-range.ts` holds the rule every surface filters by (`withinRarityRange`) and the setting (`RarityRangeSetting`); the Daily Crossword takes `wordsInRarityRange`. A Mood's band clips to the range: `upper` is its top and the one below, `lower` its bottom and the one above (ADR 0076). The app's hook is `useRarityRange` in `mix/`, for the folder reason of ADR 0027.

**Stored state is parsed once, where it enters.** The record is `settings.rarityRange` `{from, to}`, synced last write wins (ADR 0041). Migration 9 of the user-state schema (ADR 0013) turns a stored `settings.rarityCeiling` of N into «від 1 до N» with a pending change, and deletes the old key.

**Feature Switch.** `rarityCeiling` is the switch of the setting as a whole: off, every Word is in and the Rarity Test is off; on, «Рідкість» is the picker of both ends. The former switch `rarityRange` is retired (ADR 0176): the «до 1»…«до 5» row of the top alone is gone. The Edition's `userSettingDefaults.rarityCeiling` and the questionnaire's `rarityCeiling` options keep their names and mean the top.

This supersedes ADR 0072 and its removal of the Rarity Floor.

## Considered Options

- **Two settings, a Floor and a Ceiling**: rejected again, as in ADR 0072. One range on one picker cannot cross itself.
- **A slider with two thumbs**: rejected. Five numbered bars match the owner's shots and the five rarities exactly; a thumb on a five-step track is a small target.
- **Let onboarding and the Rarity Test keep the bottom**: rejected by the owner. They answer «how rare can it be», so they set the top and open the range from 1.
