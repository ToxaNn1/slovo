// Jest runs the component tests (`*.test.tsx`), on Expo's preset for iOS;
// Vitest runs the rest (ADR 0029).
export default {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  // The package has no Babel config of its own, so Metro never picks one up.
  transform: { '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  resolver: './jest.resolver.cjs',
  setupFiles: ['./jest.setup.js'],
};
