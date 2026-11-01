import { z } from 'zod';

import { declareRecord } from '../user-state/user-state-record';

/** The record that marks the user state as kept by this install of the app. */
export const INSTALLED_KEY = 'app.installed';

/** The records of the Account. */
export const accountRecords = {
  /**
   * That this install of the app has opened its Account. Deleting the app
   * deletes the user state but, on iOS, not the Session in the Keychain, so
   * an Account that opens without the marker forgets a Session it finds
   * (#660). It stays on the device.
   */
  installed: declareRecord(INSTALLED_KEY, z.literal(true), { sync: 'device-only' }),
};
