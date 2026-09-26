import React from 'react';
import { Navigate } from 'react-router-dom';
import { useHomePath } from './useHomePath';

/** "/" → the current user's home page. */
export const HomeRedirect: React.FC = () => <Navigate to={useHomePath()} replace />;
