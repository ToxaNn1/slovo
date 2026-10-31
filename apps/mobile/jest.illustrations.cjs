// The Illustrations of the UA Edition in place of the module Metro
// writes (see metro.config.cjs): each PNG by file name, as jest-expo stubs it.
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const dir = join(__dirname, '../../editions/uk/assets/illustrations');

module.exports = Object.fromEntries(
  readdirSync(dir)
    .filter((file) => file.endsWith('.png'))
    .map((file) => [file, require(join(dir, file))]),
);
