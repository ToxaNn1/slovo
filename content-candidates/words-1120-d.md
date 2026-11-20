# Word candidates 1120-d (letters рстуфхцчшщьюя)

Gathered only: nothing was written to the backend (ADR 0146). The owner says yes to this list first.

## Counts

| step | count |
| --- | --- |
| Lemmas from `source:lemmas` (30 batches of 200, seeds 11201-11230) | 6000 |
| Left out by pattern before reading | 3382 |
| Picked by reading, sent to `source:words` | 406 |
| Ready drafts with one Stress (kept) | 238 |
| Dropped by `source:words` | 168 |

Lists: `scripts/content-wave/lists/words-1120-d-NN.txt`, 15 lines each, `<lemma> <category> <rarity>`.

## Drops by reason

Before reading (pattern filter):

| reason | count |
| --- | --- |
| same root as live content or another candidate | 916 |
| compound/technical | 898 |
| abstract/verbal-noun | 708 |
| place-adjective | 467 |
| adverb-from-adjective | 197 |
| medical/chem-latin | 107 |
| bookish-international | 89 |

By reading: the rest of the 2618 survivors were struck as everyday or obvious words, officialese, technical compounds, medical Latin, slang or dull relative adjectives (2212 Lemmas).

By `source:words`:

| reason | count |
| --- | --- |
| cross-reference (definition only points at another word) | 61 |
| no-entry (no dictionary article) | 40 |
| missing-data (no part of speech or gender) | 22 |
| incomplete draft (other flags: check) | 18 |
| incomplete draft (other flags: stress-unresolved) | 6 |
| incomplete draft (other flags: 1 draft(s), 0 ready) | 5 |
| stress not single | 5 |
| incomplete draft (other flags: stress-unresolved, check) | 3 |
| incomplete draft (other flags: stress-unresolved, other-labels) | 2 |
| incomplete draft (other flags: stress-unresolved, other-labels, check) | 2 |
| incomplete draft (other flags: homonym, needs-assignment, stress-unresolved) | 2 |
| incomplete draft (other flags: homonym, needs-assignment) | 1 |
| incomplete draft (other flags: check, homonym, needs-assignment) | 1 |

## Kept per Category

| category | count |
| --- | --- |
| nature-weather | 61 |
| history-antiquity | 37 |
| household-crafts | 35 |
| arts-culture | 19 |
| old-crafts | 17 |
| language-speech | 14 |
| technology | 11 |
| emotions-character | 11 |
| witty-insults | 10 |
| human-body | 9 |
| military | 7 |
| science | 7 |

## Rarity

| rarity | kept |
| --- | --- |
| 1 | 0 |
| 2 | 19 |
| 3 | 98 |
| 4 | 99 |
| 5 | 22 |

## Rarities moved

- упівголосу 5→3: absent from wordfreq only as a spelling variant; every speaker knows «упівголоса/напівголосу» (not kept: dropped by source:words)
- чудити 5→3: absent from wordfreq, yet every speaker knows «чудити» (to act oddly)
- уламати 5→3: absent, but «уламати когось» (to talk someone round) is everyday speech (not kept: dropped by source:words)
- розладдя 5→3: absent, yet a familiar word for discord in any family talk (not kept: dropped by source:words)
- скупердяга 5→3: absent, but a common jocular word for a miser (not kept: dropped by source:words)
- совістити 5→4: absent, but transparent from «совість» and known to most readers
- цирюльня 5→3: absent, yet known to everyone from fairy tales and history (not kept: dropped by source:words)
- рявкнути 5→3: absent, yet a common verb for a sharp shout (not kept: dropped by source:words)
- рукодільник 5→3: absent, but transparent and familiar (рукоділля)
- радимич 5→4: absent, but known from the school history of East Slavic tribes (not kept: dropped by source:words)
- сінці 5→3: absent as a diminutive, yet «сіни/сінці» is known to every village-born reader (not kept: dropped by source:words)
- сякати 5→3: absent, but an everyday verb (сякати носа)
- сніжистий 5→4: absent, but transparent from «сніг» to any reader (not kept: dropped by source:words)
- шкалик 5→4: absent, yet known from classic prose and folk speech (a small glass of vodka)
- спромагатися 5→3: absent, yet «спромогтися» is in everyday use (not kept: dropped by source:words)
- трефа 5→4: absent, but known to anyone who plays cards
- сконати 5→4: absent, yet a known literary word for dying
- хіхікати 5→3: absent, but an everyday verb for giggling (not kept: dropped by source:words)
- цукровар 5→4: absent, but transparent (цукор + варити) and known from the history of sugar mills
- утерпіти 5→3: absent, yet «не утерпів» is everyday speech
- холодати 5→3: absent, yet «холодає» is heard in every weather talk
- уквітчуватися 5→4: absent, but «уквітчати» is familiar from songs and school poetry (not kept: dropped by source:words)
- шуряк 5→4: absent, but a kinship term many readers still know (wife's brother) (not kept: dropped by source:words)
- розвиднітися 5→3: absent, yet «розвиднілося» is everyday speech (not kept: dropped by source:words)
- стілечки 5→4: absent, but a common colloquial form of «стільки»
- сновигати 5→4: absent, but familiar from classic prose (not kept: dropped by source:words)
- холка 5→4: absent, but known to anyone around horses or dogs (the withers)

## Dropped by `source:words`

смолка, степняк, шкарлупа, щепити, шпіонаж, сизувато, упівголосу, саспенс, фондан, створ, трійник, стевія, райграс, ридма, умилостивити, хуга, цадик, цеховий, шліц, розтаборитися, сальвія, тлумок, торжок, тремпель, уламати, хіджра, ходок, шапокляк, штир, щитомордник, розладдя, скупердяга, спекатися, твань, титулатура, уклякнути, цирюльня, розкуркулити, рявкнути, чотовий, шерег, рант, слизняк, стриножувати, стремено, цуратися, червонець, шпик, радимич, ресентимент, сінці, сікатися, спроквола, тихоня, тілобудова, шкарбун, язичниця, сарматизм, роззява, скувати, сніжистий, таця, тельбух, ухоркувати, шкіц, різнобарв'я, рундучок, сагіб, сутінь, трухніти, царьок, шпонка, юс, ржа, рипатися, сарацин, сливовиця, студит, тітушка, тугодум, штрек, рифт, саронг, селява, спідняк, спромагатися, упротяж, хрущовка, цуг, шипикуватий, розсупонитися, шанець, ренет, рибар, сивіти, удосталь, урозкидку, хіхікати, свашка, рюмсало, топтун, швагер, яремний, сельва, смоківниця, хрущик, чирвовий, шлик, унизати, цюркотіти, уквітчуватися, схаменутися, тріпотіти, трутизна, урозтіч, хлющити, росич, русальний, стакато, філіжанка, шляк, темінь, усач, флячки, шуряк, рогозина, торувати, чепець, щобудня, ржати, топільняк, трояк, цикада, шваґро, фіґлі, шкандибати, рятунок, фірн, цимес, чародійка, штоф, тулитися, флокс, ребе, розвиднітися, сполохати, сьогун, серпокрилець, умить, сновигати, сильфіда, скошлатитися, стіжок, стрибунець, сурмонька, фретка, райдужка, страхоліття, тіснота, хмелівка, честивість, рушничок, теменос, фольксштурм, хрунь, цугцванг, юрбище, шталаг

