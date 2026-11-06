# Pronunciation plays Recordings of Narrator Voices, the device voice as fallback

Pronunciation was the device's voice for the Edition's language, which on many devices is missing or poor for Ukrainian. From spec #1633 Pronunciation plays a pre-generated Recording of a Word in the chosen Narrator Voice, and the device's voice reads a Word without one.

- The Edition config declares its Narrator Voices: id, display name, description, and which is the default (UA: Оксана, Тарас, Марта, Остап; Оксана by default). The Core resolves the chosen voice; without a choice, or with one the Edition no longer declares, the default reads.
- Recordings are generated offline from ukrainian-tts v6.0.0, one mono 24 kHz 48 kbps mp3 per Word per voice, in `assets/recordings/<voice>/<Word id>.mp3` of the Edition. Only Words are recorded: no Corrections, Idioms or Synonym Row members. The mp3 files live in git as plain files, without LFS.
- All voices ship inside the app as JS assets (about 17 MB for 758 Words), the way Illustrations do (ADR 0055), not in the Language Pack (ADR 0032). A Content update carries no audio: its new Words fall back to the device voice until the next app update.
- The Edition build refuses a Recording of a Word id the Edition lacks, a folder of a voice it does not declare and a file that is not an mp3. It does not refuse a Word without a Recording; it reports the count per voice.
- The app plays a Recording through the slice of `expo-audio` the Interface sounds use (ADR 0070), behind the `audio` native-module guard: it does not play in iOS silent mode, mixes with the reader's music and never plays in the background. A binary without the module reads every Word with the device voice.
- One Word is read at a time and a second tap stops it. With «Звуки» off nothing plays. `no-voice` shows only when a Word has no Recording and the device no voice for the language.

## Considered options

- **The device voice alone**: rejected. Many devices have no Ukrainian voice, and the ones that do misplace the Stress.
- **Recordings in the Language Pack**: rejected. It would multiply the size of every Content update by the audio of all voices.
- **Streaming Recordings from a server**: rejected. The app works offline, and the Edition has no audio server.
