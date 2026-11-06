// The bundled Editions in place of the module Metro writes (see
// metro.config.cjs): the UA Edition alone, its Illustrations each PNG by file
// name, its Interface sounds by sound and its Recordings by voice and Word id,
// as jest-expo stubs them. A test that
// renders a screen opens no Language Pack, so its asset id is never read.
const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const dir = join(__dirname, '../../editions/uk');
const illustrations = join(dir, 'assets/illustrations');
const recordings = join(dir, 'assets/recordings');

module.exports = {
  defaultId: 'uk',
  editions: {
    uk: {
      config: require(join(dir, 'edition.json')),
      strings: require(join(dir, 'strings.json')),
      tokens: require(join(dir, 'tokens.json')),
      decor: require(join(dir, 'decor/decor.json')),
      illustrations: Object.fromEntries(
        readdirSync(illustrations)
          .filter((file) => file.endsWith('.png'))
          .map((file) => [file, require(join(illustrations, file))]),
      ),
      sounds: Object.fromEntries(
        ['shout', 'right', 'wrong', 'tap'].map((sound) => [
          sound,
          require(join(dir, 'assets/sounds', `${sound}.wav`)),
        ]),
      ),
      recordings: Object.fromEntries(
        (existsSync(recordings) ? readdirSync(recordings) : []).map((voice) => [
          voice,
          Object.fromEntries(
            readdirSync(join(recordings, voice))
              .filter((file) => file.endsWith('.mp3'))
              .map((file) => [
                file.slice(0, -'.mp3'.length),
                require(join(recordings, voice, file)),
              ]),
          ),
        ]),
      ),
      languagePack: 1,
    },
  },
};
