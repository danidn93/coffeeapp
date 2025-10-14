import React, { createContext, useContext, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { supabase } from '@/integrations/supabase/client';

type Role = 'admin' | 'empleado' | 'staff';

type SessionUser = {
  id: string;
  username: string;
  name: string | null;
  role: Role;
};

interface AuthContextType {
  user: SessionUser | null;
  isAdmin: boolean;
  isEmpleado: boolean;
  isStaff: boolean;
  hasRole: (...roles: Role[]) => boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const raw = Cookies.get('admin_session');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SessionUser;
        setUser(parsed);
      } catch {
        Cookies.remove('admin_session');
      }
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('admin_login', {
      p_username: username,
      p_password: password,
    });
    if (error) {
      console.error('[admin_login] error', error);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return false;

    const role = String(row.role ?? '').trim().toLowerCase() as Role;

    const sessionUser: SessionUser = {
      id: row.id,
      username: row.username,
      name: row.name,
      role,
    };

    Cookies.set('admin_session', JSON.stringify(sessionUser), { expires: 7 });
    setUser(sessionUser);
    return true;
  };

  const logout = () => {
    Cookies.remove('admin_session');
    setUser(null);
  };

  const isAdmin = !!user && user.role === 'admin';
  const isEmpleado = !!user && user.role === 'empleado';
  const isStaff = !!user && user.role === 'staff';
  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, isEmpleado, isStaff, hasRole, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
