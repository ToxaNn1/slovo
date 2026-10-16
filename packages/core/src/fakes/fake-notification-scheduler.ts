import type {
  NotificationPermission,
  NotificationSchedulerPort,
  PlannedNotification,
} from '../ports';

/** A notification scheduler for tests: it keeps the last plan, and the test sets the permission. */
export interface FakeNotificationScheduler extends NotificationSchedulerPort {
  /** The last plan it was given; nothing before the first. */
  readonly plan: readonly PlannedNotification[] | undefined;
  /** Sets the permission it reports, as the reader would in the device's settings. */
  setPermission(permission: NotificationPermission): void;
}

/**
 * A notification scheduler held in memory, for tests. It reports
 * `permission`, and asking turns a permission not asked yet into `answer`.
 */
export function createFakeNotificationScheduler({
  permission = 'allowed',
  answer = 'allowed',
}: {
  permission?: NotificationPermission;
  answer?: Exclude<NotificationPermission, 'not-asked'>;
} = {}): FakeNotificationScheduler {
  let current = permission;
  let plan: readonly PlannedNotification[] | undefined;
  return {
    get plan() {
      return plan;
    },
    setPermission(changed) {
      current = changed;
    },
    permission: () => Promise.resolve(current),
    askPermission() {
      if (current === 'not-asked') current = answer;
      return Promise.resolve(current);
    },
    replacePlan(replaced) {
      plan = [...replaced];
      return Promise.resolve();
    },
  };
}
