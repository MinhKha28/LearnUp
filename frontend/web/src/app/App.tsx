import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext.js';
import { router } from './router.js';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
};
