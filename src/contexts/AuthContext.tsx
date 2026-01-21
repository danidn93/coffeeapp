// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import Cookies from 'js-cookie';
import { supabase } from '@/integrations/supabase/client';

type Role = 'admin' | 'empleado' | 'staff';

// ✨ TIPO ACTUALIZADO
export type SessionUser = {
  id: string;
  username: string;
  name: string | null;
  role: Role;
  direccion_slug: string | null; // ✨ Añadido
};

interface AuthContextType {
  user: SessionUser | null;
  isAdmin: boolean;
  isEmpleado: boolean;
  isStaff: boolean;
  isDAC: boolean; // ✨ Añadido
  isDTH: boolean; // ✨ Añadido
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
        // Log de diagnóstico
        console.log('AdminContext: Sesión cargada', { 
            role: parsed.role, 
            slug: parsed.direccion_slug 
        });
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

    // ✨ SESSIONUSER ACTUALIZADO
    const sessionUser: SessionUser = {
      id: row.id,
      username: row.username,
      name: row.name,
      role,
      direccion_slug: row.direccion_slug || null, // ✨ Asegúrate que el RPC lo devuelva
    };
    
    console.log('AdminContext: Login exitoso', { 
        role: sessionUser.role, 
        slug: sessionUser.direccion_slug 
    });

    Cookies.set('admin_session', JSON.stringify(sessionUser), { expires: 7 });
    setUser(sessionUser);
    return true;
  };

  const logout = () => {
    Cookies.remove('admin_session');
    setUser(null);
  };

  // --- Roles y Slugs ---
  const isAdmin = useMemo(() => !!user && user.role === 'admin', [user]);
  const isEmpleado = useMemo(() => !!user && user.role === 'empleado', [user]);
  const isStaff = useMemo(() => !!user && user.role === 'empleado', [user]);
  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

  // ✨ NUEVOS BOOLEANS BASADOS EN SLUG
  const isDAC = useMemo(() => !!user && user.direccion_slug === 'DAC', [user]);
  const isDTH = useMemo(() => !!user && user.direccion_slug === 'DTH', [user]);

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        isAdmin,
        isEmpleado, 
        isStaff, 
        isDAC, // ✨ Nuevo
        isDTH, // ✨ Nuevo
        hasRole, 
        login, 
        logout 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};