import React, { createContext, useContext, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { supabase } from '@/integrations/supabase/client';

type SessionUser = {
  id: string;
  username: string;
  name: string | null;
  role: 'admin' | 'empleado' | 'staff';
};

interface AuthContextType {
  isAdmin: boolean;
  user: SessionUser | null;
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

  // restablecer sesión desde cookie (opcional/simple)
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
    // llama a la RPC que valida usuario/contraseña
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

    const sessionUser: SessionUser = {
      id: row.id,
      username: row.username,
      name: row.name,
      role: row.role,
    };

    // guarda cookie 7 días
    Cookies.set('admin_session', JSON.stringify(sessionUser), { expires: 7 });
    setUser(sessionUser);
    return true;
  };

  const logout = () => {
    Cookies.remove('admin_session');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAdmin: !!user && user.role === 'empleado',
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
