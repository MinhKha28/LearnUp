import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/useAuth';
import { getApiErrorMessage } from '@/services/apiClient';
import { getPostLoginPath } from '@/app/navigation';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { t } = useTranslation(['auth', 'common']);

  const { login, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  useEffect(() => {
    if (currentUser) {
      navigate(getPostLoginPath(currentUser.role, from), { replace: true });
    }
  }, [currentUser, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg(t('auth:login.missingCredentials'));
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const user = await login({ username: username.trim(), password });
      navigate(getPostLoginPath(user.role, from), { replace: true });
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, t('auth:login.failed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <header>
        <h1>{t('common:appName')}</h1>
        <p>{t('common:appTagline')}</p>
      </header>

      {errorMsg && <div role="alert">{errorMsg}</div>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">{t('auth:login.usernameLabel')}</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="password">{t('auth:login.passwordLabel')}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('auth:login.submitting') : t('auth:login.submit')}
        </button>
      </form>
    </div>
  );
};
