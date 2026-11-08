import type { Mail } from '@slovo/server-core';

/** The email that carries an admin sign-in code, in the admin's language (ADR 0088). */
export const adminCodeEmail = (code: string): Omit<Mail, 'to'> => ({
  senderName: 'SLOVO',
  subject: `Код входу в адмінку: ${code}`,
  text: `Ваш код входу в адмінку SLOVO: ${code}\n\nКод діє 10 хвилин.`,
});
