// Jest runs the component tests (`*.test.tsx`), on Expo's preset for iOS;
// Vitest runs the rest (ADR 0029).
import { jestReports } from '@slovo/config/test-reports';

export default {
  ...jestReports,
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  // The package has no Babel config of its own, so Metro never picks one up.
  transform: { '\\.m?[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  // The preset's patterns, with @noble/hashes, the Core's SHA-256, and oRPC's client with rou3,
  // which the Core loads for its Backend port (ADR 0064); they ship ES modules only.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble/hashes|@orpc|rou3))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  resolver: './jest.resolver.cjs',
  setupFiles: ['./jest.setup.js'],
  // Half the cores, beside Vitest and the other packages turbo runs at once, and a worker
  // past 1 GB is restarted between files, so a run on a loaded machine does not time out.
  maxWorkers: '50%',
  workerIdleMemoryLimit: '1GB',
};
