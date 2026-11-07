import { jest } from '@jest/globals';
// The test doubles Gesture Handler and Reanimated ship for Jest.
import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';

// Worklets' own test double: its web build throws where Gesture Handler 3
// asks for the UI runtime.
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);

setUpTests();

// expo-sqlite's key-value store opens a native database that jest-expo's mock
// of ExpoSQLite cannot build ("NativeDatabase is not a constructor"); this one
// keeps the app-level store in memory for the test file.
jest.mock('expo-sqlite/kv-store', () => {
  const items = new Map();
  return {
    Storage: {
      getItemSync: (key) => items.get(key) ?? null,
      setItemSync: (key, value) => {
        items.set(key, value);
      },
    },
  };
});
