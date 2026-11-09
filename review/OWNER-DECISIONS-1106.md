# Owner decisions on the global review (REPORT.md), 06.11 ~23:05
1. content-C1/H2 test Curated Collections cc_test1..4: «нехай будуть» — leave as they are, do nothing now.
2. docs-H1: owner adds «Commit messages» as a required check in the main ruleset himself (steps given).
3. content-H3 {CONTACT} in legal/: skipped for now (decide later, before release).
4. content-H6: OK — ADR: short dictionary quotes (≤ one sentence) with the source named; a «Sources» section in legal/terms.md; for modern authors in Examples prefer an own sentence over a quote.
5. ui-M1: OK — a separate darker `accentText` token for small red text only; large red elements stay as on the boards.
6. core-a-entries-M3 / core-a-feed-M1: OK — links obey Hidden and the Mix: a Hidden Entry is never reachable, not even via a Word card link.
7. docs-M5 «SLOVO ID»: «нехай буде» — keep the name; remove it from _Avoid_ in CONTEXT.md (glossary change, not code).
When: implement after #1640, #1639 and content wave 2 are in main; owner runs his own Fable review then. No fixes before.

08.11 owner DONE item 2 (docs-H1): «Commit messages» added as a required check in ruleset 26239313 (verified via gh api, GitHub Actions 15368).
- 08.11 ~20:30 owner on onAccent (3.27:1 white on red buttons): «А» = keep as on the boards, no change (large bold text, 3:1 rule).
- 08.11 ~20:30 owner on long dictionary quotes (524/1223 etymologies > one sentence): «А» = a separate content ticket shortens them to one sentence with the source named (owner writes it via his spec skill; coc drafts the brief).
