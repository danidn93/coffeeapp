// src/pages/admin/Login.tsx
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import adminBg from '/assets/admin-bg.png';

const AdminLogin = () => {
  const { isAdmin, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (isAdmin) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const success = await login(username, password);
      if (success) {
        toast({ title: 'Inicio de sesión exitoso', description: 'Bienvenido al panel de administración' });
      } else {
        toast({ title: 'Error de autenticación', description: 'Usuario o contraseña incorrectos', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Ha ocurrido un error inesperado', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="unemi admin-full relative min-h-screen text-white">
      {/* Fondo + overlay azul UNEMI */}
      <div className="fixed inset-0 -z-10">
        <div
          className="h-full w-full bg-no-repeat bg-center bg-cover bg-fixed"
          style={{ backgroundImage: `url(${adminBg})` }}
        />
        <div className="absolute inset-0 bg-[hsl(200_100%_13.5%/_0.88)]" />
      </div>

      {/* Contenido */}
      <div className="min-h-screen flex items-center justify-center p-4">
        {/* Card translúcida estilo glass */}
        <Card className="w-full max-w-md dashboard-card">
          <CardHeader className="text-center space-y-3">
            {/* LOGO circular blanco con aro naranja */}
            <div className="mx-auto bg-white rounded-full p-1 shadow-md ring-2 ring-[hsl(24_100%_50%/_0.6)] w-max">
              <img
                src="/assets/logo-admin.png"
                alt="Logo"
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-contain bg-white"
                draggable={false}
              />
            </div>
            <CardTitle className="text-2xl font-aventura tracking-wide">Panel Administrativo</CardTitle>
            <CardDescription className="card-subtitle">Ingresa tus credenciales para acceder</CardDescription>
          </CardHeader>

          <CardContent className="card-inner">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white/90">Usuario</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="bg-white/90 text-[hsl(240_1.4%_13.5%)] placeholder:text-[hsl(240_1.4%_13.5%_/_.65)]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="admin"
                    required
                    className="bg-white/90 text-[hsl(240_1.4%_13.5%)] placeholder:text-[hsl(240_1.4%_13.5%_/_.65)] pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-[hsl(var(--unemi-blue))]"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <motion.div animate={{ scale: showPassword ? 1.1 : 1 }} transition={{ duration: 0.2 }}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </motion.div>
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full btn-accent" disabled={isLoading}>
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
