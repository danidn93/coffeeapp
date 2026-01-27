// src/pages/admin/Calificaciones.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Download, RefreshCcw, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 25;
const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

/* ============================
 * Tipos
 * ============================ */
type RowView = {
  id: string;
  estrellas: number;
  comentario: string | null;
  created_at: string;
  pedido_id: string;

  app_users?: {
    name: string | null;
    role: string | null;
  } | null;
};

type Sugerencia = {
  id: string;
  mensaje: string;
  created_at: string;
  leida: boolean | null;
  app_users?: {
    name: string | null;
  } | null;
};

function SugerenciasDialog({
  open,
  onClose,
  cafeteriaId,
}: {
  open: boolean;
  onClose: () => void;
  cafeteriaId: string | null;
}) {
  const [rows, setRows] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSugerencias = useCallback(async () => {
    if (!cafeteriaId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('sugerencias_pwa')
      .select(`
        id,
        mensaje,
        created_at,
        leida,
        app_users ( name )
      `)
      .eq('cafeteria_id', cafeteriaId)
      .or('leida.is.null,leida.eq.false')
      .order('created_at', { ascending: false });

    if (!error) setRows(data || []);
    setLoading(false);
  }, [cafeteriaId]);

  useEffect(() => {
    if (open) fetchSugerencias();
  }, [open, fetchSugerencias]);

  /* Realtime */
  useEffect(() => {
    if (!open || !cafeteriaId) return;

    const ch = supabase
      .channel('sugerencias-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sugerencias_pwa' },
        fetchSugerencias
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [open, cafeteriaId, fetchSugerencias]);

  const marcarLeida = async (id: string) => {
    const { error } = await supabase
      .from('sugerencias_pwa')
      .update({ leida: true })
      .eq('id', id);

    if (!error) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast({ title: 'Sugerencia marcada como leída' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>Sugerencias de usuarios</DialogTitle>
          <DialogDescription>
            Sugerencias pendientes de revisar
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-3">
          {loading ? (
            <div className="text-center py-6">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              No hay sugerencias pendientes.
            </div>
          ) : (
            rows.map((s) => (
              <Card key={s.id} className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {s.app_users?.name ?? 'Usuario'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {new Date(s.created_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{s.mensaje}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => marcarLeida(s.id)}
                  >
                    Marcar como leída
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCalificaciones() {
  const cafeteriaId = localStorage.getItem(CAFETERIA_LS_KEY);

  /* ============================
   * Filtros
   * ============================ */
  const [q, setQ] = useState('');
  const [maxStars, setMaxStars] = useState<number>(5);

  const [orderBy, setOrderBy] = useState<'created_at' | 'estrellas'>('created_at');
  const [orderDir, setOrderDir] = useState<'desc' | 'asc'>('desc');

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RowView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openSugerencias, setOpenSugerencias] = useState(false);

  /* ============================
   * KPIs
   * ============================ */
  const [avgStars, setAvgStars] = useState<number | null>(null);
  const [satisfaccionPct, setSatisfaccionPct] = useState<number | null>(null);
  const [withComment, setWithComment] = useState<number>(0);
  const [starsDist, setStarsDist] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  });

  /* ============================
   * Helpers
   * ============================ */
  const applyFilters = useCallback((query: any) => {
    if (cafeteriaId) query = query.eq('cafeteria_id', cafeteriaId);

    if (q.trim()) query = query.ilike('comentario', `%${q.trim()}%`);

    if (maxStars < 5) {
      query = query.lte('estrellas', maxStars);
    }

    return query;
  }, [q, maxStars, cafeteriaId]);

  /* ============================
   * Página
   * ============================ */
  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('calificaciones_pwa')
        .select(`
          id,
          estrellas,
          comentario,
          created_at,
          pedido_id,
          app_users ( name, role )
        `, { count: 'exact' });

      query = applyFilters(query).order(orderBy, { ascending: orderDir === 'asc' });

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      setRows((data as RowView[]) || []);
      setTotal(count ?? 0);
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'No se pudieron cargar las calificaciones',
        variant: 'destructive',
      });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [applyFilters, orderBy, orderDir, page]);

  /* ============================
   * KPIs
   * ============================ */
  const fetchKPIs = useCallback(async () => {
    try {
      let q = supabase
        .from('calificaciones_pwa')
        .select('estrellas, comentario');

      q = applyFilters(q);

      const { data } = await q;
      const list = data || [];

      const n = list.length || 0;
      const avg = n ? list.reduce((a, r) => a + r.estrellas, 0) / n : null;
      const sat = n ? (list.filter(r => r.estrellas >= 4).length / n) * 100 : null;
      const wc = list.filter(r => r.comentario && r.comentario.trim()).length;

      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      list.forEach(r => dist[r.estrellas]++);

      setAvgStars(avg);
      setSatisfaccionPct(sat);
      setWithComment(wc);
      setStarsDist(dist);
      setTotal(n);
    } catch {}
  }, [applyFilters]);

  /* ============================
   * Realtime
   * ============================ */
  useEffect(() => {
    fetchPage();
    fetchKPIs();

    const ch = supabase
      .channel('calificaciones-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calificaciones_pwa' },
        () => {
          fetchPage();
          fetchKPIs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchPage, fetchKPIs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const clearFilters = () => {
    setQ('');
    setMaxStars(5);
    setOrderBy('created_at');
    setOrderDir('desc');
    setPage(1);
  };

  /* ============================
   * Export CSV
   * ============================ */
  const exportingRef = useRef(false);
  const handleExportCSV = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    try {
      let q = supabase
        .from('calificaciones_pwa')
        .select(`
          estrellas,
          comentario,
          created_at,
          app_users ( name, role )
        `);

      q = applyFilters(q).order(orderBy, { ascending: orderDir === 'asc' });

      const { data } = await q;
      const rows = data || [];

      const csv = [
        ['fecha', 'usuario', 'rol', 'estrellas', 'comentario'].join(','),
        ...rows.map(r =>
          [
            new Date(r.created_at).toLocaleString().replace(',', ''),
            (r.app_users?.name ?? '').replace(',', ' '),
            r.app_users?.role ?? '',
            r.estrellas,
            JSON.stringify(r.comentario ?? '').replace(',', ' ')
          ].join(',')
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calificaciones_${new Date().toISOString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({
        title: 'Exportación fallida',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      exportingRef.current = false;
    }
  };

  /* ============================
   * Render
   * ============================ */
  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">

        <header className="admin-header border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Link to="/admin">
              <Button variant="outline" size="sm" className="btn-white-hover">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl font-aventura tracking-wide text-white">
              Calificaciones
            </h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="rounded-xl border bg-white text-slate-900 shadow-sm">
            <div className="p-6 grid gap-6">

              {/* Acciones */}
              <div className="flex justify-between text-white">
                <Button variant="outline" onClick={clearFilters}>
                  <RefreshCcw className="mr-2 h-4 w-4 text-white" /> Limpiar
                </Button>
                <Button onClick={handleExportCSV} className="btn-accent">
                  <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOpenSugerencias(true)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Ver sugerencias
                </Button>
              </div>

              {/* KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-black">
                <Card className="bg-transparent shadow-none border border-slate-200">
                  <CardHeader><CardTitle className="text-black">Total</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-black">{total}</div></CardContent>
                </Card>

                <Card className="bg-transparent shadow-none border border-slate-200">
                  <CardHeader><CardTitle className="text-black">Promedio</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-black">{avgStars?.toFixed(2) ?? '—'}</div></CardContent>
                </Card>

                <Card className="bg-transparent shadow-none border border-slate-200">
                  <CardHeader><CardTitle className="text-black">Satisfacción ≥ 4</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-black">{satisfaccionPct?.toFixed(1) ?? '—'}%</div></CardContent>
                </Card>

                <Card className="bg-transparent shadow-none border border-slate-200">
                  <CardHeader><CardTitle className="text-black">Con comentario</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-black">{withComment}</div></CardContent>
                </Card>
              </div>

              {/* Distribución */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader><CardTitle className="text-black">Distribución de estrellas</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-5 gap-3 text-center">
                  {[1,2,3,4,5].map(n => (
                    <div key={n} className="rounded border px-3 py-2 text-black">
                      <div className="text-sm">{n} ★</div>
                      <div className="text-xl font-bold">{starsDist[n]}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Filtros */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-black">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-black">Buscar comentario</Label>
                    <Input className="text-white" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
                  </div>
                  <div>
                    <Label className="text-black">Máx estrellas</Label>
                    <Select value={String(maxStars)} onValueChange={v => { setMaxStars(Number(v)); setPage(1); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Tabla */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardContent className="pt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-black">
                        <th>Fecha</th>
                        <th>Usuario</th>
                        
                        <th>Estrellas</th>
                        <th>Comentario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={4} className="py-6 text-center">Cargando…</td></tr>
                      ) : rows.length === 0 ? (
                        <tr><td colSpan={4} className="py-6 text-center">Sin resultados</td></tr>
                      ) : (
                        rows.map(r => (
                          <tr key={r.id} className="border-b text-black">
                            <td>{new Date(r.created_at).toLocaleString()}</td>
                            <td>
                              {r.estrellas <= 3
                                ? 'Anónimo'
                                : r.app_users?.name ?? '—'}
                            </td>                            
                            <td>{r.estrellas}</td>
                            <td className="max-w-[520px] whitespace-pre-wrap">{r.comentario ?? '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Paginación */}
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <div className="text-black">Página {page} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
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
      <SugerenciasDialog
        open={openSugerencias}
        onClose={() => setOpenSugerencias(false)}
        cafeteriaId={cafeteriaId}
      />
    </ProtectedRoute>
  );  
}
