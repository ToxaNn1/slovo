// The bundled Editions in place of the module Metro writes (see
// metro.config.cjs): the UA Edition alone, its Interface sounds by sound and
// its Starter Media: none (a test mocks the Recordings it plays and gives a
// card the Illustrations it draws). A test that
// renders a screen opens no Language Pack, so its asset id is never read.
const { join } = require('node:path');

const dir = join(__dirname, '../../editions/uk');

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
      starterMedia: {},
      starterWords: [],
      languagePack: 1,
    },
  },
};
