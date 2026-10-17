/**
 * The ports of the server Core: what its modules need from the world, which
 * the backend's adapters give. Modules take them in an object of dependencies,
 * so a test gives its own.
 */

/** The current time, injected so the rules that read it stay testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
