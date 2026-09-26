import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';

export const UnauthorizedPage: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="status-page-container">
      <div className="status-card">
        <div className="status-icon">⛔</div>
        <h1>403 &mdash; Access Restricted</h1>
        <p>
          Your current account role (<strong>{currentUser?.role || 'Guest'}</strong>) does not have
          sufficient permissions to access this specific area.
        </p>
        <p className="status-subtext">
          Business authorization policies are enforced by downstream microservices based on trusted
          identity context.
        </p>
        <div className="status-actions">
          <Link to="/dashboard" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
