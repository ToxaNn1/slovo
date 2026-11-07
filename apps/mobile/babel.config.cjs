/** Expo's preset, plus a fix for a Hermes parser bug: see `babel/hermes-async-arrow-rest.cjs`. */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [require('./babel/hermes-async-arrow-rest.cjs')],
  };
};
