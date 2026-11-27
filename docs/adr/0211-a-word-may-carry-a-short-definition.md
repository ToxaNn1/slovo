---
summary: A Word may carry a Short Definition (`shortDefinition`, 80 characters or fewer, only beside a primary Definition over 80), which the Word Meaning question, the Yesterday quiz and the Due Quiz show as the Word's option, right or Distractor, while «Пари», the sheet, the prompts and every card keep the primary Definition; no Feature Switch, a jsonb field with no migration, and a nullable pack column under pack format 14, where `openPack` refuses a pack without it.
---

# A Word may carry a Short Definition

Decision of 2026-11-28, the owner's (ticket #2148).

A Word's primary Definition is written for its card. Half of them are over 66 characters and 2823 of the 9103 live Words have one over 80. The Word Meaning question shows four Definitions whole, the Yesterday quiz and the Due Quiz three: a wall of text, and a long option among short ones gives the answer away.

## Decision

- A Word may carry a **Short Definition**: an optional second wording of its primary Definition, the field `shortDefinition`. The card keeps the primary Definition whole.
- **Content rules** (rule `short-definition`): 80 characters or fewer (`SHORT_DEFINITION_MAX_LENGTH` in the contracts); not the text of the primary Definition by the Comparison Key of a Definition; never holding the Word's own Lemma; only on a Word whose primary Definition is over 80 characters. No Word must have one.
- **The Word Meaning question** shows each Word's Short Definition, or its primary Definition when it has none, as the right option and as a Distractor alike. No two options share a Comparison Key of the text shown, and no Distractor's shown text or primary Definition is one of the asked Word's own Definitions. A Word is never asked when the text it would show holds its Lemma, so a Word whose primary Definition names it is asked once it has a Short Definition.
- **The Yesterday quiz and the Due Quiz** (the owner, 28.11) do the same with their three meanings: each Word's Short Definition, or its primary Definition when it has none, as the right meaning and as a Distractor alike. No two meanings share a Comparison Key of the text shown, and no Distractor is a Word whose primary Definition is the asked Word's own or the text it shows. Yesterday's card keeps the primary Definition.
- **Everything else keeps the primary Definition**: «Пари» (the owner, 28.11: as it is for now), the prompts with one Definition, the crossword clue, the answer sheet and every card.
- **No Feature Switch**: without the data nothing changes, and the data is the switch.
- **Storage.** The content store keeps a Word's fields as jsonb, so there is no migration: nothing is read or written on the live base until a text is saved through the write API. The snapshot and the Patch carry the field; a build before it reads them as outputs, open to later fields (ADR 0031), and drops it.
- **Language Pack.** The pack gets the nullable column `words.short_definition`. A build before it never reads the column, so the pack format stays 14. A build with it could not apply a Patch to a pack of format 14 built before the column, so `openPack` refuses such a pack and the app copies the bundled one over it, as for another pack format.

## Rejected

- Asking only the Words with a short primary Definition: a third of the Words would leave the question.
- Cutting the primary Definitions themselves: the card loses detail.
- A Short Definition for every Word: 9103 texts to write and keep in step.
- A new pack format: every build before it would refuse the pack for a column it ignores.
