// src/pages/admin/Pedidos.tsx
import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, Clock, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type EstadoPedido = 'pendiente' | 'preparando' | 'listo' | 'cancelado' | 'liquidado';

type PedidoRow = {
  id: string;
  mesa_id: string;
  tipo: 'productos' | 'canciones' | 'mixto';
  estado: EstadoPedido;
  created_at: string;
  name_user: string | null;
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

  useEffect(() => {
    fetchPedidosAndMesas();

    // Realtime: refresca pedidos (el SONIDO lo maneja NewOrderListener globalmente)
    const channel = supabase
      .channel('pedidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchPedidosAndMesas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido_items' }, fetchPedidosAndMesas)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPedidosAndMesas = async () => {
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
          pedido_items (
            cantidad,
            nota,
            items ( nombre, tipo )
          )
        `)
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
          .in('id', mesaIds);

        if (mesasErr) throw mesasErr;

        const map: Record<string, string> = {};
        (mesasData ?? []).forEach((m: any) => { map[m.id] = m.nombre; });
        setMesaNombreById(map);
      } else {
        setMesaNombreById({});
      }
    } catch (error) {
      console.error('Error cargando pedidos/mesas:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los pedidos', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getNextEstado = (e: EstadoPedido): EstadoPedido | undefined => {
    switch (e) {
      case 'pendiente':   return 'preparando';
      case 'preparando':  return 'listo';
      default:            return undefined;
    }
  };

  const updateEstado = async (pedidoId: string, next?: EstadoPedido) => {
    if (!next) return;
    try {
      const { error } = await supabase.from('pedidos').update({ estado: next }).eq('id', pedidoId);
      if (error) throw error;
      await fetchPedidosAndMesas();
      toast({ title: 'Estado actualizado', description: `Ahora está ${next}.` });
    } catch (e: any) {
      console.error('[updateEstado] error', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo actualizar el estado', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-4" />
          <p className="text-white/80">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-aventura tracking-wide text-white">
              Pedidos en tiempo real
            </h1>
            <Badge className="badge ml-2">{pedidos.length} activos</Badge>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {pedidos.length === 0 ? (
            <Card className="dashboard-card">
              <CardContent className="pt-6 card-inner">
                <div className="text-center text-white/85">
                  <Clock className="mx-auto h-12 w-12 mb-4 opacity-90" />
                  <p>No hay pedidos activos en este momento</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pedidos.map((pedido) => {
                const salaNombre = mesaNombreById[pedido.mesa_id] ?? 'Sala';
                const next = getNextEstado(pedido.estado);

                return (
                  <Card key={pedido.id} className="dashboard-card overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="card-title flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            {salaNombre}
                          </CardTitle>
                          <CardDescription className="card-subtitle space-x-2">
                            <span>{new Date(pedido.created_at).toLocaleString()}</span>
                            <span>•</span>
                            <span>Tipo: {pedido.tipo}</span>
                          </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Badge por estado */}
                          {pedido.estado === 'pendiente' && (
                            <Badge className="badge">pendiente</Badge>
                          )}
                          {pedido.estado === 'preparando' && (
                            <Badge className="badge badge--accent">preparando</Badge>
                          )}
                          {pedido.estado === 'listo' && (
                            <Badge className="badge">listo</Badge>
                          )}

                          {next && (
                            <Button size="sm" className="btn-accent" onClick={() => updateEstado(pedido.id, next)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              {`Marcar como ${next}`}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Ítems: nombre del producto — nombre del cliente (misma línea) */}
                    <CardContent className="pt-0 card-inner">
                      {pedido.pedido_items?.length ? (
                        <ul className="text-sm divide-y divide-white/10">
                          {pedido.pedido_items.map((pi, idx) => (
                            <li key={idx} className="py-2 flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="font-medium leading-snug line-clamp-1 text-white">
                                  {pi.items?.nombre}
                                  {pedido.name_user ? ` — ${pedido.name_user}` : ''}
                                </div>
                                {pi.nota && (
                                  <div className="text-xs text-white/80">Nota: {pi.nota}</div>
                                )}
                              </div>
                              <div className="shrink-0">
                                <Badge className="badge">x{pi.cantidad}</Badge>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-white/85">Sin ítems asociados.</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default AdminPedidos;
