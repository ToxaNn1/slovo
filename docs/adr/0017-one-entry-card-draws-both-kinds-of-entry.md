# One Entry card draws both kinds of Entry; the Edition's words and voice come from a provider

The UI draws every Entry with one Entry card. It takes the Core's card of a Word or a Correction and draws it in one frame, with the compact layout of narrow screens, the Decor slots of its kind (corner ornaments on a Word card only, as the design has it; see the 0.8.5 amendment) and a slot for the action row under it. A screen never assembles a card from parts, so the Feed and the Saved detail (0.3) show the same card, and each 0.3 action is added in one place.

What the card needs from the Edition comes from an `EditionProvider`, as the tokens, the Decor and the font size already do: the UI strings, the language VoiceOver reads in, the Category names and the Pronunciation button. The button is the one part the shell supplies as a component, because it speaks through the device's voice, which the UI package does not reach. The shell connects it once, at the root.

## Amendment: the Correction card wears the frame too (0.8.5)

The Correction card draws the same corner ornaments (Decor slot 3, ADR 0014) as the Word card, in the same four corners: the Entry card no longer branches on the kind for the frame. An Edition without corners still gets a plain card.

## Amendment: Self-check belongs to the Entry card (0.8.6)

Self-check is the Entry card's too. A screen tells the card only whether Self-check applies there; the card keeps the reveal, decides what each kind conceals until it (a Word's Definition and what follows, its register labels; a Correction's right form, explanation and type), conceals it again once the card leaves the screen, and tells its action slot through a React context, so the Knowledge Mark buttons there stay inactive until the reveal. The action row stays the shell's (device share), and no screen passes the concealed state twice. «Поділитися» and «До колекції» stay active while the card is concealed, though the Share Card's preview shows the meaning: the owner chose to keep them so (21.10.2026).

### Considered Options

- **The screen keeps the reveal state and passes it to the card and to the action row**: rejected. The two values had to agree with nothing to enforce it, and each screen with Self-check would repeat the wiring.
- **A render-prop action slot that receives the state**: not adopted. Only the Knowledge Mark buttons care, so a context they read keeps the slot a plain node.

## Considered Options

- **A Word card and a Correction card that share a frame component**: rejected. Every screen would still branch on the kind and pass each card its parts, and the action row would be added twice.
- **The Pronunciation button as a prop of the Entry card**: rejected. It is the same on every screen, so each screen that shows an Entry would repeat it.
- **Pronunciation and its React binding moved into the UI package behind a port**: not adopted. It would move tested behaviour between packages for a single adapter.
