// src/components/NewOrderListener.tsx
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function NewOrderListener() {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlayRef = useRef(false);

  useEffect(() => {
    // preparar audio
    audioRef.current = new Audio('/assets/sounds/new-order.mp3');
    audioRef.current.preload = 'auto';

    // si el navegador bloquea, reintentar al primer click
    const unlock = () => {
      if (!audioRef.current) return;
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);

    // canal realtime: INSERT en pedidos
    const channel = supabase
      .channel('new-orders-listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        async (payload) => {
          const pedido = payload.new as { mesa_id: string; total?: number };
          // obtener nombre de mesa (el payload no trae relaciones)
          let mesaNombre = '';
          try {
            const { data } = await supabase
              .from('mesas')
              .select('nombre')
              .eq('id', pedido.mesa_id)
              .single();
            mesaNombre = data?.nombre || '';
          } catch {}

          // sonido
          try {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              await audioRef.current.play();
            }
          } catch {
            pendingPlayRef.current = true;
          }

          // toast navegable
          toast({
            title: '¡Nuevo pedido!',
            description: mesaNombre ? `Mesa ${mesaNombre} realizó un pedido` : 'Se registró un nuevo pedido',
            action: (
              <button
                onClick={() => navigate('/admin/pedidos')}
                className="ml-2 rounded-md border px-2 py-1 text-sm hover:bg-muted"
              >
                Ver pedidos
              </button>
            ),
          });

          // (opcional) notificación nativa si tienes permiso
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Nuevo pedido', {
              body: mesaNombre ? `Mesa ${mesaNombre}` : 'Pedido recibido',
              icon: '/assets/logo-notif.png',
              badge: '/assets/logo-notif.png',
            });
          }
        }
      )
      .subscribe();

    // pedir permiso de notificación si está en default
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('pointerdown', unlock);
    };
  }, [navigate]);

  return null;
}
