// React Native's resolver, from the preset, lets Jest mock React Native's
// subpaths. Worklets' resolver loads its web build, since a test has no native
// runtime. Jest takes one resolver, so this one chains them.
const reactNative = require('@react-native/jest-preset/jest/resolver');
const worklets = require('react-native-worklets/jest/resolver');

module.exports = (request, options) =>
  worklets(request, {
    ...options,
    defaultResolver: (path, own) =>
      reactNative(path, { ...own, defaultResolver: options.defaultResolver }),
  });
