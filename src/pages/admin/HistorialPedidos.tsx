// src/pages/admin/HistorialPedidos.tsx
import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, RotateCcw, Package } from 'lucide-react';

type EstadoPedido = 'pendiente' | 'preparando' | 'listo' | 'cancelado' | 'liquidado';

type Mesa = { id: string; nombre: string };
type ItemRow = { id: string; nombre: string };

type PedidoItemRow = {
  cantidad: number;
  nota?: string | null;
  item_id?: string | null; // por si existe; útil para filtro por producto
  items: { nombre: string; tipo: 'producto' | 'cancion' };
};

type PedidoRow = {
  id: string;
  mesa_id: string;
  tipo: 'productos' | 'canciones' | 'mixto';
  estado: EstadoPedido;
  created_at: string;
  name_user: string | null;
  pedido_items: PedidoItemRow[];
};

const PAGE_SIZE = 20;

export default function HistorialPedidos() {
  // ------- filtros -------
  const [cliente, setCliente] = useState('');
  const [salaId, setSalaId] = useState<string>('todas');
  const [producto, setProducto] = useState('');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // últimos 7 días por defecto
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // ------- data -------
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [mesaNombreById, setMesaNombreById] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<PedidoRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ------- paginación -------
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // helpers
  const fromISO = useMemo(() => new Date(dateFrom + 'T00:00:00').toISOString(), [dateFrom]);
  const toISO = useMemo(() => new Date(dateTo + 'T23:59:59.999').toISOString(), [dateTo]);

  // cargar salas al inicio
  useEffect(() => {
    const loadMesas = async () => {
      try {
        const { data, error } = await supabase
          .from('mesas')
          .select('id, nombre')
          .order('nombre', { ascending: true });
        if (error) throw error;
        const list = (data as Mesa[]) ?? [];
        setMesas(list);
        const map: Record<string, string> = {};
        list.forEach((m) => (map[m.id] = m.nombre));
        setMesaNombreById(map);
      } catch (e: any) {
        toast({ title: 'Error', description: e?.message || 'No se pudieron cargar las salas', variant: 'destructive' });
      }
    };
    loadMesas();
  }, [toast]);

  // consulta principal con filtros
  const fetchHistorial = async (opts?: { reset?: boolean }) => {
    setLoading(true);
    try {
      // Si pide reset, volvemos a la página 1
      const currentPage = opts?.reset ? 1 : page;
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // 1) si hay filtro por producto, resolvemos qué pedidos lo contienen
      let pedidoIdsByProduct: string[] | null = null;
      if (producto.trim()) {
        // buscar items que matcheen por nombre
        const { data: itemsData, error: itemsErr } = await supabase
          .from('items')
          .select('id, nombre')
          .ilike('nombre', `%${producto.trim()}%`);
        if (itemsErr) throw itemsErr;

        const itemIds = ((itemsData ?? []) as ItemRow[]).map((it) => it.id);
        if (itemIds.length > 0) {
          // buscar pedido_items con esos item_id
          const { data: piData, error: piErr } = await supabase
            .from('pedido_items')
            .select('pedido_id, item_id')
            .in('item_id', itemIds);
          if (piErr) throw piErr;

          const ids = Array.from(new Set((piData ?? []).map((r: any) => r.pedido_id)));
          pedidoIdsByProduct = ids.length ? ids : ['__none__']; // si no hay, forzamos vacío
        } else {
          pedidoIdsByProduct = ['__none__'];
        }
      }

      // 2) construir query de pedidos con joins a items
      let query = supabase
        .from('pedidos')
        .select(
          `
          id,
          mesa_id,
          tipo,
          estado,
          created_at,
          name_user,
          pedido_items (
            cantidad,
            nota,
            item_id,
            items ( nombre, tipo )
          )
        `,
          { count: 'exact' }
        )
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false });

      if (cliente.trim()) query = query.ilike('name_user', `%${cliente.trim()}%`);
      if (salaId !== 'todas') query = query.eq('mesa_id', salaId);
      if (pedidoIdsByProduct) query = query.in('id', pedidoIdsByProduct);

      // rango para paginación
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const list = (data as PedidoRow[]) ?? [];

      // 3) si no hubo filtro por producto (server-side), aún permitimos filtrar por texto del item (seguro)
      let filtered = list;
      if (!pedidoIdsByProduct && producto.trim()) {
        const q = producto.trim().toLowerCase();
        filtered = list.filter((p) =>
          (p.pedido_items ?? []).some((it) => (it.items?.nombre || '').toLowerCase().includes(q))
        );
      }

      setRows(filtered);
      // ¿hay más páginas?
      const total = typeof count === 'number' ? count : filtered.length;
      setHasMore(from + filtered.length < total);
      if (opts?.reset) setPage(1);
    } catch (e: any) {
      console.error('[historial] error', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo cargar el historial', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // cargar cuando cambian filtros o página
  useEffect(() => {
    fetchHistorial({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, salaId]);

  // acciones
  const onBuscar = async () => {
    await fetchHistorial({ reset: true });
  };

  const onReset = () => {
    setCliente('');
    setSalaId('todas');
    setProducto('');
    const d = new Date();
    setDateTo(d.toISOString().slice(0, 10));
    const d2 = new Date();
    d2.setDate(d2.getDate() - 7);
    setDateFrom(d2.toISOString().slice(0, 10));
    setPage(1);
  };

  const prevPage = () => {
    if (page <= 1) return;
    setPage((p) => p - 1);
  };
  const nextPage = () => {
    if (!hasMore) return;
    setPage((p) => p + 1);
  };

  // recargar al cambiar page manualmente
  useEffect(() => {
    fetchHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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
            <h1 className="text-2xl font-aventura tracking-wide text-white">Historial de pedidos</h1>
          </div>
        </header>

        {/* 🔲 Contenedor blanco para filtros + resultados */}
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-xl border bg-white text-slate-800 shadow-sm">
            <div className="p-6 grid gap-6">
              {/* Filtros */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Filtros</CardTitle>
                  <CardDescription className="text-slate-600">
                    Refina tu búsqueda por cliente, sala, fechas y producto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <Label className="text-slate-800">Cliente</Label>
                      <Input
                        value={cliente}
                        onChange={(e) => setCliente(e.target.value)}
                        placeholder="Nombre del cliente"
                        className="bg-white text-slate-900 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <Label className="text-slate-800">Sala</Label>
                      <Select value={salaId} onValueChange={setSalaId}>
                        <SelectTrigger className="bg-white text-slate-900">
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas</SelectItem>
                          {mesas.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-1">
                      <Label className="text-slate-800">Desde</Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="bg-white text-slate-900"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <Label className="text-slate-800">Hasta</Label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="bg-white text-slate-900"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <Label className="text-slate-800">Producto</Label>
                      <Input
                        value={producto}
                        onChange={(e) => setProducto(e.target.value)}
                        placeholder="Ej: Michelada"
                        className="bg-white text-slate-900 placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button onClick={onBuscar} className="btn-accent">
                      <Search className="h-4 w-4 mr-2" />
                      Buscar
                    </Button>
                    <Button variant="outline" onClick={onReset}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Limpiar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Resultados */}
              {loading ? (
                <div className="text-slate-700">Buscando…</div>
              ) : rows.length === 0 ? (
                <Card className="bg-transparent shadow-none border border-slate-200">
                  <CardContent className="py-8 text-center text-slate-700">
                    No se encontraron pedidos con esos filtros.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {rows.map((p) => {
                    const sala = mesaNombreById[p.mesa_id] ?? 'Sala';
                    return (
                      <Card key={p.id} className="bg-transparent shadow-none border border-slate-200 overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-slate-900 flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                {sala}
                              </CardTitle>
                              <CardDescription className="text-slate-600 space-x-2">
                                <span>{new Date(p.created_at).toLocaleString()}</span>
                                <span>•</span>
                                <span>Tipo: {p.tipo}</span>
                                {p.name_user && (
                                  <>
                                    <span>•</span>
                                    <span>Cliente: {p.name_user}</span>
                                  </>
                                )}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  p.estado === 'pendiente'
                                    ? 'bg-red-600 text-white'
                                    : p.estado === 'preparando'
                                    ? 'bg-amber-500 text-black'
                                    : p.estado === 'listo'
                                    ? 'bg-emerald-600 text-white'
                                    : p.estado === 'liquidado'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-300 text-slate-800'
                                }
                              >
                                {p.estado}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                          {p.pedido_items?.length ? (
                            <ul className="text-sm divide-y divide-slate-200">
                              {p.pedido_items.map((pi, idx) => (
                                <li key={idx} className="py-2 flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="font-medium leading-snug line-clamp-1 text-slate-900">
                                      {pi.items?.nombre}
                                      {pi.nota ? (
                                        <span className="text-slate-700">{' — Nota: '}{pi.nota}</span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="shrink-0">
                                    <Badge className="bg-slate-900 text-white">x{pi.cantidad}</Badge>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-sm text-slate-700">Sin ítems asociados.</div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Paginación */}
                  <div className="flex items-center justify-between mt-2">
                    <Button
                      variant="outline"
                      onClick={prevPage}
                      disabled={page <= 1 || loading}
                    >
                      Anterior
                    </Button>
                    <span className="text-slate-700">Página {page}</span>
                    <Button
                      variant="outline"
                      onClick={nextPage}
                      disabled={!hasMore || loading}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
