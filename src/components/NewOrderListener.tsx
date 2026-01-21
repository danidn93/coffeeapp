import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Clave compartida con AdminLayout
 */
const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

export default function NewOrderListener() {
  const navigate = useNavigate();
  const { user, isStaff } = useAuth();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlayRef = useRef(false);

  /**
   * Solo STAFF escucha pedidos
   */
  const canListen = isStaff && !!user;

  useEffect(() => {
    if (!canListen) return;

    const cafeteriaActiva = localStorage.getItem(CAFETERIA_LS_KEY);

    if (!cafeteriaActiva) return;

    /* =========================
     * AUDIO
     * ========================= */

    audioRef.current = new Audio('/assets/sounds/new-order.mp3');
    audioRef.current.preload = 'auto';

    const playSound = async () => {
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          await audioRef.current.play();
        }
      } catch {
        pendingPlayRef.current = true;
      }
    };

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

    const toastAction = (path: string, text: string) => (
      <button
        onClick={() => navigate(path)}
        className="ml-2 rounded-md border px-2 py-1 text-sm hover:bg-muted"
      >
        {text}
      </button>
    );

    /* =========================
     * REALTIME CHANNEL
     * ========================= */

    const channel = supabase
      .channel(`new-orders-${cafeteriaActiva}`)

      /* === PEDIDOS DE MESAS === */
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos',
          filter: `cafeteria_id=eq.${cafeteriaActiva}`,
        },
        async (payload) => {
          const pedido = payload.new as {
            mesa_id: string;
            cafeteria_id: string;
          };

          let mesaNombre = 'Sala';

          try {
            const { data } = await supabase
              .from('mesas')
              .select('nombre')
              .eq('id', pedido.mesa_id)
              .single();

            mesaNombre = data?.nombre || mesaNombre;
          } catch {}

          await playSound();

          toast({
            title: '¡Nuevo pedido!',
            description: `${mesaNombre} realizó un pedido`,
            action: toastAction('/admin/pedidos', 'Ver pedidos'),
          });

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Nuevo pedido', {
              body: `${mesaNombre} realizó un pedido`,
              icon: '/assets/logo-notif.png',
              badge: '/assets/logo-notif.png',
            });
          }
        }
      )

      /* === PEDIDOS PWA === */
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos_pwa',
          filter: `cafeteria_id=eq.${cafeteriaActiva}`,
        },
        async (payload) => {
          const pedido = payload.new as {
            user_id: string;
            cafeteria_id: string;
          };

          let userName = 'Usuario';

          try {
            const { data } = await supabase
              .from('app_users')
              .select('name')
              .eq('id', pedido.user_id)
              .single();

            userName = data?.name?.split(' ')[0] || userName;
          } catch {}

          await playSound();

          toast({
            title: '¡Nuevo pedido por App!',
            description: `${userName} realizó un pedido`,
            action: toastAction('/admin/pedidos-pwa', 'Ver pedidos App'),
          });

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Nuevo pedido por App', {
              body: `${userName} realizó un pedido`,
              icon: '/assets/logo-notif.png',
              badge: '/assets/logo-notif.png',
            });
          }
        }
      )
      .subscribe();

    /* =========================
     * NOTIFICATIONS PERMISSION
     * ========================= */

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    /* =========================
     * CLEANUP
     * ========================= */

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('pointerdown', unlock);
    };
  }, [navigate, canListen, user?.id]);

  return null;
}
