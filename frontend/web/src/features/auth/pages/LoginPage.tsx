import React, { useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useAuth } from '@/auth/useAuth';
import { getPostLoginPath } from '@/app/navigation';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, Button, TextField } from '@/components/ui';
import { PRICING_PATH } from '@/config/routes';
import { applyServerFieldErrors, formResolver, useFieldErrorText } from '@/lib/form';
import { useComingSoon } from '@/lib/useComingSoon';
import { LoginPanel } from '../components/LoginPanel';
import { loginSchema, type LoginFormValues } from '../loginSchema';
import styles from './LoginPage.module.css';

/** Google's "G", a brand mark — not translated. */
const GOOGLE_MARK = 'G';

/** UC05 — Sign in. Forgot password (UC07) and Google (UC05.1) belong to later milestones. */
export const LoginPage: React.FC = () => {
  const { t } = useTranslation(['auth', 'common']);
  const errorText = useFieldErrorText();
  const alertId = useId();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** 401: both fields are marked invalid until the user edits either of them. */
  const [credentialsRejected, setCredentialsRejected] = useState(false);
  const comingSoon = useComingSoon();

  const { login, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: formResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  useEffect(() => {
    if (currentUser) {
      navigate(getPostLoginPath(currentUser.role, from), { replace: true });
    }
  }, [currentUser, navigate, from]);

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMsg(null);
    setCredentialsRejected(false);
    comingSoon.hide();

    try {
      const user = await login(values);
      navigate(getPostLoginPath(user.role, from), { replace: true });
    } catch (err: unknown) {
      setErrorMsg(
        applyServerFieldErrors(err, setError, ['username', 'password'], {
          fallback: t('auth:login.failed'),
        })
      );
      setCredentialsRejected(axios.isAxiosError(err) && err.response?.status === 401);
    }
  };

  /** Forgot password (UC07) and Google (UC05.1) are not built yet. */
  const showComingSoon = () => {
    setErrorMsg(null);
    comingSoon.show();
  };

  const clearRejection = () => setCredentialsRejected(false);
  const rejectedProps = credentialsRejected
    ? { 'aria-invalid': true as const, 'aria-describedby': alertId }
    : {};

  return (
    <AuthLayout
      heroTitle={t('auth:login.panel.heroTitle')}
      heroDescription={t('auth:login.panel.heroDescription')}
      panelContent={<LoginPanel />}
      footer={
        <p className={styles.signUp}>
          {t('auth:login.newOrganization')}
          <Link to={PRICING_PATH} className={styles.signUpLink}>
            {t('auth:login.viewPlans')}
          </Link>
        </p>
      }
    >
      <header className={styles.header}>
        <h1 className={styles.title}>{t('auth:login.title')}</h1>
        <p className={styles.subtitle}>{t('auth:login.subtitle')}</p>
      </header>

      {errorMsg && (
        <Alert
          id={alertId}
          tone="danger"
          showIcon={false}
          className={styles.alert}
          title={<span className={styles.alertTitle}>{t('auth:login.errorTitle')}</span>}
        >
          <span className={styles.alertBody}>{errorMsg}</span>
        </Alert>
      )}
      {comingSoon.isVisible && (
        <Alert tone="info" className={styles.alert}>
          {t('common:comingSoon')}
        </Alert>
      )}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label={t('auth:login.emailLabel')}
          placeholder={t('auth:login.emailPlaceholder')}
          type="text"
          inputMode="email"
          autoComplete="username"
          size="xl"
          autoFocus
          {...register('username', { onChange: clearRejection })}
          error={errorText(errors.username)}
          {...rejectedProps}
        />
        <TextField
          label={t('auth:login.passwordLabel')}
          labelAction={
            <Button variant="link" className={styles.forgotPassword} onClick={showComingSoon}>
              {t('auth:login.forgotPassword')}
            </Button>
          }
          placeholder={t('auth:login.passwordPlaceholder')}
          type="password"
          passwordToggle="text"
          autoComplete="current-password"
          size="xl"
          {...register('password', { onChange: clearRejection })}
          error={errorText(errors.password)}
          {...rejectedProps}
        />
        <Button
          type="submit"
          size="xl"
          fullWidth
          isLoading={isSubmitting}
          className={styles.submit}
        >
          {isSubmitting ? t('auth:login.submitting') : t('auth:login.submit')}
        </Button>
      </form>

      <div className={styles.alternatives}>
        <p className={styles.divider}>
          <span>{t('auth:login.or')}</span>
        </p>
        <Button variant="secondary" fullWidth className={styles.google} onClick={showComingSoon}>
          <span className={styles.googleLabel}>
            <span className={styles.googleMark} aria-hidden="true">
              {GOOGLE_MARK}
            </span>
            {t('auth:login.google')}
          </span>
        </Button>
        <div className={styles.googleNote}>
          <p>{t('auth:login.googleNoteAccounts')}</p>
          <p>{t('auth:login.googleNoteAdmin')}</p>
        </div>
      </div>
    </AuthLayout>
  );
};
