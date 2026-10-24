// Jest runs the shell's tests that render (`*.test.tsx`), such as its routes
// under expo-router's test renderer, on Expo's preset for iOS; Vitest runs the
// rest (ADR 0029).
export default {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  // The app's Babel config is Metro's own default, so the tests name the same preset.
  transform: { '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  // The preset's patterns, with @noble/hashes, the Core's SHA-256, which ships ES modules only.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble/hashes))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  // A plain view in place of the one native view jest-expo has no double for.
  moduleNameMapper: { '^expo-glass-effect$': '<rootDir>/jest.glass-effect.js' },
  resolver: './jest.resolver.cjs',
  setupFiles: ['./jest.setup.js'],
};
