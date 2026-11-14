// React Native's resolver, from the preset, lets Jest mock React Native's
// subpaths. Reanimated's resolver loads the web builds of Worklets and of the
// few Reanimated modules that need one, since a test has no native runtime;
// the rest of Reanimated keeps its native files. Jest takes one resolver, so
// this one chains them.
//
// Reanimated's and Worklets' resolvers tell a library's own files by its name
// in the folder path, and pnpm's store names a package's folder after its
// peers too (`react-native-reanimated@…_react-native-worklets@…`, and so for
// each of Expo's modules), which would send every such package to its web
// build. So their checks see the path with the store's folder names hidden,
// while the file itself resolves from the real one.
//
// Both resolvers are dependencies of the package that runs the tests, so they
// load from its Jest root, not from this folder.
const fromHost = (rootDir, name) => require(require.resolve(name, { paths: [rootDir] }));

const storeFolder = /\/\.pnpm\/[^/]+\//g;

module.exports = (request, options) => {
  const reactNative = fromHost(
    options.rootDir ?? options.basedir,
    '@react-native/jest-preset/jest/resolver',
  );
  const reanimated = fromHost(
    options.rootDir ?? options.basedir,
    'react-native-reanimated/jest/resolver',
  );
  return reanimated(request, {
    ...options,
    basedir: options.basedir.replace(storeFolder, '/.pnpm/store/'),
    defaultResolver: (path, own) =>
      reactNative(path, {
        ...own,
        basedir: options.basedir,
        defaultResolver: options.defaultResolver,
      }),
  });
};
