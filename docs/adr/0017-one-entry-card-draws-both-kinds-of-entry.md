# One Entry card draws both kinds of Entry; the Edition's words and voice come from a provider

The UI draws every Entry with one Entry card. It takes the Core's card of a Word or a Correction and draws it in one frame, with the compact layout of narrow screens, the Decor slots of its kind (corner ornaments on a Word card only, as the design has it; see the 0.8.5 amendment) and a slot for the action row under it. A screen never assembles a card from parts, so the Feed and the Saved detail (0.3) show the same card, and each 0.3 action is added in one place.

What the card needs from the Edition comes from an `EditionProvider`, as the tokens, the Decor and the font size already do: the UI strings, the language VoiceOver reads in, the Category names and the Pronunciation button. The button is the one part the shell supplies as a component, because it speaks through the device's voice, which the UI package does not reach. The shell connects it once, at the root.

## Amendment: the Correction card wears the frame too (0.8.5)

The Correction card draws the same corner ornaments (Decor slot 3, ADR 0014) as the Word card, in the same four corners: the Entry card no longer branches on the kind for the frame. An Edition without corners still gets a plain card.

## Considered Options

- **A Word card and a Correction card that share a frame component**: rejected. Every screen would still branch on the kind and pass each card its parts, and the action row would be added twice.
- **The Pronunciation button as a prop of the Entry card**: rejected. It is the same on every screen, so each screen that shows an Entry would repeat it.
- **Pronunciation and its React binding moved into the UI package behind a port**: not adopted. It would move tested behaviour between packages for a single adapter.
