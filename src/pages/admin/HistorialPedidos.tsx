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
import { ArrowLeft, Search, RotateCcw, Users, DoorOpen } from 'lucide-react';

// --- Tipos Unificados ---
type EstadoPedido = 'pendiente' | 'preparando' | 'listo' | 'cancelado' | 'liquidado' | 'entregado';
type FuentePedido = 'mesas' | 'pwa';

type PedidoItemHistorial = {
  nombre: string;
  cantidad: number;
  nota?: string | null;
  tipo?: 'producto' | 'cancion' | 'pwa' | null;
};

// Unifica la data de 'pedidos' y 'pedidos_pwa'
type PedidoHistorial = {
  id: string;
  fuente: FuentePedido;
  created_at: string;
  estado: EstadoPedido;
  nombre_lugar: string; // (Sala o Nombre de Usuario PWA)
  nombre_cliente: string | null; // (name_user o app_user.name)
  notas?: string | null;
  items: PedidoItemHistorial[];
};

type Mesa = { id: string; nombre: string };

const PAGE_SIZE = 20;

export default function HistorialPedidos() {
  // ------- filtros -------
  const [fuente, setFuente] = useState<FuentePedido>('mesas'); // ✨ Filtro de Fuente
  const [cliente, setCliente] = useState('');
  const [salaId, setSalaId] = useState<string>('todas');
  const [producto, setProducto] = useState('');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // ------- data -------
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [mesaNombreById, setMesaNombreById] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<PedidoHistorial[]>([]);
  const [loading, setLoading] = useState(false);

  // ------- paginación -------
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

  const [cafeteriaId, setCafeteriaId] = useState<string | null>(
    () => localStorage.getItem(CAFETERIA_LS_KEY)
  );

  useEffect(() => {
    const onCafeteriaChange = () => {
      setCafeteriaId(localStorage.getItem(CAFETERIA_LS_KEY));
    };

    window.addEventListener('cafeteria-change', onCafeteriaChange);
    return () => window.removeEventListener('cafeteria-change', onCafeteriaChange);
  }, []);

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
          .eq('cafeteria_id', cafeteriaId) 
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
    
    if (!cafeteriaId) return;
    loadMesas();
  }, []);

  // consulta principal con filtros
  const fetchHistorial = async (opts?: { reset?: boolean }) => {
    setLoading(true);
    setRows([]); 
    
    try {
      if (fuente === 'mesas') {
        await fetchHistorialMesas(opts);
      } else {
        await fetchHistorialPWA(opts);
      }
    } catch (e: any) {
      console.error('[historial] error', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo cargar el historial', variant: 'destructive' });
      setLoading(false);
    }
  };
  
  // --- Lógica de fetch para 'mesas' (Original adaptada) ---
  const fetchHistorialMesas = async (opts?: { reset?: boolean }) => {
      const currentPage = opts?.reset ? 1 : page;
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let pedidoIdsByProduct: string[] | null = null;
      if (producto.trim()) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from('items')
          .select('id, nombre')
          .ilike('nombre', `%${producto.trim()}%`);
        if (itemsErr) throw itemsErr;
        const itemIds = ((itemsData ?? []) as any[]).map((it) => it.id);
        if (itemIds.length > 0) {
          const { data: piData, error: piErr } = await supabase
            .from('pedido_items')
            .select('pedido_id, item_id')
            .in('item_id', itemIds);
          if (piErr) throw piErr;
          const ids = Array.from(new Set((piData ?? []).map((r: any) => r.pedido_id)));
          pedidoIdsByProduct = ids.length ? ids : ['__none__'];
        } else {
          pedidoIdsByProduct = ['__none__'];
        }
      }

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
          notas,
          pedido_items (
            cantidad,
            nota,
            item_id,
            items ( nombre, tipo )
          )
        `,
          { count: 'exact' }
        )
        .eq('cafeteria_id', cafeteriaId)
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false });

      if (cliente.trim()) query = query.ilike('name_user', `%${cliente.trim()}%`);
      if (salaId !== 'todas') query = query.eq('mesa_id', salaId);
      if (pedidoIdsByProduct) query = query.in('id', pedidoIdsByProduct);

      query = query.range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;

      const list = (data as any[]) ?? [];

      let filtered = list;
      if (!pedidoIdsByProduct && producto.trim()) {
        const q = producto.trim().toLowerCase();
        filtered = list.filter((p) =>
          (p.pedido_items ?? []).some((it: any) => (it.items?.nombre || '').toLowerCase().includes(q))
        );
      }
      
      const unifiedRows: PedidoHistorial[] = filtered.map(p => ({
        id: p.id,
        fuente: 'mesas',
        created_at: p.created_at,
        estado: p.estado as EstadoPedido,
        nombre_lugar: mesaNombreById[p.mesa_id] ?? 'Sala Desconocida',
        nombre_cliente: p.name_user,
        notas: p.notas,
        items: (p.pedido_items || []).map((pi: any) => ({
          nombre: pi.items?.nombre || 'Producto no encontrado',
          cantidad: pi.cantidad,
          nota: pi.nota,
          tipo: pi.items?.tipo || 'producto'
        }))
      }));

      setRows(unifiedRows);
      const total = typeof count === 'number' ? count : unifiedRows.length;
      setHasMore(from + unifiedRows.length < total);
      if (opts?.reset) setPage(1);
      
      setLoading(false);
  };
  
  // --- Lógica de fetch para 'pwa' ---
  const fetchHistorialPWA = async (opts?: { reset?: boolean }) => {
      const currentPage = opts?.reset ? 1 : page;
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let pedidoIdsByProduct: string[] | null = null;
      if (producto.trim()) {
        const q = `%${producto.trim()}%`;
        const { data: piData, error: piErr } = await supabase
            .from('pedido_pwa_items')
            .select('pedido_pwa_id')
            .ilike('item_nombre', q);
        if (piErr) throw piErr;
        const ids = Array.from(new Set((piData ?? []).map((r: any) => r.pedido_pwa_id)));
        pedidoIdsByProduct = ids.length ? ids : ['__none__'];
      }

      let query = supabase
        .from('pedidos_pwa')
        .select(
          `
          id,
          estado,
          created_at,
          user_id,
          app_users ( name ), 
          pedido_pwa_items (
            item_nombre,
            cantidad
          )
        `,
          { count: 'exact' }
        )
        .eq('cafeteria_id', cafeteriaId)
        .in('estado', ['pendiente', 'preparando', 'listo', 'entregado']) 
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false });

      if (pedidoIdsByProduct) query = query.in('id', pedidoIdsByProduct);
      
      query = query.range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;
      
      const unifiedRows: PedidoHistorial[] = (data as any[] || []).map(p => ({
        id: p.id,
        fuente: 'pwa',
        created_at: p.created_at,
        estado: p.estado as EstadoPedido,
        nombre_lugar: "App",
        nombre_cliente: p.app_users?.name || p.user_id,
        notas: null,
        items: (p.pedido_pwa_items || []).map((pi: any) => ({
          nombre: pi.item_nombre,
          cantidad: pi.cantidad,
          nota: null,
          tipo: 'pwa'
        }))
      }));
      
      setRows(unifiedRows);
      const total = typeof count === 'number' ? count : unifiedRows.length;
      setHasMore(from + unifiedRows.length < total);
      if (opts?.reset) setPage(1);

      setLoading(false);
  };

  useEffect(() => {
    if (!cafeteriaId) return;
    fetchHistorial({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, fuente, cafeteriaId]);

  const onBuscar = async () => {
    await fetchHistorial({ reset: true });
  };

  const onReset = () => {
    setFuente('mesas');
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

  useEffect(() => {
    fetchHistorial(); // No resetea en cambio de página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  
  const isPWA = fuente === 'pwa';

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
            <h1 className="text-2xl font-aventura tracking-wide text-white">Historial de pedidos</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="rounded-xl border bg-white text-slate-800 shadow-sm">
            <div className="p-6 grid gap-6">
              {/* Filtros */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Filtros</CardTitle>
                  <CardDescription className="text-slate-600">
                    Refina tu búsqueda por fuente, fechas y producto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-6">
                  
                    {/* ✨ Selector de Fuente */}
                    <div className="md:col-span-1">
                      <Label className="text-slate-800">Fuente</Label>
                      <Select value={fuente} onValueChange={(v) => setFuente(v as FuentePedido)}>
                        <SelectTrigger className="bg-white text-slate-900">
                          <SelectValue placeholder="Fuente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mesas">Salas</SelectItem>
                          <SelectItem value="pwa">App</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-1">
                      <Label className="text-slate-800">Sala</Label>
                      <Select value={salaId} onValueChange={setSalaId} disabled={isPWA}>
                        <SelectTrigger className="bg-white text-slate-900 disabled:opacity-70">
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

                    <div className="md:col-span-2">
                      <Label className="text-slate-800">Cliente (Salas)</Label>
                      <Input
                        value={cliente}
                        onChange={(e) => setCliente(e.target.value)}
                        placeholder="Nombre del cliente"
                        className="bg-white text-slate-900 placeholder:text-slate-500 disabled:opacity-70"
                        disabled={isPWA} 
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label className="text-slate-800">Producto</Label>
                      <Input
                        value={producto}
                        onChange={(e) => setProducto(e.target.value)}
                        placeholder="Ej: Americano"
                        className="bg-white text-slate-900 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Label className="text-slate-800">Desde</Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="bg-white text-slate-900"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Label className="text-slate-800">Hasta</Label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="bg-white text-slate-900"
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
                    const Icon = p.fuente === 'mesas' ? DoorOpen : Users;
                    return (
                      <Card key={p.id} className="bg-transparent shadow-none border border-slate-200 overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-slate-900 flex items-center gap-2">
                                <Icon className="h-5 w-5" />
                                {p.nombre_lugar}
                              </CardTitle>
                              <CardDescription className="text-slate-600 space-x-2">
                                <span>{new Date(p.created_at).toLocaleString()}</span>
                                
                                {p.nombre_cliente && (
                                  <>
                                    <span>•</span>
                                    <span>Cliente: {p.nombre_cliente}</span>
                                  </>
                                )}
                              </CardDescription>
                              {p.notas && (
                                <div className="mt-1 text-sm text-slate-700">
                                  <span className="font-medium text-slate-900">Notas: </span>
                                  <span className="whitespace-pre-wrap break-words">{p.notas}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  p.estado === 'pendiente'
                                    ? 'bg-red-600 text-white'
                                    : p.estado === 'preparando'
                                    ? 'bg-amber-500 text-black'
                                    : (p.estado === 'listo' || p.estado === 'entregado')
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
                          {p.items?.length ? (
                            <ul className="text-sm divide-y divide-slate-200">
                              {p.items.map((pi, idx) => (
                                <li key={idx} className="py-2 flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="font-medium leading-snug line-clamp-1 text-slate-900">
                                      {pi.nombre}
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
                  <div className="text-orange flex items-center justify-between mt-2">
                    <Button variant="outline" onClick={prevPage} disabled={page <= 1 || loading}>
                      Anterior
                    </Button>
                    <span className="text-slate-700">Página {page}</span>
                    <Button variant="outline" onClick={nextPage} disabled={!hasMore || loading}>
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