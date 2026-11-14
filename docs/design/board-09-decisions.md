# Board 09 «Збережене і пошук» — owner decisions 14.11 (questions in REPORT.md §9)

1. «Перевір себе» quiz card in «Вчу»: build it (as ADR 0130 Yesterday quiz: right=Known, wrong=Unknown; words due today), new ADR + own Feature Switch; name stays «Перевір себе» (same as the setting is fine).
2. Search: separate screen with «Скасувати» (as now, ADR 0054).
3. Search results: keep kind groups; row look + «ЗНАЙДЕНО» from the board.
4. «ти»: «ПРОДОВЖУЙ ВВОДИТИ», «Дай колекції назву».
5. Single collection as board 09 (list rows + «ПОДІЛИТИСЯ ПОСИЛАННЯМ»); new ADR amends 0082 for collections only.
6. Collections grid: 2 columns, dashed «Нова колекція» first; drop switch collectionBoardStyle in ADR cleanup.
7. Share sheet with «СКОПІЮВАТИ ПОСИЛАННЯ» (expo-clipboard → EAS batch, ADR 0004), link with id (ADR 0058); owner «так» = also keep the system Share.
8. Create/rename: bottom sheet, N/40, shake, СТВОРИТИ/ЗБЕРЕГТИ, toast.
9. Delete: sheet + toast «Колекцію видалено.» + СКАСУВАТИ (3–4 s).
10. Board texts for empty states.
11. Rupor waits (collections) / sleeps (Вчу, search), size 140.
12. «Нічого не знайдено»: XSaved variant.
13. Remove tab underline, list footers, History day split, kind label. «Очистити»: 14.11 ~18:40 owner «я мав на увазі так» = yes to the REPORT proposal: KEEP «Очистити» over recent queries and over History, but smaller (ADR 0054 unchanged).
14. History and Words of the Day: full rows with meaning, date chip right.
15. radii.chip 11.
    Extra: dev-only clock shift via the test-state link (e.g. `?day=monday`), only in **DEV**; warn about sync with a shifted clock.
    Grant: ~/.slovo-coord/grant-saved-1114.md (commit/push/PR/auto-merge on green).

Spec: owner writes it himself via /mattpocock-skills:to-spec (14.11 ~18:40 «Пишу сам»); coordinator waits, then to-tickets → implement-spec.
