// src/pages/admin/Encuestas.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Download, RefreshCcw, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

type BaseRow = {
  id: string;
  pedido_id: string;
  mesa_id: string;
  rating_servicio: number;
  rating_sistema: number;
  comentario: string | null;
  created_at: string;
};

// 👇 Vista enriquecida (usamos nombres, no IDs)
type RowView = BaseRow & {
  mesas?: { nombre: string } | null;
  pedidos?: { name_user: string | null } | null;
};

const PAGE_SIZE = 25;

export default function AdminEncuestas() {
  const { user } = useAuth();

  // 🔒 Solo admin (el empleado no debe ver este módulo)
  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin" replace />;
  }

  // ====== Filtros y estado ======
  const [q, setQ] = useState('');
  const [maxRating, setMaxRating] = useState<number>(5);            // ← antes minRating=1
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [orderBy, setOrderBy] = useState<'created_at' | 'rating_servicio' | 'rating_sistema'>('created_at');
  const [orderDir, setOrderDir] = useState<'desc' | 'asc'>('desc');

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RowView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [kpiLoading, setKpiLoading] = useState(false);
  const [avgServicio, setAvgServicio] = useState<number | null>(null);
  const [avgSistema, setAvgSistema] = useState<number | null>(null);
  const [withComment, setWithComment] = useState<number>(0);
  const [alertsCount, setAlertsCount] = useState<number>(0);

  // ----- helpers de filtro -----
  const applyFilters = useCallback((query: ReturnType<typeof supabase.from> & any) => {
    if (q.trim()) query = query.ilike('comentario', `%${q.trim()}%`);

    // Filtro por MÁXIMO rating (ambos campos) → lte
    if (maxRating < 5) {
      query = query
        .lte('rating_servicio', maxRating)
        .lte('rating_sistema', maxRating);
    }

    if (dateFrom) {
      const fromISO = new Date(`${dateFrom}T00:00:00`).toISOString();
      query = query.gte('created_at', fromISO);
    }
    if (dateTo) {
      const toISO = new Date(`${dateTo}T23:59:59.999`).toISOString();
      query = query.lte('created_at', toISO);
    }
    return query;
  }, [q, maxRating, dateFrom, dateTo]);

  // ----- página (con joins a mesas y pedidos para mostrar nombres) -----
  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('encuestas')
        .select(`
          id,
          pedido_id,
          mesa_id,
          rating_servicio,
          rating_sistema,
          comentario,
          created_at,
          mesas ( nombre ),
          pedidos ( name_user )
        `, { count: 'exact' });

      query = applyFilters(query).order(orderBy, { ascending: orderDir === 'asc' });

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      setRows((data as RowView[]) || []);
      setTotal(count ?? 0);
    } catch (e: any) {
      console.error('[encuestas] fetchPage error:', e?.message);
      toast({ title: 'Error', description: e?.message || 'No se pudieron cargar las encuestas', variant: 'destructive' });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [applyFilters, orderBy, orderDir, page]);

  // ----- KPIs (no necesitan joins) -----
  const fetchKPIs = useCallback(async () => {
    setKpiLoading(true);
    try {
      let base = supabase.from('encuestas').select('id', { count: 'exact', head: true });
      base = applyFilters(base);
      const totalRes = await base;
      const totalCount = totalRes.count ?? 0;

      let withCommentQ = supabase.from('encuestas').select('id', { count: 'exact', head: true }).not('comentario', 'is', null).neq('comentario', '');
      withCommentQ = applyFilters(withCommentQ);
      const withCommentRes = await withCommentQ;

      let alertsQ = supabase.from('encuestas').select('id', { count: 'exact', head: true }).or('rating_servicio.lt.3,rating_sistema.lt.3');
      alertsQ = applyFilters(alertsQ);
      const alertsRes = await alertsQ;

      let ratingsQ = supabase.from('encuestas').select('rating_servicio, rating_sistema');
      ratingsQ = applyFilters(ratingsQ);
      const ratingsRes = await ratingsQ;

      const list = (ratingsRes.data as { rating_servicio: number; rating_sistema: number }[]) || [];
      const n = list.length || 0;
      const avgS = n ? list.reduce((a, r) => a + (r.rating_servicio || 0), 0) / n : null;
      const avgX = n ? list.reduce((a, r) => a + (r.rating_sistema || 0), 0) / n : null;

      setAvgServicio(avgS);
      setAvgSistema(avgX);
      setWithComment(withCommentRes.count ?? 0);
      setAlertsCount(alertsRes.count ?? 0);
      setTotal(totalCount);
    } catch (e: any) {
      console.error('[encuestas] fetchKPIs error:', e?.message);
    } finally {
      setKpiLoading(false);
    }
  }, [applyFilters]);

  // realtime + cargas
  useEffect(() => {
    fetchPage();
    fetchKPIs();
    const ch = supabase
      .channel('encuestas-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encuestas' }, () => {
        fetchPage();
        fetchKPIs();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchPage, fetchKPIs]);

  useEffect(() => {
    fetchPage();
    fetchKPIs();
  }, [fetchPage, fetchKPIs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const clearFilters = () => {
    setQ('');
    setMaxRating(5);           // ← antes setMinRating(1)
    setDateFrom('');
    setDateTo('');
    setOrderBy('created_at');
    setOrderDir('desc');
    setPage(1);
  };

  // ----- exportación (incluye nombres y omite columna pedido) -----
  const exportingRef = useRef(false);
  const handleExportCSV = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    try {
      let query = supabase
        .from('encuestas')
        .select(`
          id,
          mesa_id,
          rating_servicio,
          rating_sistema,
          comentario,
          created_at,
          mesas ( nombre ),
          pedidos ( name_user )
        `);
      query = applyFilters(query).order(orderBy, { ascending: orderDir === 'asc' });

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data as RowView[]) || [];
      const header = ['fecha', 'sala', 'cliente', 'rating_servicio', 'rating_sistema', 'comentario'];
      const csv = [
        header.join(','),
        ...rows.map(r =>
          [
            new Date(r.created_at).toLocaleString().replace(',', ''),
            (r.mesas?.nombre ?? '').replace(',', ' '),
            (r.pedidos?.name_user ?? '').replace(',', ' '),
            r.rating_servicio,
            r.rating_sistema,
            JSON.stringify(r.comentario ?? '').replace(',', ' '),
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `encuestas_${ts}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: 'Exportación fallida', description: e?.message || 'No fue posible exportar', variant: 'destructive' });
    } finally {
      exportingRef.current = false;
    }
  };

  const badge = (n: number) => (
    <span className="inline-flex items-center rounded-full bg-slate-900/10 px-2 py-0.5 text-xs text-slate-800">{n}</span>
  );

  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        {/* Header translúcido */}
        <header className="admin-header border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Link to="/admin">
              <Button variant="outline" size="sm" className="btn-white-hover">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl font-aventura tracking-wide text-white">Encuestas</h1>
            
          </div>
        </header>

        {/* Contenedor blanco principal */}
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-xl border bg-white text-slate-900 shadow-sm">
            <div className="p-6 grid gap-6">
              {/* Acciones superiores */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Opiniones de clientes</h2>
                  <p className="text-sm text-slate-600">Servicio y sistema, con filtros y exportación.</p>
                </div>
                <div className="flex gap-2 text-white">
                  <Button variant="outline" onClick={clearFilters}>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Limpiar
                  </Button>
                  <Button onClick={handleExportCSV} className="btn-accent">
                    <Download className="mr-2 h-4 w-4" /> Exportar CSV
                  </Button>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-black">
                <Card className="bg-transparent shadow-none border border-slate-200 text-black">
                  <CardHeader>
                    <CardTitle>Total</CardTitle>
                    <CardDescription className="text-slate-600">Encuestas registradas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpiLoading ? '—' : total}</div>
                  </CardContent>
                </Card>

                <Card className="bg-transparent shadow-none border border-slate-200 text-black">
                  <CardHeader>
                    <CardTitle>Prom. Servicio</CardTitle>
                    <CardDescription className="text-slate-600">1 a 5</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {kpiLoading ? '—' : avgServicio?.toFixed(2) ?? '—'}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-transparent shadow-none border border-slate-200 text-black">
                  <CardHeader>
                    <CardTitle>Prom. Sistema</CardTitle>
                    <CardDescription className="text-slate-600">1 a 5</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {kpiLoading ? '—' : avgSistema?.toFixed(2) ?? '—'}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-transparent shadow-none border border-slate-200 text-black">
                  <CardHeader>
                    <CardTitle>Con comentario</CardTitle>
                    <CardDescription className="text-slate-600">y alertas &lt; 4</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-3">
                      <div className="text-2xl font-bold">{kpiLoading ? '—' : withComment}</div>
                      <div className="text-sm text-red-600/80">
                        {kpiLoading ? '' : `Alertas: ${alertsCount}`}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filtros */}
              <Card className="bg-transparent shadow-none border border-slate-200 text-black">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Filtros</CardTitle>
                  <CardDescription className="text-slate-600">Refina los resultados</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Desde</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="bg-white text-slate-900" />
                  </div>
                  <div className="space-y-2">
                    <Label>Hasta</Label>
                    <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="bg-white text-slate-900" />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. rating (ambos)</Label>
                    <Select value={String(maxRating)} onValueChange={(v) => { setMaxRating(Number(v)); setPage(1); }}>
                      <SelectTrigger className="bg-white text-slate-900"><SelectValue placeholder="5" /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Búsqueda en comentario</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="palabra clave…"
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setPage(1); }}
                        className="bg-white text-slate-900"
                      />
                      <Filter className="h-4 w-4 opacity-60" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Orden */}
              <div className="mb-2 flex items-center gap-3">
                <Label>Ordenar por</Label>
                <Select value={orderBy} onValueChange={(v) => setOrderBy(v as typeof orderBy)}>
                  <SelectTrigger className="w-[200px] bg-white text-slate-900"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Fecha</SelectItem>
                    <SelectItem value="rating_servicio">Rating servicio</SelectItem>
                    <SelectItem value="rating_sistema">Rating sistema</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={orderDir} onValueChange={(v) => setOrderDir(v as typeof orderDir)}>
                  <SelectTrigger className="w-[140px] bg-white text-slate-900"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descendente</SelectItem>
                    <SelectItem value="asc">Ascendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tabla (NEGRO y sin columna Pedido) */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-900">
                      <thead>
                        <tr className="text-left text-xs uppercase border-b border-slate-200">
                          <th className="py-2 pr-3">Fecha</th>
                          <th className="py-2 pr-3">Sala</th>
                          <th className="py-2 pr-3">Cliente</th>
                          <th className="py-2 pr-3">Servicio</th>
                          <th className="py-2 pr-3">Sistema</th>
                          <th className="py-2 pr-3">Comentario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center">Cargando…</td>
                          </tr>
                        ) : rows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-600">Sin resultados</td>
                          </tr>
                        ) : (
                          rows.map((r) => (
                            <tr key={r.id} className="border-b border-slate-200 last:border-0 align-top">
                              <td className="py-2 pr-3 whitespace-nowrap">
                                {new Date(r.created_at).toLocaleString()}
                              </td>
                              <td className="py-2 pr-3">{r.mesas?.nombre ?? '—'}</td>
                              <td className="py-2 pr-3">{r.pedidos?.name_user ?? '—'}</td>
                              <td className="py-2 pr-3">
                                <span className={`inline-flex rounded px-2 py-0.5 ${r.rating_servicio < 3 ? 'bg-red-500/15 text-red-700' : 'bg-emerald-500/15 text-emerald-700'}`}>
                                  {r.rating_servicio}
                                </span>
                              </td>
                              <td className="py-2 pr-3">
                                <span className={`inline-flex rounded px-2 py-0.5 ${r.rating_sistema < 3 ? 'bg-red-500/15 text-red-700' : 'bg-emerald-500/15 text-emerald-700'}`}>
                                  {r.rating_sistema}
                                </span>
                              </td>
                              <td className="py-2 pr-3 max-w-[520px]">
                                {r.comentario ? (
                                  <div className="text-[13px] leading-snug whitespace-pre-wrap">{r.comentario}</div>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <div className="text-slate-700">
                      Página {page} de {totalPages} {badge(total)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
