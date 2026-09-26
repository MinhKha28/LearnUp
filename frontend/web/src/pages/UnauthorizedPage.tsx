import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';

export const UnauthorizedPage: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <main>
      <h1>403 &mdash; Access Restricted</h1>
      <p>
        Your current account role (<strong>{currentUser?.role || 'Guest'}</strong>) does not have
        sufficient permissions to access this specific area.
      </p>
      <Link to="/dashboard">Back to Dashboard</Link>
    </main>
  );
};
