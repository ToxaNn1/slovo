---
summary: The Recordings job records every live Word in the default Narrator Voice only and in the other voices only for the Words an Admin user asked for in the admin; the admin shows each Word's Recordings and an «Додати інші голоси» button; behind `recordedOnly` the app never reads a Word in the device voice: a Word without a Recording in the chosen voice shows a disabled sound button whose tap says why (amends 0099).
---

# One Narrator Voice records every Word, the others on request

Owner decision of 2026-11-19. This ADR amends ADR 0099 (which voices the Recordings job records, and the device voice as the stand-in).

**Why.** Four voices for every Word cost four times the generation on Railway and the room in the Media Store, while most readers keep the default voice. The owner wants one voice for every Word and the other voices only for Words he chooses. The device voice, which reads a Word with no Recording, sounds unlike any Narrator Voice and hides that a Recording is missing.

## Decision

- **The job.** The hourly Recordings job records every live Word in the Edition's default Narrator Voice (UA: Оксана). It records a Word in the other declared voices only when the Word is on the Edition's list of **Words in all voices**, kept by the backend (not content: no Patch carries it). The Edition's sample Word is always on the list. Recording Kinds stay as they are.
- **The list.** An Admin user (Власник or Адмін, not Агент) adds a Word from the admin; the request stays, so a later change of the Lemma or Stress records it again in every voice. The migration that adds the list puts on it every Word that has a live Recording in a voice other than the default, so no existing Recording is retired or deleted.
- **The admin.** The Words list shows each Word's live Recordings as «N з M» (M the declared voices) and filters by it. A Word with fewer than M has «Додати інші голоси»: one confirmation, no reason, an Action log row; the next run of the job records the missing ones. The procedure answers a Word not live, or one already on the list, with a refusal.
- **The app, behind `recordedOnly`** (needs `pronunciation`). The device voice never reads a Word. The sound button of a Word card, an Entry details screen and every other place that plays a Recording takes one of three states for the chosen Narrator Voice: a Recording exists (plays as today); the Word has Recordings but none in the chosen voice (disabled, a tap shows «У голосі {voice} цього слова ще немає»); the Word has no Recording at all (disabled, a tap shows «Поки що немає озвучки для цього слова»). The texts are the Edition's strings. Offline, a Recording not yet cached does not play and a tap says «Немає з’єднання: озвучка не завантажилась». With the switch off the app behaves as before, the device voice included.
- **Starter Media** stay as ADR 0099 has them: the default voice, and the sample Word in every voice.

## Consequences

- Generation and storage drop to about a quarter for new Words.
- A reader who chose a voice other than the default sees most new Words disabled until the owner adds that voice to them; the tap text tells why.
- The glossary's Pronunciation changes: the device's voice reads only while `recordedOnly` is off.
