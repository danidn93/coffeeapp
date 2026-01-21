// src/pages/admin/visitas/PedidosVisitas.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// UI (paleta clara como “Productos”)
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw } from 'lucide-react';

type Pedido = { id: string; created_at: string; name_user: string | null; notas: string | null };

type Item = {
  id: string;
  pedido_id: string;
  categoria: string;            // dinámico para soportar nuevas etiquetas
  item_nombre: string | null;
  nota: string | null;
};

// Helpers para ISO local YYYY-MM-DD sin desfase de zona
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

export default function PedidosVisitas() {
  // 🔁 Default: “mañana”
  const [fecha, setFecha] = useState<string>(() => plusDaysLocalISO(1));

  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState('');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Obtener el id del día por fecha
      const { data: d, error: dErr } = await supabase
        .from('menu_visitas_dias')
        .select('id')
        .eq('fecha', fecha)
        .maybeSingle();

      if (dErr) throw dErr;

      if (!d) {
        setPedidos([]);
        setItems([]);
        return;
      }

      // Pedidos de ese día (ordenados desc)
      const { data: p, error: pErr } = await supabase
        .from('pedidos_visitas')
        .select('*')
        .eq('dia_id', (d as any).id)
        .order('created_at', { ascending: false });

      if (pErr) throw pErr;

      const ids = (p || []).map((x: any) => x.id);
      const { data: i, error: iErr } = ids.length
        ? await supabase
            .from('pedido_items_visitas')
            .select('id,pedido_id,categoria,item_nombre,nota')
            .in('pedido_id', ids)
        : { data: [], error: null };

      if (iErr) throw iErr;

      setPedidos((p || []) as any);
      setItems((i || []) as any);
    } catch (err: any) {
      console.error('[visitas/pedidos] fetchAll', err);
      toast({ title: 'Error', description: err?.message || 'No se pudo cargar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel('visitas-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_visitas' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido_items_visitas' }, fetchAll)
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchAll]);

  // Índice de items por pedido
  const itemsByPedido = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const it of items) {
      if (!map[it.pedido_id]) map[it.pedido_id] = [];
      map[it.pedido_id].push(it);
    }
    return map;
  }, [items]);

  // Filtro por texto
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return pedidos;
    return pedidos.filter(
      (p) =>
        (p.name_user || '').toLowerCase().includes(t) ||
        (p.notas || '').toLowerCase().includes(t) ||
        (itemsByPedido[p.id] || []).some((it) =>
          (it.item_nombre || '').toLowerCase().includes(t)
        )
    );
  }, [pedidos, q, itemsByPedido]);

  // Contadores por categoría (dinámicos, sobre los pedidos filtrados)
  const counters = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of filtered) {
      for (const it of itemsByPedido[p.id] || []) {
        const key = it.categoria || '—';
        c.set(key, (c.get(key) || 0) + 1);
      }
    }
    return c;
  }, [filtered, itemsByPedido]);

  // Orden sugerido para badges (si existen)
  const badgeOrder = [
    'desayuno',
    'bebidas desayuno',
    'almuerzo',
    'bebidas almuerzo',
    'merienda',
    'bebidas merienda',
  ];

  const sortedBadges = useMemo(() => {
    const entries = Array.from(counters.entries());
    return entries.sort((a, b) => {
      const ai = badgeOrder.indexOf(a[0].toLowerCase());
      const bi = badgeOrder.indexOf(b[0].toLowerCase());
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      // fallback: alfabético
      return a[0].localeCompare(b[0]);
    });
  }, [counters]);

  const pretty = (s: string) =>
    (s || '—')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\w/, (m) => m.toUpperCase());

  return (
    <div className="min-h-[60vh]">
      {/* Header claro con botón volver */}
      <header className="admin-header border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/admin">
            <Button variant="outline" size="sm" className="btn-white-hover">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-aventura tracking-wide text-white">Pedidos de visitas</h1>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {sortedBadges.length === 0 ? (
              <Badge className="bg-slate-600 text-white">Sin categorías</Badge>
            ) : (
              sortedBadges.map(([cat, n]) => {
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
        </div>
      </header>

      {/* Contenido */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Card className="mb-6 bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="bg-white text-slate-900"
                />
                <Button variant="secondary" onClick={fetchAll}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refrescar
                </Button>
              </div>
              <div className="md:col-span-2">
                <Input
                  placeholder="Buscar por nombre, notas o producto…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="bg-white text-slate-900 placeholder:text-slate-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">
              Pedidos {loading ? '…' : `(${filtered.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-700">Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-slate-600">No hay pedidos para esta fecha.</p>
            ) : (
              <div className="space-y-4">
                {filtered.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-200 p-4 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-900">
                        {p.name_user || 'Sin nombre'}
                      </div>
                      <div className="text-xs text-slate-600">
                        {new Date(p.created_at).toLocaleTimeString()}
                      </div>
                    </div>

                    {p.notas && (
                      <div className="text-xs text-slate-600 mt-1">
                        <span className="font-medium">Notas:</span> {p.notas}
                      </div>
                    )}

                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Selecciones
                      </div>
                      <ul className="list-disc pl-5 text-sm text-slate-800">
                        {(itemsByPedido[p.id] || [])
                          .sort((a, b) => a.categoria.localeCompare(b.categoria))
                          .map((it) => (
                            <li key={it.id}>
                              <b className="capitalize">{pretty(it.categoria)}:</b>{' '}
                              {it.item_nombre || '—'}
                              {it.nota ? (
                                <span className="text-slate-500"> — {it.nota}</span>
                              ) : null}
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
