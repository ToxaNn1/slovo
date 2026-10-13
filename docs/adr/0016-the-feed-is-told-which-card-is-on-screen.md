# The Feed is told which card is on screen and keeps the next card ready

The Core's Feed holds every rule that decides whether Seen is right. A shell tells it one thing: which card is on screen now, or that none is, because the screen is out of focus or the app is in the background. From that the Feed counts the dwell time of the card that leaves the screen, keeps the reader's last position, and keeps the card after the one on screen ready, never more than one card ahead. Its cards are an array it never edits: each change makes a new one and tells the Feed's subscribers, so a shell subscribes (in React with `useSyncExternalStore`) and holds no Feed rules.

## Considered Options

- **The shell pairs card-visible and card-hidden reports and asks for the next card itself**: rejected. Those rules decide whether Seen is right, yet they lived in an untested React hook, and the hook copied the card list after each call because the Feed never said when it changed.
- **A separate Core module over the Feed that turns screen reports into visible and hidden pairs**: rejected. It adds a second interface for one behaviour, and the pairs disappear once the Feed holds the card on screen itself.
- **One Core composition that opens every Core feature (Feed, Settings, swipe hint, Entries) behind one provider in the shell**: not adopted yet. Settings open before the Language Pack, because they choose the Theme of the pack's own loading and error screens, while the Feed opens after the pack, with its own retry. One composition would still open in two phases behind two providers, as today. The features share only the stored user state, which the shell already opens once per app run. Revisit when the Mix and Hidden Entries (0.3) make Settings, the Entries and the Feed depend on each other.

## Amendment: one composition from 0.3

The composition left open above is adopted in ADR 0018: from 0.3 the Feed opens together with Favorites, Collections, History, Hidden Entries and the Mix, while the settings still open before the Language Pack.

## Amendment: the Feed moves the card on screen when eligibility changes (0.3)

A hide or a Mix change drops cards from the Feed at once, the one on screen included, and an undo puts them back (ADR 0015). The shell can't tell where the reader is after that, so the Feed keeps it and tells the shell: it keeps the card on screen in place, gives the place to the next card when the card on screen is dropped, and gives it back to that card when its Entry is eligible again before the reader moved. The shell turns its pager to the Feed's position after the cards change. A card that leaves the screen this way is Seen by the dwell rule, like any card that leaves it.

A dropped card keeps its place among the session's cards while it is out, so an undo puts it back exactly where it left, also when cards were got ready after it.

### Considered Options

- **The shell keeps its pager index and the Feed follows it**: rejected. A card dropped before the one on screen would move the reader one card on without a swipe.
- **Forget a dropped card and get it again like any next card**: rejected. Undo must put the card back where it was, not after the ready card.
