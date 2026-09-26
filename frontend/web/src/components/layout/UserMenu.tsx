import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, KeyRound, LogOut, User } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { ROLE_LABEL_KEYS } from '@/auth/roleLabels';
import { CHANGE_PASSWORD_PATH, LOGIN_PATH, PROFILE_PATH } from '@/config/routes';
import { Avatar } from '@/components/ui/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { LanguageSwitcher } from './LanguageSwitcher';
import styles from './UserMenu.module.css';

/** Avatar button in the app header: who is signed in, account pages, language and sign out. */
export const UserMenu: React.FC = () => {
  const { t } = useTranslation(['common', 'nav']);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  if (!currentUser) return null;

  const name = currentUser.fullName || currentUser.username;

  const handleSignOut = () => {
    logout();
    navigate(LOGIN_PATH, { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.trigger} aria-label={t('layout.accountMenu')}>
          <Avatar name={name} size="sm" />
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <div className={styles.summary}>
          <p className={styles.name}>{name}</p>
          <p className={styles.role}>{t(ROLE_LABEL_KEYS[currentUser.role])}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<User />} onSelect={() => navigate(PROFILE_PATH)}>
          {t('nav:account.profile')}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<KeyRound />} onSelect={() => navigate(CHANGE_PASSWORD_PATH)}>
          {t('nav:account.changePassword')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <LanguageSwitcher variant="menu" />
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" icon={<LogOut />} onSelect={handleSignOut}>
          {t('actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
