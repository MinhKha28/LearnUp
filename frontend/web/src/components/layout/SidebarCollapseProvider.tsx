import React, { useCallback, useMemo, useState } from 'react';
import {
  readStoredSidebarCollapsed,
  SidebarCollapseContext,
  storeSidebarCollapsed,
  type SidebarCollapseContextValue,
} from './sidebarCollapse';

export const SidebarCollapseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userCollapsed, setUserCollapsed] = useState(readStoredSidebarCollapsed);
  const [forceRequests, setForceRequests] = useState(0);
  // Temporary expand while forced; never saved, reset whenever a force request starts or ends
  const [expandedWhileForced, setExpandedWhileForced] = useState(false);

  const forced = forceRequests > 0;
  const collapsed = forced ? !expandedWhileForced : userCollapsed;

  const toggle = useCallback(() => {
    if (forced) {
      setExpandedWhileForced((expanded) => !expanded);
      return;
    }
    const next = !userCollapsed;
    setUserCollapsed(next);
    storeSidebarCollapsed(next);
  }, [forced, userCollapsed]);

  const requestCollapse = useCallback(() => {
    setForceRequests((count) => count + 1);
    setExpandedWhileForced(false);
    return () => {
      setForceRequests((count) => count - 1);
      setExpandedWhileForced(false);
    };
  }, []);

  const value = useMemo<SidebarCollapseContextValue>(
    () => ({ collapsed, forced, toggle, requestCollapse }),
    [collapsed, forced, toggle, requestCollapse]
  );

  return (
    <SidebarCollapseContext.Provider value={value}>{children}</SidebarCollapseContext.Provider>
  );
};
