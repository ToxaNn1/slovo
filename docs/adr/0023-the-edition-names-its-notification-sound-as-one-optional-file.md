# The Edition names its notification sound as one optional file

`notificationSound` in `edition.json` is a fourth kind of thing an Edition supplies, next to Feature Switches, Extension Points and Decor (ADR 0006): a content asset. It is neither Decor, which is vector data the Core draws, nor a Feature Switch, which turns a Core feature on or off. It is a file in the Edition's `assets/` folder, like the icon and the fonts, which the shell bundles and the Core only names. The Edition stays configuration plus content and assets, and a sound is content the Core plays without knowing what it sounds like.

- **One optional value.** The config holds a plain file name ending in `.caf`, `.wav` or `.aiff`, or nothing. The Core's Edition reports that one value, `notificationSound`, and the notification plan carries it to the scheduler adapter as the sound of each notification, `{ file }`. An Edition without one plans the system sound. No second flag says "has a sound" beside the name (ADR 0021's plan sounds: the Edition's own file, the system sound or none).
- **Checked at build time.** iOS falls back to the default sound without a word when a notification's sound is in a format it does not play or runs longer than 30 seconds, so the app config reads the file's header and stops the build instead: the container is WAV, AIFF or CAF and matches the extension, the codec is one iOS plays for notifications (linear PCM, IMA4, µLaw, aLaw) and the sound is at most 30 seconds. A WAV in WAVE_FORMAT_EXTENSIBLE, which is how ffmpeg writes 24-bit linear PCM, is read through its subformat, so it passes when that is one of those codecs.
- **The file reader lives beside the app config.** The header reader is used only by `apps/mobile/app.config.ts`, so it sits next to it (`apps/mobile/notification-sound.ts`) and not in `contracts`, which holds only the schema that shapes the config. No other package needs the reader; if the Language Pack build or another tool ever does, it moves to a shared package then.

## Considered Options

- **A Feature Switch for the sound**: rejected. A switch turns a Core feature on or off, and the sound is a file the Core has no behaviour for.
- **Decor slot**: rejected. Decor is vector motifs drawn by the Core (ADR 0014); a sound is neither.
- **The flag and the file name as a pair**: rejected. The pair could disagree, and the scheduler re-checked what the Core already decided. One optional value cannot.
- **Keep the reader in `contracts`**: rejected. Its only caller is the app config, and `contracts` then holds code nothing shares.
