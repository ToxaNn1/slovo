// The bundled Editions in place of the module Metro writes (see
// metro.config.cjs): the UA Edition alone, its Interface sounds by sound and
// its Starter Media: no Recordings (a test mocks the ones it plays) and the
// Illustrations of its old folder by file name until the cards read them
// through the Core media, as jest-expo stubs them. A test that
// renders a screen opens no Language Pack, so its asset id is never read.
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const dir = join(__dirname, '../../editions/uk');
const illustrations = join(dir, 'assets/illustrations');

module.exports = {
  defaultId: 'uk',
  editions: {
    uk: {
      config: require(join(dir, 'edition.json')),
      strings: require(join(dir, 'strings.json')),
      tokens: require(join(dir, 'tokens.json')),
      decor: require(join(dir, 'decor/decor.json')),
      sounds: Object.fromEntries(
        ['shout', 'right', 'wrong', 'tap'].map((sound) => [
          sound,
          require(join(dir, 'assets/sounds', `${sound}.wav`)),
        ]),
      ),
      starterMedia: {
        recordings: {},
        illustrations: Object.fromEntries(
          readdirSync(illustrations)
            .filter((file) => file.endsWith('.png'))
            .map((file) => [file, require(join(illustrations, file))]),
        ),
      },
      languagePack: 1,
    },
  },
};
