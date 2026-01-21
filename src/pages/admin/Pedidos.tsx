import { useEffect, useRef, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, Clock, Package, StickyNote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

type EstadoPedido = 'pendiente' | 'preparando' | 'listo' | 'cancelado';

type PedidoRow = {
  id: string;
  mesa_id: string;
  tipo: 'productos';
  estado: EstadoPedido;
  created_at: string;
  name_user: string | null;
  notas: string | null;
  cafeteria_id: string;
  pedido_items: {
    cantidad: number;
    nota?: string | null;
    items: { nombre: string; tipo: 'producto' | 'cancion' };
  }[];
};

const AdminPedidos = () => {
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [mesaNombreById, setMesaNombreById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [cafeteriaId, setCafeteriaId] = useState<string | null>(
    () => localStorage.getItem(CAFETERIA_LS_KEY)
  );

  /* ============================
   * SONIDO
   * ============================ */
  const audioEnabledRef = useRef(true);
  const beepRef = useRef<HTMLAudioElement | null>(null);
  const audioSrc =
    'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQAAAnEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  useEffect(() => {
    beepRef.current = new Audio(audioSrc);
    beepRef.current.preload = 'auto';
    beepRef.current.play().catch(() => {
      const unlock = () => {
        beepRef.current?.play().catch(() => {});
        document.removeEventListener('pointerdown', unlock);
      };
      document.addEventListener('pointerdown', unlock, { once: true });
    });
  }, []);

  const playDing = async () => {
    if (!audioEnabledRef.current) return;
    try {
      await beepRef.current?.play();
    } catch {}
  };

  /* ============================
   * ESCUCHAR CAMBIO CAFETERÍA
   * ============================ */
  useEffect(() => {
    const onCafeteriaChange = () => {
      setCafeteriaId(localStorage.getItem(CAFETERIA_LS_KEY));
    };

    window.addEventListener('cafeteria-change', onCafeteriaChange);
    return () => window.removeEventListener('cafeteria-change', onCafeteriaChange);
  }, []);

  /* ============================
   * REALTIME
   * ============================ */
  useEffect(() => {
    fetchPedidosAndMesas();

    const channel = supabase
      .channel('pedidos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, async () => {
        await playDing();
        fetchPedidosAndMesas();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchPedidosAndMesas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido_items' }, fetchPedidosAndMesas)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafeteriaId]);

  /* ============================
   * FETCH PEDIDOS + MESAS
   * ============================ */
  const fetchPedidosAndMesas = async () => {
    if (!cafeteriaId) {
      setPedidos([]);
      setMesaNombreById({});
      return;
    }

    try {
      setIsLoading(true);

      const { data: pedidosData, error: pedErr } = await supabase
        .from('pedidos')
        .select(`
          id,
          mesa_id,
          tipo,
          estado,
          created_at,
          name_user,
          notas,
          cafeteria_id,
          pedido_items (
            cantidad,
            nota,
            items ( nombre, tipo )
          )
        `)
        .eq('cafeteria_id', cafeteriaId)
        .in('estado', ['pendiente', 'preparando'])
        .order('created_at', { ascending: false });

      if (pedErr) throw pedErr;

      const list = (pedidosData as PedidoRow[]) ?? [];
      setPedidos(list);

      const mesaIds = Array.from(new Set(list.map(p => p.mesa_id))).filter(Boolean);

      if (mesaIds.length) {
        const { data: mesasData, error: mesasErr } = await supabase
          .from('mesas')
          .select('id, nombre')
          .eq('cafeteria_id', cafeteriaId)
          .in('id', mesaIds);

        if (mesasErr) throw mesasErr;

        const map: Record<string, string> = {};
        (mesasData ?? []).forEach((m: any) => {
          map[m.id] = m.nombre;
        });
        setMesaNombreById(map);
      } else {
        setMesaNombreById({});
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los pedidos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ============================
   * ESTADOS
   * ============================ */
  const getNextEstado = (e: EstadoPedido): EstadoPedido | undefined => {
    switch (e) {
      case 'pendiente':
        return 'preparando';
      case 'preparando':
        return 'listo';
      default:
        return undefined;
    }
  };

  const updateEstado = async (pedidoId: string, next?: EstadoPedido) => {
    if (!next) return;
    try {
      const { error } = await supabase.from('pedidos').update({ estado: next }).eq('id', pedidoId);
      if (error) throw error;
      fetchPedidosAndMesas();
      toast({ title: 'Estado actualizado', description: `Ahora está ${next}.` });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p>Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  /* ============================
   * RENDER
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
              Pedidos en tiempo real
            </h1>
            <Badge variant="secondary">{pedidos.length} activos</Badge>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="rounded-xl border bg-white text-slate-800 shadow-sm">
            <div className="p-6">
              {pedidos.length === 0 ? (
                <Card className="bg-transparent shadow-none border border-slate-200">
                  <CardContent className="pt-6">
                    <div className="text-center text-slate-600">
                      <Clock className="mx-auto h-12 w-12 mb-4" />
                      <p>No hay pedidos activos en este momento</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pedidos.map((pedido) => {
                    const mesaNombre = mesaNombreById[pedido.mesa_id] ?? 'Mesa';
                    const next = getNextEstado(pedido.estado);

                    return (
                      <Card
                        key={pedido.id}
                        className="bg-transparent shadow-none border border-slate-200 overflow-hidden"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-slate-900">
                                <Package className="h-5 w-5" />
                                {mesaNombre}
                              </CardTitle>
                              <CardDescription className="space-x-2 text-slate-600">
                                <span>{new Date(pedido.created_at).toLocaleString()}</span>
                                <span>•</span>
                                <span>Tipo: {pedido.tipo}</span>
                                {pedido.name_user && (
                                  <>
                                    <span>•</span>
                                    <span>Cliente: {pedido.name_user}</span>
                                  </>
                                )}
                              </CardDescription>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  pedido.estado === 'pendiente'
                                    ? 'bg-red-600 text-white'
                                    : pedido.estado === 'preparando'
                                    ? 'bg-amber-500 text-black'
                                    : 'bg-slate-300 text-slate-800'
                                }
                              >
                                {pedido.estado}
                              </Badge>

                              {next && (
                                <Button size="sm" onClick={() => updateEstado(pedido.id, next)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  {`Marcar como ${next}`}
                                </Button>
                              )}
                            </div>
                          </div>

                          {pedido.notas && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 flex items-start gap-2">
                              <StickyNote className="h-4 w-4 mt-0.5 opacity-70" />
                              <span className="whitespace-pre-wrap">{pedido.notas}</span>
                            </div>
                          )}
                        </CardHeader>

                        <CardContent className="pt-0">
                          {pedido.pedido_items?.length ? (
                            <ul className="text-sm divide-y divide-slate-200">
                              {pedido.pedido_items.map((pi, idx) => (
                                <li
                                  key={idx}
                                  className="py-2 flex items-start justify-between gap-4"
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium leading-snug line-clamp-1 text-slate-900">
                                      {pi.items?.nombre}
                                    </div>
                                    {pi.nota && (
                                      <div className="text-xs text-slate-600">
                                        Nota: {pi.nota}
                                      </div>
                                    )}
                                  </div>
                                  <div className="shrink-0">
                                    <Badge className="bg-slate-900 text-white">
                                      x{pi.cantidad}
                                    </Badge>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-sm text-slate-600">
                              Sin ítems asociados.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default AdminPedidos;
