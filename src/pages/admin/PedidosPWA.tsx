import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Check,
  CookingPot,
  Package,
  Send,
  PackageCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

/* =========================
 * Tipos
 * ========================= */
type EstadoPWAPedido =
  | 'pendiente'
  | 'preparando'
  | 'listo'
  | 'entregado'
  | 'cancelado';

type PedidoPWAItem = {
  item_nombre: string;
  cantidad: number;
};

type PedidoPWA = {
  id: string;
  estado: EstadoPWAPedido;
  created_at: string;
  updated_at: string;
  calificado: boolean;
  cafeteria_id: string;
  app_users: {
    name: string | null;
  } | null;
  pedido_pwa_items: PedidoPWAItem[];
};

const QUERY = `
  id,
  estado,
  created_at,
  updated_at,
  calificado,
  cafeteria_id,
  app_users ( name ),
  pedido_pwa_items ( item_nombre, cantidad )
`;

const FILTER = `
  estado.in.("pendiente","preparando","listo"),
  and(estado.eq.entregado,calificado.eq.false)
`;

export default function PedidosPWA() {
  const { isDAC, isStaff } = useAuth();
  const canView = isDAC || isStaff;

  const [cafeteriaId, setCafeteriaId] = useState<string | null>(() =>
    localStorage.getItem(CAFETERIA_LS_KEY)
  );

  const [pedidos, setPedidos] = useState<PedidoPWA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitialLoadDone = useRef(false);

  /* =====================================================
   * Escuchar cambio de cafetería (SIN REFRESH)
   * ===================================================== */
  useEffect(() => {
    const handler = () => {
      setCafeteriaId(localStorage.getItem(CAFETERIA_LS_KEY));
    };
    window.addEventListener('cafeteria-change', handler);
    return () => window.removeEventListener('cafeteria-change', handler);
  }, []);

  /* =====================================================
   * Fetch silencioso (realtime + polling)
   * ===================================================== */
  const fetchSilencioso = useCallback(async () => {
    if (!canView || !cafeteriaId) return;

    const { data, error } = await supabase
      .from('pedidos_pwa')
      .select(QUERY)
      .eq('cafeteria_id', cafeteriaId)
      .or(
        'estado.in.(pendiente,preparando,listo),and(estado.eq.entregado,calificado.eq.false)'
      )
      .order('created_at', { ascending: true });

    if (error) {
      if (isInitialLoadDone.current) {
        toast({
          title: 'Error de Red',
          description: 'No se pudo sincronizar.',
          variant: 'destructive',
        });
      }
      console.error(error);
    } else {
      setPedidos(data || []);
    }
  }, [canView, cafeteriaId]);

  /* =====================================================
   * Carga inicial (cada vez que cambia cafetería)
   * ===================================================== */
  const fetchPedidosInicial = useCallback(async () => {
    if (!canView || !cafeteriaId) {
      setPedidos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    isInitialLoadDone.current = false;

    const { data, error } = await supabase
      .from('pedidos_pwa')
      .select(QUERY)
      .eq('cafeteria_id', cafeteriaId)
      .or(
        'estado.in.(pendiente,preparando,listo),and(estado.eq.entregado,calificado.eq.false)'
      )
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setError(error.message);
      setPedidos([]);
    } else {
      setPedidos(data || []);
    }

    setLoading(false);
    isInitialLoadDone.current = true;
  }, [canView, cafeteriaId]);

  useEffect(() => {
    fetchPedidosInicial();
  }, [fetchPedidosInicial]);

  /* =====================================================
   * Realtime
   * ===================================================== */
  useEffect(() => {
    if (!canView || !cafeteriaId) return;

    const channel = supabase
      .channel(`pedidos-pwa-${cafeteriaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos_pwa' },
        (payload) => {
          const nuevo = payload.new as PedidoPWA;

          if (
            payload.eventType === 'INSERT' &&
            nuevo.estado === 'pendiente' &&
            audioRef.current
          ) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }

          fetchSilencioso();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canView, cafeteriaId, fetchSilencioso]);

  /* =====================================================
   * Polling de respaldo
   * ===================================================== */
  useEffect(() => {
    if (!canView || !cafeteriaId) return;
    const i = setInterval(fetchSilencioso, 5000);
    return () => clearInterval(i);
  }, [canView, cafeteriaId, fetchSilencioso]);

  /* =====================================================
   * Kanban columns
   * ===================================================== */
  const { pendientes, preparando, listos, entregados } = useMemo(
    () => ({
      pendientes: pedidos.filter((p) => p.estado === 'pendiente'),
      preparando: pedidos.filter((p) => p.estado === 'preparando'),
      listos: pedidos.filter((p) => p.estado === 'listo'),
      entregados: pedidos.filter(
        (p) => p.estado === 'entregado' && !p.calificado
      ),
    }),
    [pedidos]
  );

  if (!canView) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-white">Acceso Denegado</h1>
          <p className="text-white/80">
            No tienes permisos para ver esta sección.
          </p>
          <Link to="/admin">
            <Button variant="outline" className="mt-4">
              Volver al Dashboard
            </Button>
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <audio ref={audioRef} src="/assets/notify.mp3" preload="auto" />

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
              Pedidos PWA (Empleados)
            </h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {loading && pedidos.length === 0 && (
            <div className="text-center text-white/80">
              Cargando pedidos...
            </div>
          )}

          {!loading && pedidos.length === 0 && !error && (
            <Card className="bg-white text-slate-800 shadow-lg">
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-slate-400" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  No hay pedidos activos
                </h3>
                <p className="mt-1 text-slate-600">
                  Los nuevos pedidos de la PWA aparecerán aquí.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KanbanColumn
              title="Pendiente"
              pedidos={pendientes}
              icon={<Send className="h-5 w-5" />}
              className="border-red-500"
            />
            <KanbanColumn
              title="Preparando"
              pedidos={preparando}
              icon={<CookingPot className="h-5 w-5" />}
              className="border-amber-500"
            />
            <KanbanColumn
              title="Listo para Retirar"
              pedidos={listos}
              icon={<Check className="h-5 w-5" />}
              className="border-emerald-500"
            />
            <KanbanColumn
              title="Entregado"
              pedidos={entregados}
              icon={<PackageCheck className="h-5 w-5" />}
              className="border-slate-400"
            />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

/* =====================================================
 * Subcomponentes (SIN CAMBIOS DE ESTILO)
 * ===================================================== */

function KanbanColumn({ title, pedidos, icon, className }: any) {
  return (
    <div className="flex flex-col gap-4">
      <h2
        className={`text-xl font-aventura text-white/90 flex items-center gap-2 pb-2 border-b-2 ${className}`}
      >
        {icon}
        {title}
        <Badge variant="secondary" className="ml-2">
          {pedidos.length}
        </Badge>
      </h2>
      {pedidos.map((p: PedidoPWA) => (
        <PedidoPWACard key={p.id} pedido={p} />
      ))}
    </div>
  );
}

function PedidoPWACard({ pedido }: { pedido: PedidoPWA }) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (estado: EstadoPWAPedido) => {
    setIsUpdating(true);
    const { error } = await supabase
      .from('pedidos_pwa')
      .update({ estado })
      .eq('id', pedido.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setIsUpdating(false);
    }
  };

  const tiempo = formatDistanceToNow(new Date(pedido.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <Card
      className={`bg-white text-slate-900 shadow-md ${
        pedido.estado === 'entregado' ? 'opacity-60' : ''
      }`}
    >
      <CardHeader>
        <CardTitle className="text-lg">
          {pedido.app_users?.name || 'Usuario Desconocido'}
        </CardTitle>
        <CardDescription>Pedido {tiempo}</CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="list-disc pl-5 space-y-1">
          {pedido.pedido_pwa_items?.map((item, idx) => (
            <li key={idx}>
              <strong>{item.cantidad}x</strong> {item.item_nombre}
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        {pedido.estado === 'pendiente' && (
          <Button
            onClick={() => handleUpdate('preparando')}
            disabled={isUpdating}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black"
          >
            <CookingPot className="mr-2 h-4 w-4" />
            Marcar como Preparando
          </Button>
        )}

        {pedido.estado === 'preparando' && (
          <Button
            onClick={() => handleUpdate('listo')}
            disabled={isUpdating}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Check className="mr-2 h-4 w-4" />
            Marcar como Listo
          </Button>
        )}

        {pedido.estado === 'listo' && (
          <Button
            onClick={() => handleUpdate('entregado')}
            disabled={isUpdating}
            className="w-full btn-accent"
          >
            <Package className="mr-2 h-4 w-4" />
            Marcar como Entregado
          </Button>
        )}

        {pedido.estado === 'entregado' && (
          <p className="text-sm text-center text-slate-500">
            Pedido completado. Esperando calificación del usuario.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
