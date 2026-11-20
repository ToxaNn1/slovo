# Word candidates 1120-a (letters абвг)

Status: STUCK on the context budget after 3 of 20 sourced batches. Nothing was written to the backend (ADR 0146): these lists wait for the owner's yes.

## Counts

- `source:lemmas`: 20 batches of 200 (seeds 1101, 2202 … 20020), letters абвг, rarity shares 3:2,4:2,5:1,2:1, all 45 files of `scripts/content-wave/lists` excluded.
- Picked by hand: 371 Lemmas; struck about 3 600 as everyday (Zipf ≥ 2.8), obvious, officialese, medical Latin, place-name adjectives or technical compounds.
- Struck for a root shared with live content or another candidate: 92 (e.g. абстракціонізм/абстракт, верескун/верескливий, гаркун/гаркнути, бортняк/бортник, гончарити/гончар, гайдамак/гайдамака).
- `source:words` run on batches 1–3 (73 Lemmas): **41 kept** (one ready draft, one Stress), 32 dropped.
- Not sourced yet: 294 picked Lemmas in `content-candidates/words-1120-a-pending.txt` (batches 4–20), ready for `source:words`.

## Drops by `source:words`

| Reason | Count |
| --- | --- |
| no-entry | 12 |
| incomplete-other | 8 |
| cross-reference | 4 |
| stress-unresolved | 3 |
| missing-data | 3 |
| region-missing | 2 |

Dropped: апарель (no-entry), антропоїд (incomplete-other), барабулька (cross-reference), бревіс (no-entry), вартарня (no-entry), ввірувати (incomplete-other), відкараскатися (missing-data), відсапнути (incomplete-other), відьмити (incomplete-other), вмиротвореність (no-entry), галаго (missing-data), геоцентризм (cross-reference), грифель (incomplete-other), анагліф (no-entry), бретель (missing-data), бринза (region-missing), вермільйон (no-entry), вроки (incomplete-other), встик (stress-unresolved), вщерть (stress-unresolved), галс (stress-unresolved), гнозис (no-entry), архистратиг (no-entry), балабол (no-entry), версифікація (cross-reference), воцаріння (cross-reference), гальба (region-missing), гонтар (no-entry), громовладно (no-entry), грузький (incomplete-other), голландка (incomplete-other), безмозкість (no-entry).

## Rarity of the kept Words

| Rarity | Words |
| --- | --- |
| 2 | 4 |
| 3 | 11 |
| 4 | 23 |
| 5 | 3 |

## Rarity moved (kept Words)

- безриб'я 5 → 3: absent from wordfreq, but everyone knows «на безриб'ї і рак риба».
- вава 4 → 3: a nursery word every speaker knows.
- вирувати 4 → 3: common in prose and speech.
- віддячливий 5 → 4: transparent from віддячити.
- віровідступник 5 → 4: transparent compound, known from church language.
- гурчати 5 → 4: understood by an ordinary speaker.
- волюнтарист 5 → 4: known from political vocabulary.

Lists: `scripts/content-wave/lists/words-1120-a-00..02.txt`, 15 lines each (the last one 11).
