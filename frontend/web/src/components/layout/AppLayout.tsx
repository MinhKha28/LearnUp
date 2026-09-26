import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, Menu, X } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { getHomePath, getNavSections } from '@/app/navigation';
import { LOGIN_PATH } from '@/config/routes';
import { IconButton } from '@/components/ui/IconButton';
import { Sidebar } from './Sidebar';
import { SidebarCollapseProvider } from './SidebarCollapseProvider';
import { useSidebarCollapse } from './sidebarCollapse';
import { MAIN_CONTENT_ID, SkipLink } from './SkipLink';
import { UserMenu } from './UserMenu';
import styles from './AppLayout.module.css';

/** docs/design-tokens.md §6: at lg (1024px) and up the sidebar is fixed, below it is a drawer. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const AppShell: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { collapsed, toggle } = useSidebarCollapse();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // The drawer has no place on a desktop-width screen: close it if the window grows past lg
  useEffect(() => {
    if (!isDrawerOpen || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(DESKTOP_QUERY);
    const closeOnDesktop = () => {
      if (query.matches) setIsDrawerOpen(false);
    };
    query.addEventListener('change', closeOnDesktop);
    return () => query.removeEventListener('change', closeOnDesktop);
  }, [isDrawerOpen]);

  const sections = currentUser ? getNavSections(currentUser.role) : [];
  const homePath = currentUser ? getHomePath(currentUser.role) : LOGIN_PATH;
  // TODO: organizationName stays empty until /api/users/me returns it
  const organizationName = currentUser?.organizationName || t('appName');
  // Admins belong to no organization: they manage the platform itself
  const headerTitle =
    currentUser?.role === 'ADMIN' ? t('layout.platformAdministration') : organizationName;
  const closeDrawer = () => setIsDrawerOpen(false);

  return (
    <div className={styles.shell} data-sidebar-collapsed={collapsed || undefined}>
      <SkipLink />

      <aside className={styles.sidebar}>
        <Sidebar
          sections={sections}
          homePath={homePath}
          collapsed={collapsed}
          onToggleCollapse={toggle}
        />
      </aside>

      <Dialog.Root open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <div className={styles.main}>
          <header className={styles.header}>
            <Dialog.Trigger asChild>
              <IconButton
                aria-label={t('layout.openMenu')}
                icon={<Menu />}
                className={styles.menuButton}
              />
            </Dialog.Trigger>
            <p className={styles.organization}>{headerTitle}</p>
            <div className={styles.actions}>
              {/* Notifications (UC49) have no panel yet */}
              <IconButton aria-label={t('layout.notifications')} icon={<Bell />} />
              <UserMenu />
            </div>
          </header>

          <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.content}>
            {children ?? <Outlet />}
          </main>
        </div>

        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.drawer} aria-describedby={undefined}>
            <Dialog.Title className={styles.visuallyHidden}>
              {t('layout.navigationMenu')}
            </Dialog.Title>
            <Sidebar
              sections={sections}
              homePath={homePath}
              onNavigate={closeDrawer}
              brandAction={
                <Dialog.Close asChild>
                  <IconButton aria-label={t('actions.close')} icon={<X />} />
                </Dialog.Close>
              }
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

/**
 * Signed-in shell: sidebar (collapsible; a drawer below 1024px), one-line header and the page
 * content capped at --layout-content-max-width. Renders the matched child route by default.
 */
export const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <SidebarCollapseProvider>
    <AppShell>{children}</AppShell>
  </SidebarCollapseProvider>
);
