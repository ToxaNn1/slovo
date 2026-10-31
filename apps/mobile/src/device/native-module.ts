/**
 * The native modules a batch adds (0.4: notifications and the time picker;
 * 0.6: the widget's and the Share Card's view capture, and the file system
 * that content updates keep a downloaded pack with; 0.7: the Keychain that
 * keeps the Session; 0.8.9: Google's sign-in SDK; 0.8.15: the app's own
 * Spotlight module; 0.9: Expo's Apple authentication module, and the
 * application and updates modules About reports the build with), which a
 * dev client built before that batch lacks.
 */
export type NativeModuleName =
  | 'notifications'
  | 'timePicker'
  | 'widget'
  | 'shareCapture'
  | 'contentUpdates'
  | 'keychain'
  | 'googleSignIn'
  | 'appleSignIn'
  | 'application'
  | 'updates'
  | 'spotlight';

/** How to tell whether the installed binary has each native module. A probe may throw. */
export type NativeModuleProbes = Record<NativeModuleName, () => boolean>;

export interface NativeModules {
  /** Whether the installed binary has the module. Never throws. */
  has(name: NativeModuleName): boolean;
  /**
   * What `require` returns for the module's JavaScript, or undefined when the
   * binary lacks the module or its JavaScript fails to load. Call this where
   * the module is used, and import it nowhere else: a static import of a
   * module the binary lacks stops the app at start.
   */
  load<T>(name: NativeModuleName, require: () => T): T | undefined;
}

/**
 * The module-presence helper: the shell asks it before it touches a native
 * module, so a dev client without the module still starts and the feature
 * that needs the module stays off. Each module is probed once.
 */
export function createNativeModules(probes: NativeModuleProbes): NativeModules {
  const present = new Map<NativeModuleName, boolean>();

  function has(name: NativeModuleName): boolean {
    let known = present.get(name);
    if (known === undefined) {
      try {
        known = probes[name]();
      } catch {
        known = false;
      }
      present.set(name, known);
    }
    return known;
  }

  return {
    has,
    load(name, require) {
      if (!has(name)) return undefined;
      try {
        return require();
      } catch {
        return undefined;
      }
    },
  };
}
