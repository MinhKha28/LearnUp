import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="status-page-container">
      <div className="status-card">
        <div className="status-icon">🔍</div>
        <h1>404 &mdash; Page Not Found</h1>
        <p>The requested route or resource does not exist on the platform.</p>
        <div className="status-actions">
          <Link to="/dashboard" className="btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
