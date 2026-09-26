import { createContext, useContext, useEffect } from 'react';

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'learnup.sidebar-collapsed';

export const readStoredSidebarCollapsed = (): boolean => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const storeSidebarCollapsed = (collapsed: boolean): void => {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Storage unavailable: the choice still applies until the page reloads
  }
};

export interface SidebarCollapseContextValue {
  /** What the sidebar shows right now. */
  collapsed: boolean;
  /** True while a page has asked for a collapsed sidebar (useForceSidebarCollapsed). */
  forced: boolean;
  /**
   * Flips the sidebar. Normally this changes (and saves) the user's choice; while forced it only
   * expands or collapses temporarily, and the user's saved choice is left untouched.
   */
  toggle: () => void;
  /** Forces the sidebar collapsed; call the returned function to release the request. */
  requestCollapse: () => () => void;
}

export const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null);

export const useSidebarCollapse = (): SidebarCollapseContextValue => {
  const context = useContext(SidebarCollapseContext);
  if (!context) {
    throw new Error('useSidebarCollapse must be used inside AppLayout');
  }
  return context;
};

/**
 * Keeps the AppLayout sidebar collapsed while the calling component is mounted, e.g. a Course
 * workspace that needs the width. When it unmounts, the user's own choice comes back.
 * Does nothing outside AppLayout.
 */
export const useForceSidebarCollapsed = (enabled = true): void => {
  const requestCollapse = useContext(SidebarCollapseContext)?.requestCollapse;

  useEffect(() => {
    if (!enabled || !requestCollapse) return undefined;
    return requestCollapse();
  }, [enabled, requestCollapse]);
};
