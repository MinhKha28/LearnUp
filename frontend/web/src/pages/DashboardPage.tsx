import React from 'react';
import { useAuth } from '@/auth/useAuth';

export const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="dashboard-container">
      <div className="welcome-banner">
        <h2>Welcome, {currentUser?.fullName || currentUser?.username}!</h2>
        <p className="welcome-desc">
          You are authenticated with role{' '}
          <strong className="role-highlight">{currentUser?.role}</strong>.
        </p>
      </div>

      <div className="dashboard-grid">
        <div className="card identity-card">
          <h3>Authentication Context (Identity Service)</h3>
          <ul className="meta-list">
            <li>
              <strong>User ID:</strong> <code>{currentUser?.id}</code>
            </li>
            <li>
              <strong>Username:</strong> {currentUser?.username}
            </li>
            <li>
              <strong>Email:</strong> {currentUser?.email}
            </li>
            <li>
              <strong>Assigned Role:</strong>{' '}
              <span className={`badge badge-${currentUser?.role.toLowerCase()}`}>
                {currentUser?.role}
              </span>
            </li>
            <li>
              <strong>Organization ID:</strong>{' '}
              {currentUser?.organizationId ? (
                <code>{currentUser.organizationId}</code>
              ) : (
                <span className="text-muted">None (Global Administrator)</span>
              )}
            </li>
          </ul>
        </div>

        <div className="card architecture-card">
          <h3>Platform Security &amp; Request Flow</h3>
          <div className="flow-diagram">
            <div className="flow-step">
              <span className="step-num">1</span>
              <span>Browser (React Web)</span>
            </div>
            <div className="flow-arrow">&rarr;</div>
            <div className="flow-step">
              <span className="step-num">2</span>
              <span>API Gateway (:8080)</span>
            </div>
            <div className="flow-arrow">&rarr;</div>
            <div className="flow-step">
              <span className="step-num">3</span>
              <span>Eureka / Downstream Services</span>
            </div>
          </div>
          <p className="flow-note">
            The Gateway validates JWT, strips spoofable client headers, and injects trusted identity
            headers downstream.
          </p>
        </div>
      </div>

      <div className="workspace-section">
        <h3>Role-Specific Workspace Placeholders</h3>
        <div className="role-cards-grid">
          <div className={`role-card ${currentUser?.role === 'ADMIN' ? 'active-role' : ''}`}>
            <h4>ADMIN Portal</h4>
            <p>Platform tenant management, global configuration, system overview.</p>
            <span className="placeholder-tag">Phase P8+ Foundation</span>
          </div>

          <div className={`role-card ${currentUser?.role === 'ORGANIZER' ? 'active-role' : ''}`}>
            <h4>ORGANIZER Portal</h4>
            <p>Learner directories, cohorts, custom tags, mandatory course assignments.</p>
            <span className="placeholder-tag">Phase P8+ Foundation</span>
          </div>

          <div className={`role-card ${currentUser?.role === 'INSTRUCTOR' ? 'active-role' : ''}`}>
            <h4>INSTRUCTOR Portal</h4>
            <p>Course syllabus authoring, quiz keys, peer review timeout interventions.</p>
            <span className="placeholder-tag">Phase P10+ Foundation</span>
          </div>

          <div className={`role-card ${currentUser?.role === 'LEARNER' ? 'active-role' : ''}`}>
            <h4>LEARNER Portal</h4>
            <p>Course enrollments, interactive lessons, MCQ quizzes, peer evaluations.</p>
            <span className="placeholder-tag">Phase P10+ Foundation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
