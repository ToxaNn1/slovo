---
summary: The onboarding runs СЛОВО → ТРИМАЙ! → ГОЛОС → ГРАЙ! → РІВЕНЬ? → НАВІЩО? → ЦІЛЬ → ДЗИНЬ!; «ГОЛОС» picks the Narrator Voice under the Feature Switch `voiceStep`, which depends on `narratorVoice`, and going on or skipping keeps the voice as it is (supersedes the step list of 0067).
---

# The onboarding asks the Narrator Voice after the first Word

Decision of 2026-11-22, the owner's call (design `XObVoice`, «SLOVO Onboarding Voice»).

**Why.** The reader hears the first Word on its card a step earlier, so the voice that reads every Word is best chosen right then, not found later in Settings.

## Decision

The steps, in order, each shown only under its switch: the welcome, the first Word (with a Word of the Day), **«ГОЛОС»** (`voiceStep`), «ГРАЙ!» (`playStep`), «Рівень» and «Навіщо» (`questionnaire`), the Daily Goal (`dailyGoal`), «Коли нагадати?» (`notificationTimeStep`). `ONBOARDING_STEPS` in `@slovo/contracts` is the one list.

«ГОЛОС» shows the Edition's Narrator Voices. A tap chooses the voice, the same setting as Settings › «Голос диктора», and reads the sample Word in it; a voice is chosen also while nothing can sound. «ОБИРАЮ» goes on, and «Пропустити» finishes; neither changes the voice, so a reader who taps nothing keeps the Edition's default. The Core only places the step; the choice is the setting's.

`voiceStep` depends on `narratorVoice`, so the step is never shown while the reader cannot choose a voice.
