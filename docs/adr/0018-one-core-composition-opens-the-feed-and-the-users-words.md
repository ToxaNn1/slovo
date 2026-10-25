# One Core composition opens the Feed and the user's words together

The Feed, Favorites, Collections, History, Hidden Entries and the Mix depend on each other. Hiding an Entry or changing the Mix changes which Entries are eligible, so the Cycle reads them again and the Feed drops the cards that are no longer eligible. An Entry that becomes Seen joins History in the same write. A heart tapped in the Feed changes the counts on the Saved tab.

The Core opens all of them in one composition once the Language Pack is open, over one Entries module, one Cycle and the stored user state, and makes every link inside it. Each feature tells its subscribers when it changes, as the Feed does (ADR 0016), so a shell subscribes to what it draws and holds no rule between features. Tests drive the composition, not the features one by one.

The settings that style the Language Pack's own loading and error screens (Theme, font size, Vibration) open before the pack and stay apart from the composition.

**The reactions to a change of eligibility stay a hand-written ordered chain.** `eligibilityChanged` awaits the Cycle, the Feed, the notification plan and the Game Modes on offer in turn, with the order written beside them: the Cycle reads the eligible Entries before the Feed drops its cards, and the plan is made again only once the Feed has followed. The day change has its own module (ADR 0022). Reopen this only if adding a reaction keeps forcing edits to the chain, or the order stops fitting in one function.

**A composition a reopen replaced closes.** The shell reopens the composition over the same user state (ADR 0036). A composition has `close()`: from then on it writes nothing to the user state, hands the device no plan, and the Game tries no planning of its offers again; its modules stay readable and their changes stay in memory only. It closes at the ports it was given (the user state's `write`, the scheduler's `replacePlan`, the `schedule` of the Game's tries), so no module needs a rule of its own and a module added later is closed too. `close()` resolves once the writes and plans under way end, and never rejects. The shell's opening takes a `close` with the value a reopen replaced and calls it after telling its subscribers of the new value, so React cleanups that run afterwards find the old composition closed. Work the old composition started before closing still ends as it would; reopens follow a sync or a remote switch check, both waiting on the network, so that work has ended by then.

An undo toast may outlive the composition it came from, so «Скасувати» undoes in the composition open at the tap: a hide's undo is an unhide of what it changed, and a restore's undo hides the Entry again at the time it was hidden (`hiddenAt`, which an unhide returns).

## Considered Options

- **Separate Core modules that the shell connects**, such as a call to the Feed after each hide: rejected. The links decide what the reader may see next, yet they would live in untested React code.
- **A stream of user-state changes that each module subscribes to**: rejected. The links become implicit, the order of writes is hard to reason about, and tests would still assemble several modules to see one behaviour.
- **Settings inside the composition**: rejected. The Theme is needed before the Language Pack opens.
- **A named list of followers for the eligibility and day reactions** (architecture review 4): rejected. It would hold the same four calls in the same order behind a seam with one adapter, hide the order in the position of its items, and could not express the day change's unlike steps.
- **Close the old composition before the new one opens**: rejected. Every heart, hide or mark tapped while the new one opens would be lost.
- **A `closed` check in each module**: rejected. Each module would carry the same rule, and a write path missed or added later would stay open.
- **An undo after a reopen does nothing, or the reopen takes the toast away**: rejected by the owner.
