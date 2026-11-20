import { setupI18n } from '@lingui/core';

export const i18n = setupI18n({
  locale: 'en',
  messages: { en: {} },
  missing: (_locale, message) => message,
});
