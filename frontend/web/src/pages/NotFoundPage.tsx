import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <main>
      <h1>404 &mdash; Page Not Found</h1>
      <p>The requested route or resource does not exist on the platform.</p>
      <Link to="/dashboard">Return to Dashboard</Link>
    </main>
  );
};
