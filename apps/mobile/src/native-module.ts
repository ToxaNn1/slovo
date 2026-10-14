/** The native modules 0.4 adds, which a dev client built before the batch lacks. */
export type NativeModuleName = 'notifications' | 'timePicker';

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
