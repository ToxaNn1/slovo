# The Feed is told which card is on screen and keeps the next card ready

The Core's Feed holds every rule that decides whether Seen is right. A shell tells it one thing: which card is on screen now, or that none is, because the screen is out of focus or the app is in the background. From that the Feed counts the dwell time of the card that leaves the screen, keeps the reader's last position, and keeps the card after the one on screen ready, never more than one card ahead. Its cards are an array it never edits: each change makes a new one and tells the Feed's subscribers, so a shell subscribes (in React with `useSyncExternalStore`) and holds no Feed rules.

## Considered Options

- **The shell pairs card-visible and card-hidden reports and asks for the next card itself**: rejected. Those rules decide whether Seen is right, yet they lived in an untested React hook, and the hook copied the card list after each call because the Feed never said when it changed.
- **A separate Core module over the Feed that turns screen reports into visible and hidden pairs**: rejected. It adds a second interface for one behaviour, and the pairs disappear once the Feed holds the card on screen itself.
- **One Core composition that opens every Core feature (Feed, Settings, swipe hint, Entries) behind one provider in the shell**: not adopted yet. Settings open before the Language Pack, because they choose the Theme of the pack's own loading and error screens, while the Feed opens after the pack, with its own retry. One composition would still open in two phases behind two providers, as today. The features share only the stored user state, which the shell already opens once per app run. Revisit when the Mix and Hidden Entries (0.3) make Settings, the Entries and the Feed depend on each other.
