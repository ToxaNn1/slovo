import type { Random } from '../ports';
import type { UserState } from '../user-state/user-state';
import { editionRecords } from './records';

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 20;

/**
 * The Install id of the device (ADR 0089): its own random name, made from
 * `random` on the first launch and kept in a device-only record, so every
 * later launch reads the same one. The switch evaluator hashes it with a Rule
 * id to pick the device's share and Variant; nothing sends it off the device.
 */
export async function readInstallId({
  userState,
  random,
}: {
  userState: UserState;
  random: Random;
}): Promise<string> {
  const kept = await userState.read(editionRecords.installId);
  if (kept !== undefined) return kept;
  const made = Array.from(
    { length: ID_LENGTH },
    () => ID_ALPHABET[Math.floor(random.next() * ID_ALPHABET.length)],
  ).join('');
  await userState.write(editionRecords.installId.change(made));
  return made;
}
