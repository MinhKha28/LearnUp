import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';

export const PlaceholderPage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <main>
      <h1>Trang đang được xây dựng</h1>
      <button type="button" onClick={handleLogout}>
        Đăng xuất
      </button>
    </main>
  );
};
