import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

import adminBgDesktop from '/assets/admin-bg-ordinario.png'; //Cambiar a la imagen deseada
import adminBgMobile from '/assets/movil-bg-ordinario.png'; //Cambiar a la imagen deseada
import logo from '/assets/logo-admin-ordinario.png'; //Cambiar al logo deseado

const AdminLogin = () => {
  const { user, login } = useAuth(); // <- usar user
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const [bgUrl, setBgUrl] = useState<string>(adminBgMobile);
  const [minH, setMinH] = useState<string>('100svh');

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const applyBg = () => setBgUrl(mq.matches ? adminBgDesktop : adminBgMobile);
    applyBg();
    if (mq.addEventListener) {
      mq.addEventListener('change', applyBg);
      return () => mq.removeEventListener('change', applyBg);
    } else {
      // @ts-ignore
      mq.addListener(applyBg);
      return () => {
        // @ts-ignore
        mq.removeListener(applyBg);
      };
    }
  }, []);

  useEffect(() => {
    const setVh = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      setMinH(`${h}px`);
    };
    setVh();
    window.visualViewport?.addEventListener('resize', setVh);
    window.addEventListener('resize', setVh);
    return () => {
      window.visualViewport?.removeEventListener('resize', setVh);
      window.removeEventListener('resize', setVh);
    };
  }, []);

  // ✅ Si ya hay sesión (admin/empleado/staff), sal del login
  if (user) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const success = await login(username, password);
      if (success) {
        toast({
          title: 'Inicio de sesión exitoso',
          description: 'Bienvenido al panel',
        });
        // ✅ Navega al dashboard (para cualquier rol autenticado)
        navigate('/admin', { replace: true });
      } else {
        toast({
          title: 'Error de autenticación',
          description: 'Usuario o contraseña incorrectos',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Ha ocurrido un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="unemi admin-full relative text-white" style={{ minHeight: minH }}>
      <div className="absolute inset-0 -z-10">
        <div className="h-full w-full bg-no-repeat bg-center bg-cover" style={{ backgroundImage: `url(${bgUrl})` }} />
        <div className="absolute inset-0 bg-[hsl(200_100%_13.5%/_0.88)]" />
        <div className="hidden lg:block absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.15)_60%,rgba(0,0,0,0)_100%)]" />
      </div>

      <div className="w-full h-full">
        <div className="container mx-auto px-4 min-h-[inherit]">
          <div className="grid min-h-[inherit] lg:min-h-screen lg:grid-cols-2 items-center">
            <div className="flex justify-center lg:justify-start self-center">
              <div className="w-full max-w-md lg:ml-2 overflow-auto rounded-2xl">
                <Card className="w-full dashboard-card bg-white/10 backdrop-blur-md border-white/10">
                  <CardHeader className="text-center space-y-3">
                    <div className="mx-auto bg-white rounded-full p-1 shadow-md ring-2 ring-[hsl(24_100%_50%/_0.6)] w-max">
                      <img src={logo} alt="Logo" className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-contain bg-white" draggable={false} />
                    </div>
                    <CardTitle className="text-2xl font-aventura tracking-wide">Panel Administrativo</CardTitle>
                    <CardDescription className="card-subtitle text-white/85">Ingresa tus credenciales para acceder</CardDescription>
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
                          className="bg-white/90 text-[hsl(240_1.4%_13.5%)] placeholder:text-[hsl(240_1.4%_13.5%/_0.65)]"
                          autoCapitalize="none"
                          autoCorrect="off"
                          inputMode="text"
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
                            placeholder="••••••••"
                            required
                            className="bg-white/90 text-[hsl(240_1.4%_13.5%)] placeholder:text-[hsl(240_1.4%_13.5%/_0.65)] pr-12"
                            autoCapitalize="none"
                            autoCorrect="off"
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

                <div className="h-[env(safe-area-inset-bottom)]" />
              </div>
            </div>

            <div className="hidden lg:block" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
