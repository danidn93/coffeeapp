// src/pages/admin/Dashboard.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { History, Star, Coffee, DoorOpen as TableIcon, ShoppingCart, CalendarDays, PackageOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const POLL_MS = 3000; // 3s fallback

export default function AdminDashboard() {
  const { isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [mesasActivas, setMesasActivas] = useState(0);
  const [productosCount, setProductosCount] = useState(0);
  const [pedidosActivos, setPedidosActivos] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [eventosCount, setEventosCount] = useState(0);

  // Visitas
  const [visitasHoyCount, setVisitasHoyCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastVisitasCount = useRef(0);

  const inFlightRef = useRef(false);
  const intervalIdRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { startISO, endISO, todayISO } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const today = now.toISOString().slice(0, 10);
    return { startISO: start.toISOString(), endISO: end.toISOString(), todayISO: today };
  }, []);

  const fetchAll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setErrMsg(null);

    try {
      const mesasQ = supabase.from('mesas')
        .select('id', { count: 'exact', head: true })
        .eq('activa', true);

      const productosQ = supabase.from('items')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'producto')
        .eq('disponible', true);

      const pedidosQ = supabase.from('pedidos')
        .select('id', { count: 'exact', head: true })
        .in('estado', ['pendiente', 'preparando']);

      const pagosQ = supabase.from('pagos')
        .select('total, created_at')
        .gte('created_at', startISO)
        .lt('created_at', endISO);

      const facturasQ = supabase.from('facturas')
        .select('id', { count: 'exact', head: true })
        .eq('requiere_factura', true);

      const mesasPendQ = supabase.from('pedidos')
        .select('mesa_id')
        .eq('estado', 'entregado')
        .eq('liquidado', false);

      const usersQ = supabase.from('app_users')
        .select('id', { count: 'exact', head: true });

      const eventosQ = supabase.from('eventos')
        .select('id', { count: 'exact', head: true })
        .gte('fecha', new Date().toISOString());

      // VISITAS de HOY (no hay estado; solo total por día)
      const diaQ = supabase.from('menu_visitas_dias').select('id').eq('fecha', todayISO).maybeSingle();

      const [
        mesasRes, prodRes, pedRes, pagosRes, factRes, mesasPendRes, usersRes, eventosRes, diaRes
      ] = await Promise.all([mesasQ, productosQ, pedidosQ, pagosQ, facturasQ, mesasPendQ, usersQ, eventosQ, diaQ]);

      if (eventosRes.error) console.error('[dashboard] eventos error:', eventosRes.error.message);
      setEventosCount(eventosRes.error ? 0 : (eventosRes.count ?? 0));

      if (mesasRes.error) console.error('[dashboard] mesas error:', mesasRes.error.message);
      if (prodRes.error) console.error('[dashboard] productos error:', prodRes.error.message);
      if (pedRes.error) console.error('[dashboard] pedidos error:', pedRes.error.message);
      if (pagosRes.error) console.error('[dashboard] pagos error:', pagosRes.error.message);
      if (factRes.error) console.error('[dashboard] facturas error:', factRes.error.message);
      if (mesasPendRes.error) console.error('[dashboard] mesasPend error:', mesasPendRes.error.message);
      if (usersRes.error) console.error('[dashboard] users error:', usersRes.error.message);

      setMesasActivas(mesasRes.error ? 0 : (mesasRes.count ?? 0));
      setProductosCount(prodRes.error ? 0 : (prodRes.count ?? 0));
      setPedidosActivos(pedRes.error ? 0 : (pedRes.count ?? 0));
      setUsersCount(usersRes.error ? 0 : (usersRes.count ?? 0));

      // Conteo de pedidos de visitas HOY (no estados)
      if (!diaRes.error && diaRes.data) {
        const { count, error: vErr } = await supabase
          .from('pedidos_visitas')
          .select('id', { count: 'exact', head: true })
          .eq('dia_id', (diaRes.data as any).id);
        if (vErr) {
          console.error('[dashboard] visitas error:', vErr.message);
          setVisitasHoyCount(0);
        } else {
          const newCount = count ?? 0;
          // Alerta sonora sólo si admin y si aumentó
          if (isAdmin && audioRef.current && newCount > lastVisitasCount.current) {
            try { audioRef.current.currentTime = 0; void audioRef.current.play(); } catch {}
          }
          lastVisitasCount.current = newCount;
          setVisitasHoyCount(newCount);
        }
      } else {
        setVisitasHoyCount(0);
        lastVisitasCount.current = 0;
      }

      void pagosRes; void factRes; void mesasPendRes;
    } catch (e: any) {
      console.error('[dashboard] fetchAll fatal:', e);
      setErrMsg(e?.message || 'No se pudo cargar el dashboard');
      setMesasActivas(0);
      setProductosCount(0);
      setPedidosActivos(0);
      setVisitasHoyCount(0);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [startISO, endISO, todayISO, isAdmin]);

  useEffect(() => {
    // Primera carga
    fetchAll();

    // Realtime + polling
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    const ch = supabase
      .channel('dashboard-realtime')
      // core
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos' }, fetchAll)
      // visitas
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_visitas_dias' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_visitas' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido_items_visitas' }, fetchAll)
      .subscribe();

    channelRef.current = ch;

    const startPolling = () => {
      if (intervalIdRef.current !== null) return;
      intervalIdRef.current = window.setInterval(() => {
        if (document.visibilityState === 'visible') fetchAll();
      }, POLL_MS);
    };
    const stopPolling = () => {
      if (intervalIdRef.current !== null) { clearInterval(intervalIdRef.current); intervalIdRef.current = null; }
    };

    startPolling();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') { fetchAll(); startPolling(); }
      else { stopPolling(); }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopPolling();
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [fetchAll]);

  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        {/* Alerta sonora solo admin */}
        <audio ref={audioRef} src="/assets/notify.mp3" preload="auto" />
        <main className="container mx-auto px-4 py-8">
          {errMsg && (
            <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
              {errMsg}
            </div>
          )}

          <div className="dashboard-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {/* Salas */}
            <Link to="/admin/mesas">
              <Card className="dashboard-card cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="card-title">Salas</CardTitle>
                  <TableIcon className="h-4 w-4 opacity-80" />
                </CardHeader>
                <CardContent className="card-inner">
                  <div className="text-2xl font-bold">{loading ? '—' : mesasActivas}</div>
                  <CardDescription className="card-subtitle">Gestionar salas y generar códigos QR</CardDescription>
                </CardContent>
              </Card>
            </Link>

            {/* Productos regulares */}
            <Link to="/admin/items">
              <Card className="dashboard-card cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="card-title">Productos</CardTitle>
                  <Coffee className="h-4 w-4 opacity-80" />
                </CardHeader>
                <CardContent className="card-inner">
                  <div className="text-xl font-semibold">
                    {loading ? '—' : `${productosCount} productos`}
                  </div>
                  <CardDescription className="card-subtitle">Administrar catálogo disponible</CardDescription>
                </CardContent>
              </Card>
            </Link>

            {/* Pedidos activos (regular) */}
            <Link to="/admin/pedidos">
              <Card className="dashboard-card cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="card-title">Pedidos activos</CardTitle>
                  <ShoppingCart className="h-4 w-4 opacity-80" />
                </CardHeader>
                <CardContent className="card-inner">
                  <div className="text-2xl font-bold">{loading ? '—' : pedidosActivos}</div>
                  <CardDescription className="card-subtitle">Ver y gestionar pedidos en tiempo real</CardDescription>
                </CardContent>
              </Card>
            </Link>

            {/* VISITAS — Pedidos hoy */}
            <Link to="/admin/visitas/pedidos">
              <Card className="dashboard-card cursor-pointer ring-2 ring-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="card-title">Visitas hoy</CardTitle>
                  <ShoppingCart className="h-4 w-4 opacity-80" />
                </CardHeader>
                <CardContent className="card-inner">
                  <div className="text-2xl font-bold">{loading ? '—' : visitasHoyCount}</div>
                  <CardDescription className="card-subtitle">Pedidos del menú de visitas (hoy)</CardDescription>
                </CardContent>
              </Card>
            </Link>

            {/* VISITAS — Menú por día */}
            <Link to="/admin/visitas/menu">
              <Card className="dashboard-card cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="card-title">Menú visitas (por día)</CardTitle>
                  <CalendarDays className="h-4 w-4 opacity-80" />
                </CardHeader>
                <CardContent className="card-inner">
                  <div className="text-xl font-semibold">Configurar categorías y orden</div>
                  <CardDescription className="card-subtitle">Publica el menú para la fecha</CardDescription>
                </CardContent>
              </Card>
            </Link>

            {/* VISITAS — Productos (catálogo independiente) */}
            <Link to="/admin/visitas/productos">
              <Card className="dashboard-card cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="card-title">Productos visitas</CardTitle>
                  <PackageOpen className="h-4 w-4 opacity-80" />
                </CardHeader>
                <CardContent className="card-inner">
                  <div className="text-xl font-semibold">Con fotos y descripción</div>
                  <CardDescription className="card-subtitle">Catálogo independiente</CardDescription>
                </CardContent>
              </Card>
            </Link>

            {/* Historial */}
            <Link to="/admin/historial">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow dashboard-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium card-title">Historial de pedidos</CardTitle>
                  <History className="h-4 w-4 text-white/80" />
                </CardHeader>
                <CardContent className="card-inner">
                  <div className="text-xl font-semibold text-white/95">Consulta y filtra pedidos</div>
                  <CardDescription className="card-subtitle">Cliente, sala, fechas y producto</CardDescription>
                </CardContent>
              </Card>
            </Link>

            {/* Encuestas — SOLO ADMIN */}
            {isAdmin && (
              <Link to="/admin/encuestas">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="card-title">Encuestas</CardTitle>
                    <Star className="h-4 w-4 opacity-80" />
                  </CardHeader>
                  <CardContent className="card-inner">
                    <div className="text-xl font-semibold">Ver y analizar feedback</div>
                    <CardDescription className="card-subtitle">Promedios, filtros, exportación</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
