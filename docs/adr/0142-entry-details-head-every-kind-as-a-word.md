# Entry details head every kind as a Word

Status: accepted (owner, 15.11)

## Context

Entry details, the screen an Entry opens on from «Вчу», Favorites, History, a Collection, Search or a link, drew a Word under the red panel with the giant first letter, its Lemma and part of speech, and its tabs on the screen's ground. Every other kind kept its Entry card, frame and kicker included, under a bare panel. On the phone the owner opened an Idiom from «Вчу» and asked for the Word's look on every Entry opened this way.

## Decision

- Entry details always head a Correction, an Idiom, a Synonym Row and a Tip as a Word: the giant first letter of its headline in the panel, the headline in the key ink at the Lemma's size (a long one smaller, as an Idiom's expression), and the name of its kind under it where a Word names its part of speech. A Correction's headline is its non-standard form, struck with a cream bar on the red panel.
- The meaning follows on the screen's ground with no card frame: the kind's body without its kicker and headline, its tabs as a Word's. The corner or the docked action row is a Word's, for every kind.
- ADR 0176 retired the switch: no kind keeps its Entry card under a bare panel. The Feed's cards are unchanged.

## Considered Options

- **Only drop the side swipes on the screens a list opens**: rejected by the owner, 15.11; the look was the point.
