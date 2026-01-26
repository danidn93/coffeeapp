'use client';

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
  Users,
  UserCog,
  Building,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const POLL_MS = 3000;
const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

/* ============================
 * Utils fecha
 * ============================ */
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
  const { user, isDAC, isDTH, isStaff } = useAuth();

  /* ============================
   * PERMISOS (AJUSTADOS)
   * ============================ */
  const canViewOperaciones = isStaff || isDAC;
  const canViewGestionVisitas = isDAC;
  const canViewGestionDTH = isDTH;
  const canViewGestionDirecciones = isDAC;

  /* ============================
   * CAFETERÍA ACTIVA (REACTIVA)
   * ============================ */
  const [cafeteriaId, setCafeteriaId] = useState<string | null>(() =>
    localStorage.getItem(CAFETERIA_LS_KEY)
  );

  useEffect(() => {
    const handler = () => {
      setCafeteriaId(localStorage.getItem(CAFETERIA_LS_KEY));
    };
    window.addEventListener('storage', handler);
    window.addEventListener('cafeteria-change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('cafeteria-change', handler);
    };
  }, []);

  /* ============================
   * ESTADOS
   * ============================ */
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [mesasActivas, setMesasActivas] = useState(0);
  const [productosCount, setProductosCount] = useState(0);
  const [pedidosActivos, setPedidosActivos] = useState(0);
  const [pedidosPWAActivos, setPedidosPWAActivos] = useState(0);
  const [menusVisitasCount, setMenusVisitasCount] = useState(0);
  const [productosVisitasCount, setProductosVisitasCount] = useState(0);
  const [pedidosMananaCount, setPedidosMananaCount] = useState(0);
  const [calificacionesCount, setCalificacionesCount] = useState(0);

  const [pedidosMananaCatCounters, setPedidosMananaCatCounters] =
    useState<Record<string, number>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPWAActivos = useRef(0);
  const inFlightRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const tomorrowISO = useMemo(() => plusDaysLocalISO(1), []);

  /* ============================
   * FETCH PRINCIPAL (POR CAFETERÍA)
   * ============================ */
  const fetchAll = useCallback(async () => {
    if (!cafeteriaId || inFlightRef.current) return;

    inFlightRef.current = true;
    setErrMsg(null);

    try {
      /* ============================
      * QUERIES OPERACIONES
      * ============================ */
      const qMesas = canViewOperaciones
        ? supabase
            .from('mesas')
            .select('id', { count: 'exact', head: true })
            .eq('activa', true)
            .eq('cafeteria_id', cafeteriaId)
        : null;

      const qProductos = canViewOperaciones
        ? supabase
            .from('items')
            .select('id', { count: 'exact', head: true })
            .eq('disponible', true)
            .eq('cafeteria_id', cafeteriaId)
        : null;

      const qPedidos = canViewOperaciones
        ? supabase
            .from('pedidos')
            .select('id', { count: 'exact', head: true })
            .in('estado', ['pendiente', 'preparando'])
            .eq('cafeteria_id', cafeteriaId)
        : null;

      const qPedidosPWA = canViewOperaciones
        ? supabase
            .from('pedidos_pwa')
            .select('id', { count: 'exact', head: true })
            .eq('estado', 'pendiente')
            .eq('cafeteria_id', cafeteriaId)
        : null;

      /* ============================
      * QUERIES VISITAS
      * ============================ */
      const qMenusVisitas = canViewGestionVisitas
        ? supabase
            .from('menu_visitas_dias')
            .select('id', { count: 'exact', head: true })
            .eq('cafeteria_id', cafeteriaId)
        : null;

      const qProductosVisitas = canViewGestionVisitas
        ? supabase
            .from('menu_visitas_catalog')
            .select('id', { count: 'exact', head: true })
            .eq('cafeteria_id', cafeteriaId)
        : null;

      /* ============================
      * QUERIES CALIFICACIONES
      * ============================ */
      const qCalificaciones = supabase
        .from('calificaciones_pwa')
        .select('id', { count: 'exact', head: true })
        .eq('cafeteria_id', cafeteriaId);

      /* ============================
      * EJECUCIÓN PARALELA
      * ============================ */
      const [
        rMesas,
        rProductos,
        rPedidos,
        rPedidosPWA,
        rMenusVisitas,
        rProductosVisitas,
        rCalificaciones,
      ] = await Promise.all([
        qMesas,
        qProductos,
        qPedidos,
        qPedidosPWA,
        qMenusVisitas,
        qProductosVisitas,
        qCalificaciones,
      ]);

      /* ============================
      * SETEOS SEGUROS
      * ============================ */
      if (canViewOperaciones) {
        setMesasActivas(rMesas?.count ?? 0);
        setProductosCount(rProductos?.count ?? 0);
        setPedidosActivos(rPedidos?.count ?? 0);

        const nuevosPWA = rPedidosPWA?.count ?? 0;
        setPedidosPWAActivos(nuevosPWA);

        if (
          audioRef.current &&
          nuevosPWA > lastPWAActivos.current
        ) {
          audioRef.current.currentTime = 0;
          void audioRef.current.play();
        }

        lastPWAActivos.current = nuevosPWA;
      }

      if (canViewGestionVisitas) {
        setMenusVisitasCount(rMenusVisitas?.count ?? 0);
        setProductosVisitasCount(rProductosVisitas?.count ?? 0);

        const { data: diaManana } = await supabase
          .from('menu_visitas_dias')
          .select('id')
          .eq('fecha', tomorrowISO)
          .eq('cafeteria_id', cafeteriaId)
          .maybeSingle();

        if (diaManana) {
          const { data: pedidosVis } = await supabase
            .from('pedidos_visitas')
            .select('id')
            .eq('dia_id', diaManana.id);

          setPedidosMananaCount(pedidosVis?.length ?? 0);
        } else {
          setPedidosMananaCount(0);
        }
      }

      setCalificacionesCount(rCalificaciones?.count ?? 0);
    } catch (e: any) {
      setErrMsg(e?.message || 'Error cargando dashboard');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [
    cafeteriaId,
    canViewOperaciones,
    canViewGestionVisitas,
    tomorrowISO,
  ]);

  // 🔥 REFETCH INMEDIATO CUANDO CAMBIA LA CAFETERÍA
  useEffect(() => {
    if (!cafeteriaId) return;
    fetchAll();
  }, [cafeteriaId, fetchAll]);

  /* ============================
   * REALTIME + POLLING
   * ============================ */
  useEffect(() => {
    fetchAll();
    if (!cafeteriaId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase.channel('dashboard-realtime');

    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'calificaciones_pwa' },
      fetchAll
    );

    if (canViewOperaciones) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchAll);
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchAll);
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, fetchAll);
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_pwa' }, fetchAll);
    }

    if (canViewGestionVisitas) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'menu_visitas_dias' }, fetchAll);
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'menu_visitas_catalog' }, fetchAll);
    }

    ch.subscribe();
    channelRef.current = ch;

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') fetchAll();
    }, POLL_MS);

    return () => {
      clearInterval(poll);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchAll, cafeteriaId, canViewOperaciones, canViewGestionVisitas]);

  /* ============================
   * RENDER
   * ============================ */
  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        <audio ref={audioRef} src="/assets/notify.mp3" preload="auto" />

        <main className="container mx-auto px-4 py-8">
          {errMsg && (
            <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
              {errMsg}
            </div>
          )}

          <div className="dashboard-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">

            {canViewGestionDTH && (
              <Link to="/admin/empleados">
                <Card className="dashboard-card cursor-pointer ring-2 ring-blue-500/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="card-title">Gestión de Empleados (DTH)</CardTitle>
                    <UserCog className="h-4 w-4 opacity-80" />
                  </CardHeader>
                </Card>
              </Link>
            )}

            {canViewGestionDirecciones && (
              <Link to="/admin/direcciones">
                <Card className="dashboard-card cursor-pointer ring-2 ring-blue-500/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="card-title">Gestión de Direcciones (DAC)</CardTitle>
                    <Building className="h-4 w-4 opacity-80" />
                  </CardHeader>
                </Card>
              </Link>
            )}

            {canViewOperaciones && (
              <Link to="/admin/pedidos-pwa">
                <Card className="dashboard-card cursor-pointer ring-2 ring-unemi-orange/50">
                  <CardHeader className="flex justify-between">
                    <CardTitle className="card-title">Pedidos App Pendientes</CardTitle>
                    <Users className="h-4 w-4 opacity-80" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{loading ? '—' : pedidosPWAActivos}</div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {canViewOperaciones && (
              <Link to="/admin/mesas">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex justify-between">
                    <CardTitle className="card-title">Salas</CardTitle>
                    <TableIcon className="h-4 w-4 opacity-80" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{loading ? '—' : mesasActivas}</div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {canViewOperaciones && (
              <Link to="/admin/items">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex justify-between">
                    <CardTitle className="card-title">Productos</CardTitle>
                    <Coffee className="h-4 w-4 opacity-80" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold">{loading ? '—' : productosCount}</div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {canViewOperaciones && (
              <Link to="/admin/pedidos">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex justify-between">
                    <CardTitle className="card-title">Pedidos activos</CardTitle>
                    <ShoppingCart className="h-4 w-4 opacity-80" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{loading ? '—' : pedidosActivos}</div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {canViewOperaciones && (
              <Link to="/admin/historial">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex justify-between">
                    <CardTitle className="card-title">Historial</CardTitle>
                    <History className="h-4 w-4 opacity-80" />
                  </CardHeader>
                </Card>
              </Link>
            )}

            <Link to="/admin/calificaciones">
              <Card className="dashboard-card cursor-pointer ring-2 ring-yellow-400/40">
                <CardHeader className="flex justify-between">
                  <CardTitle className="card-title">Calificaciones</CardTitle>
                  <Star className="h-4 w-4 opacity-80" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '—' : calificacionesCount}
                  </div>
                </CardContent>
              </Card>
            </Link>

            {canViewGestionVisitas && (
              <Link to="/admin/visitas/menu">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex justify-between">
                    <CardTitle className="card-title">Menús Visitas</CardTitle>
                    <CalendarDays className="h-4 w-4 opacity-80" />
                  </CardHeader>
                </Card>
              </Link>
            )}

            {canViewGestionVisitas && (
              <Link to="/admin/visitas/productos">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex justify-between">
                    <CardTitle className="card-title">Productos Visitas</CardTitle>
                    <PackageOpen className="h-4 w-4 opacity-80" />
                  </CardHeader>
                </Card>
              </Link>
            )}

            {canViewGestionVisitas && (
              <Link to="/admin/encuestas">
                <Card className="dashboard-card cursor-pointer">
                  <CardHeader className="flex justify-between">
                    <CardTitle className="card-title">Encuestas</CardTitle>
                    <Star className="h-4 w-4 opacity-80" />
                  </CardHeader>
                </Card>
              </Link>
            )}

          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
