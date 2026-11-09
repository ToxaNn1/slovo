import type { FeatureSwitch } from '@slovo/contracts';
import type { AlertThresholdKey } from '@slovo/contracts/admin-api';

import type { AccessWrite, Actor, AdminAccess } from './admin-access';

/** What the owner hears of: a Kill switch at once, the rest from a Cron run. */
export type Alert =
  | {
      /** A feature turned off by the Kill switch. */
      readonly kind: 'kill-switch';
      readonly feature: FeatureSwitch;
      /** The Editions the feature was turned off in. */
      readonly editionIds: readonly string[];
      readonly who: Actor;
      readonly reason: string;
    }
  | {
      /** Crash-free sessions of the last 24 hours, in percent, below the threshold. */
      readonly kind: 'crash-free';
      readonly percent: number;
      readonly threshold: number;
    }
  | {
      /** A Sentry issue first seen in the last hour with the threshold's events or more. */
      readonly kind: 'sentry-issue';
      readonly events: number;
      readonly threshold: number;
    }
  | {
      /** A CI run on `main` with failed tests. */
      readonly kind: 'ci-red';
      readonly runId: number;
      readonly sha: string;
      readonly failedTests: readonly string[];
    }
  | {
      /** The backend's 5xx share of the last 15 minutes, in percent, above the threshold. */
      readonly kind: 'api-errors';
      readonly percent: number;
      readonly threshold: number;
    }
  | {
      /** People active on a Kyiv day, the threshold's percent or more below the 7 days before. */
      readonly kind: 'activity-drop';
      readonly day: string;
      readonly active: number;
      readonly average: number;
      readonly threshold: number;
    }
  | {
      /** The backend's health check does not answer. */
      readonly kind: 'backend-down';
    }
  | {
      /** An open batch of the content queue with more records than the threshold. */
      readonly kind: 'batch-size';
      readonly batchId: string;
      readonly editionId: string;
      readonly records: number;
      readonly threshold: number;
    };

/** Tells the owner of an Alert at once (Telegram in the backend). */
export interface Alerts {
  send(alert: Alert): Promise<void>;
}

/** The numbers of the daily digest at 09:00 Kyiv, of yesterday's Kyiv day. */
export interface Digest {
  readonly day: string;
  /** People active, or `null` while PostHog can't answer. */
  readonly active: number | null;
  readonly visits: number | null;
  /** Crashed sessions of the last 24 hours, or `null` while Sentry can't answer. */
  readonly crashes: number | null;
  /** The newest CI run on `main` of the last 7 days. */
  readonly lastCi: {
    readonly sha: string;
    readonly at: Date;
    readonly failedTests: number;
  } | null;
  readonly openBatches: number;
  readonly openRecords: number;
}

/** A message to the owner's chat. */
export type OwnerMessage =
  { readonly kind: 'alert'; readonly alert: Alert } | { readonly kind: 'digest'; readonly digest: Digest };

/** The owner's Telegram chat: answers whether the message left. */
export interface OwnerChat {
  send(message: OwnerMessage): Promise<boolean>;
}

/** An alert kept for Огляд, with when the owner was told of it. */
export interface KeptAlert {
  readonly id: number;
  readonly at: Date;
  readonly alert: Alert;
  readonly sentAt: Date | null;
}

/** The alerts and digests fired, kept by the backend. */
export interface AlertStore {
  /** Keeps the alert; `null` when an alert of the key is kept already. A `null` key is never a repeat. */
  keep(alert: Alert, at: Date, key: string | null): Promise<number | null>;
  markSent(id: number, at: Date): Promise<void>;
  /** The alerts kept since `since` the owner was not told of yet, oldest first. */
  unsent(since: Date): Promise<readonly KeptAlert[]>;
  /** The newest alerts, at most `limit`, newest first. */
  latest(limit: number): Promise<readonly KeptAlert[]>;
  /** Whether the digest of the Kyiv day was sent. */
  digestSent(day: string): Promise<boolean>;
  keepDigest(day: string, at: Date): Promise<void>;
}

/** The thresholds of Round 14, 5A, and the activity drop in percent. */
export const ALERT_THRESHOLD_DEFAULTS: Readonly<Record<AlertThresholdKey, number>> = {
  crashFree: 99.5,
  issueEvents: 10,
  apiErrors: 2,
  batchRecords: 200,
  activityDrop: 50,
};

export type AlertThresholds = Readonly<Record<AlertThresholdKey, number>>;

/** The thresholds the owner changed, kept by the backend. */
export interface AlertThresholdStore {
  changed(): Promise<Partial<Record<AlertThresholdKey, number>>>;
  set(key: AlertThresholdKey, value: number): Promise<void>;
}

/** The alert thresholds, and their changes logged in the Action log. */
export interface AlertSettings {
  thresholds(): Promise<AlertThresholds>;
  set(key: AlertThresholdKey, value: number, write: AccessWrite): Promise<void>;
}

export function createAlertSettings({
  store,
  admin,
}: {
  store: AlertThresholdStore;
  admin: Pick<AdminAccess, 'log'>;
}): AlertSettings {
  const thresholds = async () => ({ ...ALERT_THRESHOLD_DEFAULTS, ...(await store.changed()) });
  return {
    thresholds,
    async set(key, value, { who, reason }) {
      const before = (await thresholds())[key];
      await store.set(key, value);
      await admin.log({
        who,
        what: 'alert-threshold.set',
        before: { key, value: before },
        after: { key, value },
        reason,
        editionId: null,
        batchId: null,
      });
    },
  };
}
