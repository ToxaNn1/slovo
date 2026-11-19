---
summary: Word candidates for a content wave come from `pnpm source:lemmas`, with no language model: the Lemma forms of LanguageTool's `morfologik-ukrainian-lt` (LGPL 2.1+, built from dict_uk) and `wordfreq` (`uk`) on the rarity bands of 0146, both pinned by version and SHA-256 and downloaded into the sourcing cache at run time, never committed; the dict_uk data itself (CC BY-NC-SA) is not used; nothing of the list ships, it only picks Lemmas.
---

# Word candidates come from an LGPL headword list

Owner decision of 2026-11-19 (ticket #1119).

**Why.** A wave of 1000+ Words had its Lemmas picked by an agent from memory: tokens spent on picking, repeats of live Words, and no control over the rarity mix. An open headword list with parts of speech and tags, filtered by a script, picks them for free and the same way every time.

## Decision

- `pnpm source:lemmas` picks Word candidates and writes a Lemma list in the `source:words` format. No language model takes part in picking.
- **The headword list** is `ukrainian.dict` from LanguageTool's `morfologik-ukrainian-lt` on Maven Central, pinned to a version and its SHA-256. It is built from dict_uk (ВЕСУМ) by the same authors and is published under the **LGPL 2.1 or later**, which allows any use, commercial included.
- **Not the dict_uk data.** dict_uk's own data files are under CC BY-NC-SA 4.0. SLOVO is a paid product, so even an internal use to pick Lemmas could count as commercial; the tool does not read them.
- **Rarity** is the Zipf of the Lemma in `wordfreq` (`uk`, `large_uk`, version pinned) on the bands of ADR 0146; candidates are of rarity 2 to 5.
- **Never in the repo.** Both files are downloaded at run time into the sourcing cache. Nothing of the headword list is shipped or quoted: it only decides which Lemmas a writer drafts, and every Entry's text stays the Edition's own (ADR 0146).
