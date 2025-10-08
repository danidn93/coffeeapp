// src/pages/AdminDashboard.tsx (o donde lo tengas)
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { History } from 'lucide-react'; // ⬅️ nuevo


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Table as TableIcon, Music, ShoppingCart, Calendar } from 'lucide-react';

export default function AdminDashboard() {
  const { logout } = useAuth(); // si no lo usas aquí, puedes quitarlo

  // estados
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // KPIs
  const [mesasActivas, setMesasActivas] = useState(0);
  const [productosCount, setProductosCount] = useState(0);
  const [pedidosActivos, setPedidosActivos] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [eventosCount, setEventosCount] = useState(0);

  // Ventana del día (local)
  const { startISO, endISO } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setErrMsg(null);
      try {
        const mesasQ = supabase.from('mesas').select('id', { count: 'exact', head: true }).eq('activa', true);
        const productosQ = supabase.from('items').select('id', { count: 'exact', head: true }).eq('tipo', 'producto').eq('disponible', true);
        const pedidosQ = supabase
          .from('pedidos')
          .select('id', { count: 'exact', head: true })
          .in('estado', ['pendiente', 'preparando']);
        const pagosQ = supabase.from('pagos').select('total, created_at').gte('created_at', startISO).lt('created_at', endISO);
        const facturasQ = supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('requiere_factura', true);
        const mesasPendQ = supabase.from('pedidos').select('mesa_id').eq('estado', 'entregado').eq('liquidado', false);
        const usersQ = supabase.from('app_users').select('id', { count: 'exact', head: true });
        const eventosQ = supabase.from('eventos').select('id', { count: 'exact', head: true }).gte('fecha', new Date().toISOString());

        const [mesasRes, prodRes, pedRes, pagosRes, factRes, mesasPendRes, usersRes, eventosRes] = await Promise.all([
          mesasQ, productosQ, pedidosQ, pagosQ, facturasQ, mesasPendQ, usersQ, eventosQ
        ]);

        if (eventosRes.error) console.error('[dashboard] eventos error:', eventosRes.error.message);
        setEventosCount(eventosRes.error ? 0 : (eventosRes.count ?? 0));

        if (mesasRes.error) console.error('[dashboard] mesas error:', mesasRes.error.message);
        if (prodRes.error) console.error('[dashboard] productos error:', prodRes.error.message);
        if (pedRes.error) console.error('[dashboard] pedidos error:', pedRes.error.message);
        if (pagosRes.error) console.error('[dashboard] pagos error:', pagosRes.error.message);
        if (factRes.error) console.error('[dashboard] facturas error:', factRes.error.message);
        if (mesasPendRes.error) console.error('[dashboard] mesasPend error:', mesasPendRes.error.message);
        if (usersRes.error)   console.error('[dashboard] users error:', usersRes.error.message);

        setMesasActivas(mesasRes.error ? 0 : (mesasRes.count ?? 0));
        setProductosCount(prodRes.error ? 0 : (prodRes.count ?? 0));
        setPedidosActivos(pedRes.error ? 0 : (pedRes.count ?? 0));
        setUsersCount(usersRes.error ? 0 : (usersRes.count ?? 0));

        // pagos y mesasPendRes si luego los usas para KPIs de dinero o pendientes
        const pagos = pagosRes.error ? [] : ((pagosRes.data as { total: number }[] | null) ?? []);
        const filas = mesasPendRes.error ? [] : ((mesasPendRes.data as { mesa_id: string }[] | null) ?? []);

      } catch (e: any) {
        console.error('[dashboard] fetchAll fatal:', e);
        setErrMsg(e?.message || 'No se pudo cargar el dashboard');
        setMesasActivas(0);
        setProductosCount(0);
        setPedidosActivos(0);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    const ch = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos' }, fetchAll)
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [startISO, endISO]);

  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        <main className="container mx-auto px-4 py-8">
          {errMsg && (
            <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
              {errMsg}
            </div>
          )}

          {/* GRID del dashboard con cards translúcidas */}
          <div className="dashboard-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {/* 1) Salas */}
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

            {/* 2) Productos */}
            <Link to="/admin/items">
              <Card className="dashboard-card cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="card-title">Productos</CardTitle>
                  <Music className="h-4 w-4 opacity-80" />
                </CardHeader>
                <CardContent className="card-inner">
                  <div className="text-xl font-semibold">
                    {loading ? '—' : `${productosCount} productos`}
                  </div>
                  <CardDescription className="card-subtitle">Administrar catálogo disponible</CardDescription>
                </CardContent>
              </Card>
            </Link>

            {/* 3) Pedidos activos */}
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

            {/* 4) Historial de pedidos */}
            <Link to="/admin/historial">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow dashboard-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium card-title">Historial de pedidos</CardTitle>
                  <History className="h-4 w-4 text-white/80" />
                </CardHeader>
                <CardContent className="card-inner">
                  <div className="text-xl font-semibold text-white/95">
                    Consulta y filtra pedidos
                  </div>
                  <CardDescription className="card-subtitle">
                    Cliente, sala, fechas y producto
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>

          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
