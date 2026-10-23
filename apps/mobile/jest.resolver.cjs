// React Native's resolver, from the preset, lets Jest mock React Native's
// subpaths. Worklets' resolver loads the web builds of Worklets and of
// Reanimated over it, since a test has no native runtime. Jest takes one
// resolver, so this one chains them. Worklets' resolver would drop the native
// files of any folder whose path names Worklets, which pnpm's store does for
// each package that has Worklets as a peer, such as Expo's modules; so only
// the requests of those two libraries go through it.
const reactNative = require('@react-native/jest-preset/jest/resolver');
const worklets = require('react-native-worklets/jest/resolver');

const webBuilt = ['react-native-worklets', 'react-native-reanimated'];
const isWebBuilt = (request, { basedir }) =>
  webBuilt.some((name) => request.startsWith(name) || basedir.includes(`/node_modules/${name}/`));

module.exports = (request, options) => {
  const resolve = (path, own) =>
    reactNative(path, { ...own, defaultResolver: options.defaultResolver });
  return isWebBuilt(request, options)
    ? worklets(request, { ...options, defaultResolver: resolve })
    : resolve(request, options);
};
