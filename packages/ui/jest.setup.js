// The test doubles Gesture Handler and Reanimated ship for Jest.
import 'react-native-gesture-handler/jestSetup';
import * as ReactNative from 'react-native';
import * as ReactNativePrivate from 'react-native/Libraries/ReactPrivate/ReactNativePrivateInterface';
import { setUpTests } from 'react-native-reanimated';

setUpTests();

// React Native requires most of its modules on first use, so a test file's
// first render would compile them, Babel on a cold cache, inside that test's
// time limit: on a busy CI runner that alone went past Jest's 5 s. Load here
// what a sheet's first render needs: the components and hooks it uses, and
// the public instance the renderer makes when Gesture Handler asks for a
// view's tag.
void [
  ReactNative.Modal,
  ReactNative.KeyboardAvoidingView,
  ReactNative.useWindowDimensions,
  ReactNative.AccessibilityInfo,
  ReactNativePrivate.getNativeTagFromPublicInstance,
];
