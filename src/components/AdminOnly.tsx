// src/components/AdminOnly.tsx
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const loc = useLocation();
  if (!isAdmin) return <Navigate to="/admin" replace state={{ from: loc }} />;
  return <>{children}</>;
}
