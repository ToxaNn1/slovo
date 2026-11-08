import type {
  AnalyticsSink,
  Account,
  Backend,
  Clock,
  Composition,
  CounterReads,
  Edition,
  MistakeReports,
  openCounterSending,
  openRemoteSwitches,
  Random,
  Schedule,
  Settings,
  Sync,
  TrackedUserState,
  UserSettings,
} from '@slovo/core';
import type { PackReader } from '@slovo/language-pack/reader';
import type { ShareCardFormat, ShareSheetOutcome } from '@slovo/ui';
import { createContext, useContext, type ReactNode } from 'react';
import type { HostInstance } from 'react-native';

import type { LaunchPack } from './content-update/launch-pack';
import type { Opening } from './opening';

/** The remote Feature Switches over the Edition the app ships. */
export type EditionSwitches = Awaited<ReturnType<typeof openRemoteSwitches<Edition>>>;

/** The Core's sending of the Community Counters. */
export type CounterSending = Awaited<ReturnType<typeof openCounterSending>>;

/** What the Shell opens the device ports over: the device's own, or a test's fakes. */
export interface DeviceSources {
  readonly backend: Backend;
  readonly clock: Clock;
  readonly schedule: Schedule;
  readonly random: Random;
  readonly userState: Opening<TrackedUserState>;
}

/**
 * The one set of device ports every opening apart from the remote Feature
 * Switches opens over, built once by the Shell and named as the Core's
 * openings name them, so each takes it as it is.
 */
export interface DevicePorts extends Omit<DeviceSources, 'userState'> {
  readonly userState: TrackedUserState;
  /**
   * The Edition in effect, remote switches included (ADR 0040): the one of
   * the last change when read, and each of them reads the last answer
   * whenever it is asked.
   */
  readonly edition: Edition;
  /**
   * Where the Analytics events go, with the Install id and Variants they
   * carry (ADR 0068, 0089); none while the remote switches can't be opened.
   */
  readonly analytics?: AnalyticsSink;
}

/** The settings and those in effect when they opened. */
export interface OpenedSettings {
  readonly settings: Settings;
  readonly current: UserSettings;
}

/** Shares a Share Card drawn in `view`, named by what it shows, through the iOS share sheet. */
export type ShareCard = (
  view: HostInstance,
  cardId: string,
  format: ShareCardFormat,
  onShared: () => void,
) => Promise<ShareSheetOutcome>;

/**
 * What the shell opens once per app run and every screen shares (ADR 0036):
 * each resource as its Opening, and the device's Share Card capture. One
 * value, built once (`createShell`) and handed down by `ShellProvider`; a
 * screen reads it with `useShell`, and a test hands a route one of its own.
 */
export interface Shell {
  /** The user state, which every other opening opens over. */
  readonly userState: Opening<TrackedUserState>;
  readonly settings: Opening<OpenedSettings>;
  readonly remoteSwitches: Opening<EditionSwitches>;
  readonly languagePack: Opening<LaunchPack<PackReader>>;
  readonly composition: Opening<Composition>;
  /** Undefined when the Edition has no Account (ADR 0037). */
  readonly account: Opening<Account> | undefined;
  /** Undefined when the Edition has no Account or no Sync. */
  readonly sync: Opening<Sync> | undefined;
  readonly mistakeReports: Opening<MistakeReports>;
  readonly counterReads: Opening<CounterReads>;
  readonly counterSending: Opening<CounterSending>;
  /** Undefined when the binary can't capture a view, so no share button shows. */
  readonly shareCard: ShareCard | undefined;
}

const ShellContext = createContext<Shell | undefined>(undefined);

/** Hands the Shell to every screen under it. */
export function ShellProvider({ shell, children }: { shell: Shell; children: ReactNode }) {
  return <ShellContext value={shell}>{children}</ShellContext>;
}

/** The Shell of the app run, or the one a test hands its route. */
export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (shell === undefined) throw new Error('useShell needs a ShellProvider above it');
  return shell;
}
