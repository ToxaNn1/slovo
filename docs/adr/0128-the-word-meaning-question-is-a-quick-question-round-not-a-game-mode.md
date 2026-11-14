# The Word Meaning question is a Quick Question round type, not a Game Mode

The Feed's Quick Question asked only Rounds of Game Modes (ADR 0052), and none of them asks the plainest thing: what a Word means. The owner decided on 14.11.2026 (spec #1831) to add the Word Meaning question, «„{word}“ — це…» with four Definitions, to the Quick Question alone.

**Not a Game Mode.** The Word Meaning question is a round type of the Quick Question. It is not registered through the Game Mode Extension Point, has no card on the Game screen, no Lives, no Round limit, no Best result and no `game.modes` strings. ADR 0052 is amended on this point only: a Quick Question's Round may come from a Game Mode or from the Word Meaning question; everything else of 0052 stands.

**Its Feature Switch.** `quickQuestionWordMeaning`, declared by every Edition and `on` in the UA Edition, needs `quickQuestion` in the one table of switch dependencies (ADR 0040). Off, or with the Quick Question off, the question never comes.

**The same chance.** The Quick Question's candidates are the enabled Game Modes whose Round is a pick of options plus the Word Meaning question. They are shuffled with the injected Random and tried in turn, so each has the same chance, and the first that gives a Round wins.

**The Round.** A random Eligible Entry that is a Word, other than the Entry to avoid. The prompt is the Edition's `game.round.prompts.meaning` with the Lemma. A Word whose primary Definition holds its Lemma, by the Edition's text comparison (ADR 0101), is not asked. The options are the Word's primary Definition and three Distractors: primary Definitions of other Eligible Words, of the same part of speech first and of any other when those are too few. Two Definitions with one Comparison Key count as one, and none of the Word's own Definitions is a Distractor. No question comes when four distinct Definitions cannot be found. The options are shuffled and shown whole, never cut.

**The answer** is the Quick Question's own, unchanged: the same pick Round, 2 XP and a confirmed Entry for a right answer, Unknown for a wrong one, the same answer card (ADR 0043, 0066). Analytics name where a Quick Question came from in `mode`: a Game Mode's id, or `word-meaning`.

## Considered and rejected

- **A fourteenth Game Mode**: rejected. A Game of fifteen such Rounds is «Вгадай слово» turned around; the owner wants the question in the Feed only, and a mode would bring a card, a Best result and strings nobody asked for.
- **A stage of «Вгадай слово»**: rejected. It would change that mode's Games and its Best result.
