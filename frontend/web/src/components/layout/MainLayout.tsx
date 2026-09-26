import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';

export const MainLayout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout-root">
      <header className="layout-header">
        <div className="header-brand">
          <Link to="/dashboard" className="brand-title">
            LearnUP
          </Link>
          <span className="brand-subtitle">B2B Learning Platform</span>
        </div>

        <nav className="header-nav">
          <Link to="/dashboard" className="nav-link">
            Dashboard
          </Link>
          {currentUser?.role === 'ADMIN' && (
            <span className="nav-link nav-placeholder">Platform Administration</span>
          )}
          {currentUser?.role === 'ORGANIZER' && (
            <span className="nav-link nav-placeholder">Organization &amp; Learners</span>
          )}
          {currentUser?.role === 'INSTRUCTOR' && (
            <span className="nav-link nav-placeholder">Course Authoring</span>
          )}
          {currentUser?.role === 'LEARNER' && (
            <span className="nav-link nav-placeholder">My Learning</span>
          )}
        </nav>

        <div className="header-user-panel">
          {currentUser && (
            <div className="user-info">
              <span className="user-name">{currentUser.fullName || currentUser.username}</span>
              <span className={`role-badge role-${currentUser.role.toLowerCase()}`}>
                {currentUser.role}
              </span>
              {currentUser.organizationId && (
                <span className="org-badge" title={currentUser.organizationId}>
                  Org: {currentUser.organizationId.substring(0, 8)}...
                </span>
              )}
            </div>
          )}
          <button onClick={handleLogout} className="btn-logout" title="Sign out of session">
            Logout
          </button>
        </div>
      </header>

      <main className="layout-content">
        <Outlet />
      </main>

      <footer className="layout-footer">
        <p>LearnUP Microservice Platform &mdash; Architectural Graduation Thesis</p>
      </footer>
    </div>
  );
};
