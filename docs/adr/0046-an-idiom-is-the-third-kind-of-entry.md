# An Idiom is the third kind of Entry

Until 0.8.8 SLOVO had two kinds of Entry, Words and Corrections. A fixed expression such as «бити байдики» or a place name such as «Бердичів» fitted neither, so it could not be authored. 0.8.8 adds the Idiom: a fixed expression whose meaning is not the sum of its words, with its Definitions, Examples and, where known, its origin. An Idiom has an opaque id with the `i_` prefix from the append-only id registry (ADR 0010), its expression in NFC, an Idiom Type, a primary Definition and extra Definitions, Examples in the Word's Example shape, an optional etymology, at least one source and `retired`. It has no Lemma, Stress, part of speech, Category, rarity or Pronunciation. The Edition authors Idioms in `content/idioms`, the Language Pack build writes them into tables of their own and records `idiom` as a kind of Entry, and the Core's content read port reads them, so every Entry the reader keeps stays reachable by id whatever its kind. A Retired Idiom behaves like a Retired Word. An Edition turns Idioms on through the Feature Switch `idioms`, and its default Mix says whether they are in.

**Why not a Word.** A Word is one dictionary word: it has a Lemma the alphabet check reads letter by letter, a Stress the Edition marks on its vowels, a part of speech, a Category and a rarity. An idiom is several words with no Stress of its own, no part of speech and no Category among the Word Categories; forcing one in would give the Feed a Word card with a chip and a Pronunciation button that lie. A place name is a proper name, which the Rare Word policy keeps out of Words on purpose.

**Why not a Correction.** A Correction pairs a non-standard form with its standard equivalents and says why the form is wrong. An idiom is not a mistake: it has nothing to correct and nothing to replace. Its card, its Game Round and its lists need the shape of a Word's meaning, not of a Correction's pair.

**Place names are an Idiom Type, not a kind of their own.** The Idiom Type is a closed set of two: `idiom` («фразеологізм») and `placeName` («топонім»). A place name shares everything an idiom has: an expression, a primary Definition that says what and where the place is, an etymology that tells the story of its name, Examples and sources. It therefore shares the Idiom's card, its turn in the Feed, its Mix switch and its lists, and only its chip differs. A kind of its own would add a parallel path through every screen for one chip, as a kind for stress traps would have (ADR 0045). What differs is what the build demands: a place name without its etymology is refused, because the story is the point of the card. The Edition strings name each Idiom Type once, so every surface shows the same name (the owner's decision of 2026-10-18).

**The Feed turn.** An Idiom's card takes every 7th card of the Cycle while the Cycle has unseen Idioms, counted like the Correction's turn on every 5th card, so Words still lead the Feed. When both turns fall on one card, the Correction goes first and the Idiom takes the next card, so the Feed keeps its rhythm. An Idiom due for Review takes the Idiom turn before a new Idiom, as a Correction does (ADR 0043). The Word of the Day, its notification and the Review slot on every 3rd card stay Words only. The Cycle ends only when every eligible Word, Correction and Idiom is Seen.

**The Game.** The Core Game Mode asks about idioms of Idiom Type `idiom` as it asks about Words: the Round gives the idiom's primary Definition and offers four idioms. Its Distractors are other live idioms drawn from the whole pack (ADR 0024), never one whose primary Definition is the answer's. A place name builds no Round and is never a Distractor: no Round asks the reader to guess a city from its description. A Word Round never offers an idiom, and the other way round.

**What this ADR leaves to its tickets.** The build's refusals (an expression not in NFC or with a character outside the Edition's alphabet, its Lemma punctuation and the space; a place name without an etymology; two live Idioms with one expression), the eligibility of Idioms (ADR 0015), the Idiom card (ADR 0017) and the Game (ADR 0024) are recorded as amendments of those ADRs.

**The region on a Word.** 0.8.8 also lets a dialect Word say where it is said. A Word may carry a region, a short text in the Edition's language, and only a Word with the dialectal register label («діал.») may: the Word contract refuses a region on any other Word, so every reader of a Word holds to the rule. The label alone stays allowed, because a Word the dictionaries mark «діал.» without naming a place is still a dialect Word, and the build must not invent a place for it. The region is free text, with no closed list of regions: dictionaries name places at every scale, and a list would refuse a correct Word until someone extended it. The Entry card, its Self-check state once revealed and the Share Card show the region after the label, and VoiceOver reads it there.

**The Rare Word policy.** The Rare Word policy (the glossary's _Rare Word_) says which Words the Edition may author:

- An obscene word is never a Rare Word. A dictionary insult marked «лайл.» or «зневажл.» is, because the dictionaries mark it as an old, witty insult. The line is obscenity, not profanity.
- A dialect Word, with the dialectal register label and its region, is a Rare Word when a normative dictionary (СУМ, Грінченко) or a dialect dictionary that names the region lists it.
- A place name is not a Word: the policy keeps proper names out of Words, and a place name is an Idiom of Idiom Type `placeName` (above).

## Considered Options

- **Idioms as Words with a part of speech «expression»**: rejected. The alphabet check, the Stress, the Category, the rarity and the Pronunciation button would all lie or need a special case per screen.
- **Idioms as Corrections**: rejected. An idiom has no non-standard form and nothing to correct.
- **A fourth kind of Entry for place names**: rejected. One chip differs; everything else is shared (above).
- **A separate `expressions` table per Idiom Type**: rejected. One table with an `idiom_type` column reads like the Correction's `correction_type`, and the format already rises for the new kind (ADR 0032).
- **Idioms in a Category of the Mix rather than a switch of their own**: rejected. Categories hold Words and reach older apps through a Content update; a whole kind of Entry needs the Feature Switch an Edition or the owner can turn off (ADR 0040).

## Amendment: the build refuses bad Idioms and counts them per Idiom Type (0.8.8, #552)

The Language Pack build refuses:

- an expression not in NFC (the Idiom contract);
- an expression with a character other than the Edition's alphabet in either case, its Lemma punctuation and the space. A Lemma is checked in lower case; an expression keeps its case so the message names the character as written, such as a Latin capital in place of a Cyrillic one;
- a place name without an etymology. The Idiom contract refuses it, as the Word contract refuses a noun without gender, so every reader of an Idiom holds to the rule;
- a live Idiom whose expression, in lower case by the Edition's locale, is another live Idiom's. A Retired Idiom frees its expression, as a Retired Word frees its Lemma and primary Definition.

The content report counts live Idioms, the Retired Idioms left out and the Idioms of each Idiom Type, in the order the contracts list them.
