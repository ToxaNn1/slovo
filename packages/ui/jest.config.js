// Jest runs the component tests (`*.test.tsx`), on Expo's preset for iOS;
// Vitest runs the rest (ADR 0029).
export default {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  // The package has no Babel config of its own, so Metro never picks one up.
  transform: { '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  // The preset's patterns, with @noble/hashes, the Core's SHA-256, which ships ES modules only.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble/hashes))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  resolver: './jest.resolver.cjs',
  setupFiles: ['./jest.setup.js'],
};
