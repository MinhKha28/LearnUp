import React, { useId } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { NavItem, NavSection } from '@/app/navigation';
import { cx } from '@/lib/cx';
import { Tooltip } from '@/components/ui/Tooltip';
import { Logo } from './Logo';
import styles from './Sidebar.module.css';

interface SidebarNavItemProps {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ item, collapsed, onNavigate }) => {
  const { t } = useTranslation('nav');
  // Stays active on nested pages, e.g. /learner/courses/42 keeps "My courses" highlighted
  const isActive = useMatch({ path: item.path, end: false }) !== null;
  const label = t(item.labelKey);
  const Icon = item.icon;

  const link = (
    <Link
      to={item.path}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cx(styles.item, isActive && styles.active)}
      onClick={onNavigate}
    >
      <Icon className={styles.itemIcon} aria-hidden="true" />
      {!collapsed && <span className={styles.itemLabel}>{label}</span>}
    </Link>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip content={label} side="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
};

const SidebarSection: React.FC<{
  section: NavSection;
  collapsed: boolean;
  onNavigate?: () => void;
}> = ({ section, collapsed, onNavigate }) => {
  const { t } = useTranslation('nav');
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} className={styles.section}>
      <p id={labelId} className={cx(styles.sectionLabel, collapsed && styles.visuallyHidden)}>
        {t(section.labelKey)}
      </p>
      <ul className={styles.list}>
        {section.items.map((item) => (
          <SidebarNavItem
            key={item.path}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </div>
  );
};

export interface SidebarProps {
  sections: NavSection[];
  homePath: string;
  collapsed?: boolean;
  /** Shows the collapse / expand button at the bottom (desktop sidebar only). */
  onToggleCollapse?: () => void;
  /** Called after a nav item is chosen (the drawer closes itself). */
  onNavigate?: () => void;
  /** Extra control next to the logo, e.g. the drawer's close button. */
  brandAction?: React.ReactNode;
}

/** Logo, grouped navigation and the collapse button; shared by the fixed sidebar and the drawer. */
export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  homePath,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  brandAction,
}) => {
  const { t } = useTranslation();
  const toggleLabel = t(collapsed ? 'layout.expandSidebar' : 'layout.collapseSidebar');
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  const toggleButton = onToggleCollapse && (
    <button
      type="button"
      className={styles.collapseButton}
      aria-label={collapsed ? toggleLabel : undefined}
      onClick={onToggleCollapse}
    >
      <ToggleIcon className={styles.itemIcon} aria-hidden="true" />
      {!collapsed && <span className={styles.itemLabel}>{toggleLabel}</span>}
    </button>
  );

  return (
    <div className={cx(styles.sidebar, collapsed && styles.collapsed)}>
      <div className={styles.brand}>
        <Logo to={homePath} compact={collapsed} />
        {brandAction}
      </div>

      <nav aria-label={t('layout.mainNavigation')} className={styles.nav}>
        {sections.map((section) => (
          <SidebarSection
            key={section.id}
            section={section}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {toggleButton && (
        <div className={styles.footer}>
          {collapsed ? (
            <Tooltip content={toggleLabel} side="right">
              {toggleButton}
            </Tooltip>
          ) : (
            toggleButton
          )}
        </div>
      )}
    </div>
  );
};
