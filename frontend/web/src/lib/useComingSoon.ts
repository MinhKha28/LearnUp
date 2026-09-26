import { useCallback, useState } from 'react';

/**
 * For actions of a later milestone that the design already shows (AGENTS.md §14): the control is
 * rendered, and using it shows an info Alert with common:comingSoon in the page's message slot
 * (where error Alerts go), until the next form action hides it.
 *
 * @example
 * const comingSoon = useComingSoon();
 * {comingSoon.isVisible && <Alert tone="info">{t('common:comingSoon')}</Alert>}
 * <Button onClick={comingSoon.show}>…</Button>
 */
export const useComingSoon = () => {
  const [isVisible, setIsVisible] = useState(false);
  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);
  return { isVisible, show, hide };
};
