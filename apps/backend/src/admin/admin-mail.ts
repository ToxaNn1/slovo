import type { AdminRole, Mail } from '@slovo/server-core';

/** The email that carries an admin sign-in code, in the admin's language (ADR 0088). */
export const adminCodeEmail = (code: string): Omit<Mail, 'to'> => ({
  senderName: 'SLOVO',
  subject: `Код входу в адмінку: ${code}`,
  text: `Ваш код входу в адмінку SLOVO: ${code}\n\nКод діє 10 хвилин.`,
});

/** The notice of an admin invite: the person signs in at the admin with an emailed code. */
export const adminInviteEmail = (role: AdminRole): Omit<Mail, 'to'> => ({
  senderName: 'SLOVO',
  subject: 'Вас запрошено в адмінку SLOVO',
  text: `Вас запрошено в адмінку SLOVO як ${role === 'owner' ? 'Власника' : 'Адміна'}.\n\nВідкрийте /admin, введіть цю адресу і код із листа, тоді налаштуйте застосунок-автентифікатор.`,
});
