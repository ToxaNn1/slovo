import { z } from 'zod';

/** How many digits a Sign-in code has. */
export const SIGN_IN_CODE_DIGITS = 6;

/** A Sign-in code as the reader types it: six digits. */
export const SignInCodeSchema = z
  .string()
  .regex(new RegExp(`^[0-9]{${String(SIGN_IN_CODE_DIGITS)}}$`), 'Expected six digits');

/**
 * The email of an Account from what the reader typed: trimmed and lower-cased,
 * so that «Anna@Mail.com » and «anna@mail.com» are one Account, and then an
 * email by Zod's rule.
 */
export const AccountEmailSchema = z.string().trim().toLowerCase().pipe(z.email());
