# Words 1120-b: candidates (STUCK, not sourced)

Letters ґдеєжзиіїйк. Nothing written to the backend (ADR 0146).

## State

- source:lemmas: 52 batches of 200 (seeds 1101-1152, each excluding the words500 lists and earlier batches); the r2-r4 pool for these letters is used up, only r5 remains.
- Picked by hand: 336 candidates in `words-1120-b-unsourced.txt` (Category and rarity filled). Not yet run through source:words: the run was stopped at the background time limit before it wrote drafts, and the session reached its context limit.
- No `words-1120-b-NN.txt` lists yet: they need ready drafts with one Stress.

## Drops

- Everyday or obvious, officialese, medical Latin, technical compounds, place-name adjectives: most of about 10,400 picked lemmas (not counted one by one).
- Same root as live content or another candidate: 35, listed below.

- здоровай same-root здоровань
- іпохондрія same-root іпохондрик
- крутіж same-root крутій
- дрань same-root дранка
- зернь same-root зерня
- ірмологіон same-root ірмос
- жниварка same-root жниво
- жорно same-root жорна
- кріпаччина same-root кріпак
- криж same-root крижі
- інак same-root інакодумство(candidate)
- дереворит same-root дереворіз
- дерть same-root дерти
- довгоносик same-root довгоносий
- дрючок same-root дрюк
- зверхник same-root зверхній
- кизильник same-root кизил
- кобзарство same-root кобза
- коминок same-root комин
- коструб same-root кострубатий
- єгермейстер same-root єгер
- кляшторний same-root кляштор(candidate)
- жакард same-root жакардовий
- жовно same-root жовна
- зайдиголова same-root зайда
- запліт same-root заплітати
- кошикарство same-root кошикар
- куман same-root куманець
- єпарх same-root єпархіальний
- досадливий same-root досада
- дуплястий same-root дупло
- журний same-root жура
- комонний same-root комонник
- жлуктити same-root жлукто
- ґаздувати same-root ґазда

## Rarity moved

- довгаль 2→4, калуга 2→4, дудник 2→4: Zipf inflated by a surname or a place name.
- крилос 2→3, елінг 2→3, карб 2→3, крайка 2→3, зірниця 2→3, дячок 2→3, екзархат 2→3, кабала 2→3, камергер 2→3, каптур 2→3, клекіт 2→3, коршак 2→3, куделя 2→3, курдупель 2→3, ґміна 2→3, дереза 2→3: unknown to an ordinary speaker despite the Zipf.
- дзбан 4→3, крашанка 4→3, кряква 4→3: known to an ordinary speaker.
- доходяга, зарізяка, дрімайло, забувака, жакард, жеруха, камеристка, капельдинер, креманка, кринолін 5→4; квиліти, кмітити, каменіти, красуватися, дуркувати 5→4: absent from wordfreq but an ordinary speaker knows them.

## Next

Run `pnpm source:words content-candidates/words-1120-b-unsourced.txt --edition uk --snapshot <snapshot>` in the foreground or with a long timeout (about 40 min for goroh), keep only ready drafts with one Stress, drop кляшторний-type duplicates, and write the 15-line lists.
