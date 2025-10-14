import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const loc = useLocation();

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: loc }} />;
  }
  return <>{children}</>;
};
