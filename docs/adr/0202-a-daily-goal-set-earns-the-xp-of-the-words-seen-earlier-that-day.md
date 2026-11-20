---
summary: Setting a Daily Goal earns the Seen-Word XP of the Words Seen earlier that local day while no goal was in force, up to the goal set and once per Word; the onboarding's first Word, Seen on «Беру!» before the goal step, keeps its XP.
---

# A Daily Goal set earns the XP of the Words Seen earlier that day

Owner decision of 2026-11-20, ticket #2062: the first Word of the onboarding is Seen the moment the reader taps «Беру!», which comes before the Daily Goal step. A Word Seen for the first time earns XP only on a day with a Daily Goal, so the first Word earned 0 XP where it earned 1 before. The owner's decision: the first Word earns its XP as before.

**Decision.** When the reader sets a Daily Goal, the XP log appends, in the same write as the `word-goal` record, the Seen-Word XP of every Word that was Seen today at a moment when no Daily Goal was in force and has no Seen-Word record yet. The other conditions stay as they are: the first Cycle, a Word, the Edition's `seenWordXp` switch, and at most as many Seen-Word records a day as the goal set. A Word has one Seen-Word record by its id, so a later change of the goal, another device or an app restart never earns it twice. A Word Seen past a goal in force earns nothing from a later, higher goal: the cap of the goal it was Seen under holds. «Без цілі» earns nothing.

The rule is the XP log's (`setDailyGoal` in `packages/core/src/progress/xp-log.ts`), not the onboarding's, so a reader who skipped the goal in onboarding, saw Words and then set a goal in Settings the same day earns the same XP.

**Consequences.** The XP records are dated today and timed at the moment the goal is set. After an app restart the Words are read from History by their Seen time, so the first Word earns its XP also when the app was closed between «Беру!» and the goal step. A Word whose Seen time moved to today some other way while it was in History before (History cleared and the Word Seen again in the first Cycle) may earn XP once; a Word earns it once ever, so this stays within one Word's XP.

## Considered and rejected

- **Accept 0 XP for the first Word**: rejected by the owner.
- **Move the Daily Goal step before the first Word**: rejected. The first Word is the onboarding's hook and comes first.
- **Award the first Word from the onboarding alone**: rejected. A second path to the same XP, and the reader who sets the goal in Settings later that day would be treated differently.
- **Earn the XP of every Word Seen today without a record, whatever goal was in force**: rejected. Raising the goal would pay for the Words Seen past the earlier goal, which the cap exists to prevent.
