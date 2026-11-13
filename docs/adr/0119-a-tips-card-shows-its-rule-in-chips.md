# A Tip's card shows its rule in chips

ADR 0091 gave a Tip card behind `wordTabs` its title, its chip «порада» and its non-standard form above two tabs, «Суть» (the standard form, the explanation, the sources) and «Приклад» (the Example). Board e9 (2026-11-12 Feed board) draws a Tip as the red kicker «ПОРАДА», the title at 30 on 33 over the red slanted bar, and the tabs «Правило · Винятки»: a rule in reading text with its words in raised chips, then the exceptions the same way.

**«Правило» from what a Tip has.** Behind `wordTabs` a Tip card has one tab, «Правило» (`tipCard.tabs.rule`): the explanation (`tipRule`, Onest 500 20/28), the standard form and the Example's text in chips as on a Word's «Зв’язки» (`LinkChips`), and the source line. «Винятки» comes only with exceptions in a Tip's data; a Tip has none yet, and the content model gets no field for them until a content wave writes them, so no Tip shows the tab and its card draws no tab bar, as every card with one tab does (ADR 0091). Which tab a Tip has is one pure function of the Core's card model (`tipTabsOf`, `@slovo/ui/tip-tabs`), tested in Vitest.

**The look of e9.** The kicker names the kind, as on every Entry card, with no chip, and a red slanted bar sits under the title, with or without `wordTabs`. The non-standard form stays under the head under «Так часто кажуть», though the board draws none, so a Tip still shows the wrong way and Self-check (ADR 0051) is unchanged: a concealed Tip keeps its kicker, title and non-standard form (owner, 13.11.2026).

## Considered Options

- **«Суть» and «Приклад»** (ADR 0091): replaced by the board's «Правило».
- **Drop the non-standard form, as the board does**: rejected by the owner (13.11.2026). It would change ADR 0051's Self-check, and the wrong way is what a reader recognises.
- **A content field for exceptions now**: deferred. No Tip has exceptions written; the tab comes with the content wave that writes them.
