// src/pages/admin/Dashboard.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  History,
  Star,
  Coffee,
  DoorOpen as TableIcon,
  ShoppingCart,
  CalendarDays,
  PackageOpen,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const POLL_MS = 3000; // 3s fallback

function toLocalISO(d: Date) {
  const dt = new Date(d);
  dt.setHours(12, 0, 0, 0);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function plusDaysLocalISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

export default function AdminDashboard() {
  const { isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Core (se mantienen)
  const [mesasActivas, setMesasActivas] = useState(0);
  const [productosCount, setProductosCount] = useState(0);
  const [pedidosActivos, setPedidosActivos] = useState(0);
  const [usersCount, setUsersCount] = useState(0);

  // Visitas: nuevos indicadores
  const [menusVisitasCount, setMenusVisitasCount] = useState(0);          // días creados en menu_visitas_dias
  const [productosVisitasCount, setProductosVisitasCount] = useState(0);  // items en menu_visitas_catalog

  // Pedidos para mañana (reemplaza "Visitas hoy")
  const [pedidosMananaCount, setPedidosMananaCount] = useState(0);
  const [pedidosMananaCatCounters, setPedidosMananaCatCounters] = useState<Record<string, number>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastMananaCount = useRef(0);

  const inFlightRef = useRef(false);
  const intervalIdRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { startISO, endISO, tomorrowISO } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const tomorrow = plusDaysLocalISO(1);
    return { startISO: start.toISOString(), endISO: end.toISOString(), tomorrowISO: tomorrow };
  }, []);

  const fetchAll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setErrMsg(null);

    try {
      // --- Core métricas (mesas, productos regulares, pedidos activos, usuarios) ---
      const mesasQ = supabase
        .from('mesas')
        .select('id', { count: 'exact', head: true })
        .eq('activa', true);

      const productosQ = supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'producto')
        .eq('disponible', true);

      const pedidosQ = supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .in('estado', ['pendiente', 'preparando']);

      const usersQ = supabase
        .from('app_users')
        .select('id', { count: 'exact', head: true });

      // --- Visitas: contadores globales ---
      const menusVisQ = supabase
        .from('menu_visitas_dias')
        .select('id', { count: 'exact', head: true });

      const productosVisQ = supabase
        .from('menu_visitas_catalog')
        .select('id', { count: 'exact', head: true });

      const [mesasRes, prodRes, pedRes, usersRes, menusVisRes, productosVisRes] = await Promise.all([
        mesasQ,
        productosQ,
        pedidosQ,
        usersQ,
        menusVisQ,
        productosVisQ,
      ]);

      if (mesasRes.error) console.error('[dashboard] mesas error:', mesasRes.error.message);
      if (prodRes.error) console.error('[dashboard] productos error:', prodRes.error.message);
      if (pedRes.error) console.error('[dashboard] pedidos error:', pedRes.error.message);
      if (usersRes.error) console.error('[dashboard] users error:', usersRes.error.message);
      if (menusVisRes.error) console.error('[dashboard] menús visitas error:', menusVisRes.error.message);
      if (productosVisRes.error) console.error('[dashboard] productos visitas error:', productosVisRes.error.message);

      setMesasActivas(mesasRes.error ? 0 : (mesasRes.count ?? 0));
      setProductosCount(prodRes.error ? 0 : (prodRes.count ?? 0));
      setPedidosActivos(pedRes.error ? 0 : (pedRes.count ?? 0));
      setUsersCount(usersRes.error ? 0 : (usersRes.count ?? 0));
      setMenusVisitasCount(menusVisRes.error ? 0 : (menusVisRes.count ?? 0));
      setProductosVisitasCount(productosVisRes.error ? 0 : (productosVisRes.count ?? 0));

      // --- Pedidos para mañana ---
      // Buscar el día de mañana en menu_visitas_dias
      const { data: diaManana, error: diaErr } = await supabase
        .from('menu_visitas_dias')
        .select('id')
        .eq('fecha', tomorrowISO)
        .maybeSingle();

      if (diaErr) {
        console.error('[dashboard] dia mañana error:', diaErr.message);
        setPedidosMananaCount(0);
        setPedidosMananaCatCounters({});
      } else if (!diaManana) {
        // No hay menú creado para mañana
        setPedidosMananaCount(0);
        setPedidosMananaCatCounters({});
        lastMananaCount.current = 0;
      } else {
        // Pedidos para ese día
        const { data: pedidosVis, error: pErr } = await supabase
          .from('pedidos_visitas')
          .select('id')
          .eq('dia_id', (diaManana as any).id);

        if (pErr) {
          console.error('[dashboard] pedidos mañana error:', pErr.message);
          setPedidosMananaCount(0);
          setPedidosMananaCatCounters({});
          lastMananaCount.current = 0;
        } else {
          const ids = (pedidosVis || []).map((x: any) => x.id);
          const newCount = ids.length;

          // sonido solo admin y si subió
          if (isAdmin && audioRef.current && newCount > lastMananaCount.current) {
            try {
              audioRef.current.currentTime = 0;
              void audioRef.current.play();
            } catch {}
          }
          lastMananaCount.current = newCount;
          setPedidosMananaCount(newCount);

          if (ids.length) {
            const { data: itemsVis, error: iErr } = await supabase
              .from('pedido_items_visitas')
              .select('pedido_id,categoria')
              .in('pedido_id', ids);

            if (iErr) {
              console.error('[dashboard] items mañana error:', iErr.message);
              setPedidosMananaCatCounters({});
            } else {
              const map: Record<string, number> = {};
              (itemsVis || []).forEach((r: any) => {
                const k = (r.categoria || '—') as string;
                map[k] = (map[k] || 0) + 1;
              });
              setPedidosMananaCatCounters(map);
            }
          } else {
            setPedidosMananaCatCounters({});
          }
        }
      }
    } catch (e: any) {
      console.error('[dashboard] fetchAll fatal:', e);
      setErrMsg(e?.message || 'No se pudo cargar el dashboard');
      setMesasActivas(0);
      setProductosCount(0);
      setPedidosActivos(0);
      setUsersCount(0);
      setMenusVisitasCount(0);
      setProductosVisitasCount(0);
      setPedidosMananaCount(0);
      setPedidosMananaCatCounters({});
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [tomorrowISO, isAdmin]);

  useEffect(() => {
    // Primera carga
    fetchAll();

    // Realtime + polling
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel('dashboard-realtime')
      // core
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, fetchAll)
      // visitas
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_visitas_dias' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_visitas_catalog' }, fetchAll)
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
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };

    startPolling();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchAll();
        startPolling();
      } else {
        stopPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopPolling();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchAll]);

  // Orden para mostrar badges (igual al módulo de visitas)
  const visitasBadgeOrder = [
    'desayuno',
    'bebidas desayuno',
    'almuerzo',
    'bebidas almuerzo',
    'merienda',
    'bebidas merienda',
  ];
  const pedidosMananaBadges = Object.entries(pedidosMananaCatCounters).sort((a, b) => {
    const ai = visitasBadgeOrder.indexOf(a[0].toLowerCase());
    const bi = visitasBadgeOrder.indexOf(b[0].toLowerCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });
  const pretty = (s: string) =>
    (s || '—').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\w/, (m) => m.toUpperCase());

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

            {/* ======== VISITAS ======== */}

            {/* Menús de visitas (días creados) — SOLO ADMIN */}
            {isAdmin && (
              <Link to="/admin/visitas/menu">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="card-title">Menús para visitas</CardTitle>
                    <CalendarDays className="h-4 w-4 opacity-80" />
                  </CardHeader>
                  <CardContent className="card-inner">
                    <div className="text-2xl font-bold">{loading ? '—' : menusVisitasCount}</div>
                    <CardDescription className="card-subtitle">Días con menú creado</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Productos visitas (catálogo) — SOLO ADMIN */}
            {isAdmin && (
              <Link to="/admin/visitas/productos">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="card-title">Productos para visitas</CardTitle>
                    <PackageOpen className="h-4 w-4 opacity-80" />
                  </CardHeader>
                  <CardContent className="card-inner">
                    <div className="text-2xl font-bold">{loading ? '—' : productosVisitasCount}</div>
                    <CardDescription className="card-subtitle">Catálogo de visitas</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Pedidos para mañana — SOLO ADMIN */}
            {isAdmin && (
              <Link to="/admin/visitas/pedidos">
                <Card className="dashboard-card cursor-pointer ring-2 ring-primary/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="card-title">Pedidos para mañana</CardTitle>
                    <ShoppingCart className="h-4 w-4 opacity-80" />
                  </CardHeader>
                  <CardContent className="card-inner">
                    <div className="text-2xl font-bold">{loading ? '—' : pedidosMananaCount}</div>
                    <CardDescription className="card-subtitle mb-2">
                      {`Fecha: ${tomorrowISO}`}
                    </CardDescription>

                    {/* Badges con contadores por categoría */}
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(pedidosMananaCatCounters).length === 0 ? (
                        <Badge className="bg-slate-600 text-white">Sin categorías</Badge>
                      ) : (
                        Object.entries(pedidosMananaCatCounters)
                          .sort((a, b) => {
                            const order = ['desayuno', 'bebidas desayuno', 'almuerzo', 'bebidas almuerzo', 'merienda', 'bebidas merienda'];
                            const ai = order.indexOf(a[0].toLowerCase());
                            const bi = order.indexOf(b[0].toLowerCase());
                            if (ai !== -1 && bi !== -1) return ai - bi;
                            if (ai !== -1) return -1;
                            if (bi !== -1) return 1;
                            return a[0].localeCompare(b[0]);
                          })
                          .map(([cat, n]) => {
                            const lc = cat.toLowerCase();
                            const cls =
                              lc.includes('desayuno') ? 'bg-emerald-600' :
                              lc.includes('almuerzo') ? 'bg-sky-600' :
                              lc.includes('merienda') ? 'bg-fuchsia-600' :
                              'bg-slate-600';
                            return (
                              <Badge key={cat} className={`${cls} text-white`}>
                                {pretty(cat)}: {n}
                              </Badge>
                            );
                          })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

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

            {/* Encuestas — SOLO ADMIN (se mantiene por si la usas luego) */}
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
