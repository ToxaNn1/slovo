---
summary: Грінченко's «Словарь української мови» (1907–1909, public domain) is a Word source, read from our own OCR of the archive.org scan, pinned by SHA-256 and kept in the sourcing cache, never committed; `source:lemmas --from hrinchenko` takes its headwords that the modern headword list still has, and `source:words` drafts a Lemma no explanatory dictionary has from its article as a basis flagged `write-fresh`, never quoting its Russian gloss (amends 0196).
---

# Грінченко is a Word source

Owner decision of 2026-11-26 (ticket #1126, Step 2 of `docs/research/1126-word-sources.md`).

**Why.** The modern headword list of ADR 0196 is nearly spent on rare Words with a СУМ article. Грінченко lists some 68,000 words of the living folk language, many of them the rare Words the collection is after, and the glossary already counts it among the normative dictionaries that prove a Rare Word. It is in the public domain: Борис Грінченко died in 1910.

## Decision

- **The text** is our own OCR (Tesseract, `ukr+rus`) of the University of Toronto scan of the 1909 printing on archive.org (`slovarukranskomo01hrin`, `slovarukranskomo02hrin`), each PDF pinned by its SHA-256. `pnpm source:hrinchenko` downloads them once into the sourcing cache and keeps one article per line, `<headword>\t<gloss>\t<sigla>`. Nothing of it is committed or shipped. No site's lookups are scraped (hrinchenko.com, r2u's `/s`), and no third-party conversion of the text is used.
- **Membership proves a Rare Word.** `pnpm source:lemmas --from hrinchenko` keeps only the Lemmas of ADR 0196's headword list that Грінченко has. So a candidate is spelled as today's orthography spells it and is still a modern Lemma; an OCR misreading never becomes one. Rarity, the parts of speech and the exclude lists work as in ADR 0196.
- **A second basis for drafts.** `source:words` still drafts from goroh's explanatory dictionaries first and СУМ-11 second. Only when neither has the Lemma does it draft from Грінченко: the part of speech and a noun's gender from the article's label, Грінченко as the Source, and no Definition. The draft stays incomplete, flagged `write-fresh` with the article and its sigla: the writer writes the Definition fresh and proves it in a normative dictionary.
- **Its Russian gloss is a basis, never quoted.** A folklore Example in the article may be an Example lead; it is folk text in the public domain under ADR 0146, checked against the page scan before it is used.

## Consequences

- This amends ADR 0196: a second headword list, and drafts no longer come only from explanatory dictionaries.
- Building the index takes about two hours of OCR, once per machine, and needs Poppler and Tesseract with the `ukr` and `rus` models.
- Желехівський may join as a second public-domain dictionary once the owner accepts it as a proving dictionary.
