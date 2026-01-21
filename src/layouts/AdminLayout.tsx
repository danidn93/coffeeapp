import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bell, Clock, LogOut } from 'lucide-react';
import adminBg from '/assets/admin-bg-ordinario.png';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import NewOrderListener from '@/components/NewOrderListener';

type Config = {
  id: string;
  abierto: boolean;
  nombre_local?: string | null;
  logo_url?: string | null;
};

type Cafeteria = {
  id: string;
  nombre_local: string | null;
};

const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

export default function AdminLayout() {
  const { user, logout } = useAuth();

  const [now, setNow] = useState<string>(() =>
    new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  );
  const [pendingCount, setPendingCount] = useState(0);

  const [conf, setConf] = useState<Config | null>(null);
  const [savingOpen, setSavingOpen] = useState(false);

  // ⭐ NUEVO (mínimo)
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [cafeteriaActiva, setCafeteriaActiva] = useState<string | null>(
    () => localStorage.getItem(CAFETERIA_LS_KEY)
  );

  const refreshPendingCount = useCallback(async () => {
    let q = supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente');

    // Si hay una cafetería seleccionada, filtramos el conteo
    if (cafeteriaActiva) {
      q = q.eq('cafeteria_id', cafeteriaActiva);
    }

    const { count } = await q;
    setPendingCount(count ?? 0);
  }, [cafeteriaActiva]); // Importante agregar la dependencia aquí

  const fetchConfig = useCallback(async (cafeteriaId?: string | null) => {
    let q = supabase
      .from('configuracion')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (cafeteriaId) q = q.eq('id', cafeteriaId);

    const { data } = await q.maybeSingle();
    if (data) setConf(data as Config);
  }, []);

  // ⭐ NUEVO: solo para EMPLEADO
  const fetchCafeteriasEmpleado = useCallback(async () => {
    // 1. Modificamos la validación para incluir 'admin'
    const rolesAutorizados = ['empleado', 'admin'];
    if (!user || !rolesAutorizados.includes(user.role)) return;

    const { data, error } = await supabase
      .from('configuracion')
      .select('id, nombre_local')
      .order('nombre_local');

    if (error) {
      console.error("Error cargando cafeterías:", error.message);
      return;
    }

    setCafeterias(data || []);

    // 2. Persistencia en LocalStorage si no hay una activa
    if (!cafeteriaActiva && data && data.length > 0) {
      // Intentamos recuperar si ya había una en LS antes de asignar la primera por defecto
      const savedId = localStorage.getItem(CAFETERIA_LS_KEY);
      const idToSet = savedId || data[0].id;
      
      localStorage.setItem(CAFETERIA_LS_KEY, idToSet);
      setCafeteriaActiva(idToSet);
    }
  }, [user, cafeteriaActiva]);

  const toggleAbierto = async (val: boolean) => {
    if (savingOpen || !conf) return;
    setSavingOpen(true);

    const prev = conf;
    setConf({ ...conf, abierto: val });

    try {
      const { error } = await supabase
        .from('configuracion')
        .update({ abierto: val })
        .eq('id', conf.id);

      if (error) throw error;

      toast({ title: 'Listo', description: `Local ${val ? 'abierto' : 'cerrado'}.` });
    } catch (e: any) {
      setConf(prev);
      toast({
        title: 'No se pudo actualizar',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSavingOpen(false);
    }
  };

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    refreshPendingCount();
    fetchCafeteriasEmpleado();
    fetchConfig(cafeteriaActiva);

    const ch1 = supabase
      .channel('badge-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, refreshPendingCount)
      .subscribe();

    const ch2 = supabase
      .channel('config-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, () =>
        fetchConfig(cafeteriaActiva)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [refreshPendingCount, fetchConfig, fetchCafeteriasEmpleado, cafeteriaActiva]);

  if (!user) return <Navigate to="/admin/login" replace />;

  return (
    <>
      <NewOrderListener />

      <div className="fixed inset-0 -z-10">
        <div
          className="h-full w-full bg-center bg-cover bg-no-repeat bg-fixed"
          style={{ backgroundImage: `url(${adminBg})` }}
        />
        <div className="absolute inset-0 bg-[hsl(200_100%_13.5%/_0.88)]" />
      </div>

      <div className="unemi admin-full min-h-screen text-white">
        <header className="admin-header sticky top-0 z-20">
          <div className="mx-auto max-w-6xl px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-full p-1 shadow-md ring-2 ring-[hsl(24_100%_50%/_0.6)]">
                <img
                  src={conf?.logo_url || '/assets/logo-admin-ordinario.png'}
                  alt="Logo"
                  className="h-12 w-12 sm:h-16 sm:w-16 rounded-full select-none object-contain bg-white"
                  draggable={false}
                />
              </div>

              <div>
                <h1 className="text-2xl font-aventura tracking-wide">
                  {conf?.nombre_local || 'Panel Administrativo'}
                </h1>

                <div className="flex items-center gap-2">
                  <span className="text-white/90 text-sm">Estado del local</span>
                  <Switch
                    className="switch-white"
                    checked={!!conf?.abierto}
                    onCheckedChange={toggleAbierto}
                    disabled={savingOpen || !conf}
                  />
                  <Badge className={conf?.abierto ? 'badge badge--accent' : 'badge'}>
                    {conf?.abierto ? 'Abierto' : 'Cerrado'}
                  </Badge>
                </div>

                {/* ⭐ SELECT SIN CAMBIAR ESTILO */}
                
                  {(user.role === 'empleado' || user.role === 'admin') && cafeterias.length > 1 && (
                    <select
                      className="mt-1 w-full rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm text-white"
                      value={cafeteriaActiva ?? ''}
                      onChange={(e) => {
                        const id = e.target.value;
                        localStorage.setItem(CAFETERIA_LS_KEY, id);
                        setCafeteriaActiva(id);
                        fetchConfig(id);
                        // Esto notificará a los componentes hijos (Outlet) que la cafetería cambió
                        window.dispatchEvent(new Event('cafeteria-change'));
                      }}
                    >
                      {cafeterias.map((c) => (
                        <option key={c.id} value={c.id} className="text-black">
                          {c.nombre_local || 'Cafetería'}
                        </option>
                      ))}
                    </select>
                  )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/admin/configuracion">
                <Button variant="outline" className="btn-white-hover font-medium">
                  Configuración
                </Button>
              </Link>

              <button
                type="button"
                className="relative inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
              >
                <Bell className="h-5 w-5 text-white" />
                {pendingCount > 0 && <span className="notif-dot">{pendingCount}</span>}
              </button>

              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm">
                <Clock className="h-4 w-4 text-white" />
                <span className="tabular-nums">{now}</span>
              </div>

              <Button onClick={logout} variant="outline" className="btn-accent">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
