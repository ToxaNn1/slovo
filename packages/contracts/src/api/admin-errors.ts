/** What every admin procedure may refuse with. */
export const ADMIN_ERRORS = {
  NOT_FOUND: { message: 'Not found' },
  UNAUTHORIZED: { message: 'No admin session, or the Агент token is unknown or revoked' },
  FORBIDDEN: {
    message:
      'Refused for this caller: an Агент writes content only, an Адмін has no Безпека and no Сервіси, a write needs the admin header',
  },
} as const;
