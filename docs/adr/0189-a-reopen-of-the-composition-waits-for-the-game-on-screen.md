# A reopen of the composition waits for the Game on screen

Owner app pass of 2026-11-18, finding 29: «Фразеологізми» closed by themselves after a wrong answer in Round 3, with no result screen and no leave confirmation. This ADR amends ADR 0036.

**Why.** The Game in play and its result screen live in the composition's memory alone (ADR 0052: a Game is never stored). The shell reopens the composition over a sync that changed the user state, a Patch and a changed remote Feature Switch (ADR 0036, 0040, 0090), and a reopen builds a new Game with nothing on screen, so the Game screen fell back to the mode screen. Each answer writes to the user state and Sync runs shortly after every write; a sync that pulled a change, or one that failed and so may have, reopened the composition in the middle of the Game. The XP its Rounds had earned stayed, which is why the total grew by more than the result screen showed (finding 31).

**Decision.** While the Game has a Game on screen, in play or its result, a reopen of the composition waits; it runs once the Game is left («До ігор», the leave confirmation), and the asks made while it waits reopen once. «Ще раз» from the result screen starts the next Game in the same composition, so the reopen waits on. What the sync merged or the Patch applied is already in the user state and the Language Pack and reaches the screens with that reopen.

**Consequences.** A sync, a Patch or a remote switch shows on the other screens only after the Game is left; a Game is short, and a Game paused in its tab keeps the old composition until the reader returns to it and leaves it. The rule lives in the shell's one `reopenComposition`, which every reopen goes through.
