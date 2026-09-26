import { beforeEach } from 'vitest';
import { i18n, initI18n } from '@/i18n';

initI18n();

// Every test starts in Vietnamese, whatever a previous test switched to.
beforeEach(async () => {
  if (i18n.language !== 'vi') {
    await i18n.changeLanguage('vi');
  }
});
