// src/pages/ClientPedidoStatus.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, Star } from 'lucide-react';

// fondos / branding
import adminBg from '/assets/movil-bg-diademuertos.png';
import adminBgDesktop from '/assets/admin-bg-diademuertos.png';
import logo from '/assets/logo-admin-diademuertos.png';

type Pedido = {
  id: string;
  mesa_id: string;
  name_user: string | null;
  estado: string | null; // 'pendiente' | 'preparando' | 'listo'
  created_at?: string | null;
};

type PedidoItemRow = {
  id: string;
  pedido_id: string;
  item_id: string;
  cantidad: number;
  nota?: string | null;
  items: { id: string; nombre: string; image_url?: string | null } | null;
};

function pasoEstado(e?: string | null) {
  const v = (e || '').toLowerCase();
  if (v === 'listo') return 2;
  if (v === 'preparando') return 1;
  return 0; // pendiente
}
function labelEstado(e?: string | null) {
  const v = (e || '').toLowerCase();
  if (v === 'preparando') return 'En preparación';
  if (v === 'listo') return 'Listo';
  return 'Pendiente';
}

/** Estrellas clicables */
function StarRating({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  ariaLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-1" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover ?? value) >= n;
        return (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange(n)}
            className="p-0.5"
            aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
          >
            <Star className={`h-6 w-6 ${active ? 'fill-yellow-400 stroke-yellow-500' : 'stroke-gray-400'}`} />
          </button>
        );
      })}
    </div>
  );
}

/** Segmento de barra; current = animado */
function Segment({
  filled,
  current,
}: {
  filled: boolean;
  current: boolean;
}) {
  return (
    <div className="h-2 rounded-full bg-gray-200 overflow-hidden relative">
      {filled && <div className="absolute inset-0 bg-green-600" />}
      {current && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-400"
          style={{
            backgroundSize: '200% 100%',
            animation: 'stripeMove 1.1s linear infinite',
            maskImage:
              'repeating-linear-gradient(100deg, #000 0 16px, rgba(0,0,0,0.6) 16px 28px)',
            WebkitMaskImage:
              'repeating-linear-gradient(100deg, #000 0 16px, rgba(0,0,0,0.6) 16px 28px)',
          }}
        />
      )}
    </div>
  );
}

export default function ClientPedidoStatus() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = searchParams.get('t') || '';

  // fondo responsivo
  const [bgUrl, setBgUrl] = useState<string>(adminBg);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setBgUrl(mq.matches ? adminBgDesktop : adminBg);
    apply();
    if (mq.addEventListener) {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    } else {
      // @ts-ignore
      mq.addListener(apply);
      return () => {
        // @ts-ignore
        mq.removeListener(apply);
      };
    }
  }, []);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<PedidoItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  // encuesta (sin audio)
  const [showSurvey, setShowSurvey] = useState(false);
  const [ratingServicio, setRatingServicio] = useState<number>(5);
  const [ratingSistema, setRatingSistema] = useState<number>(5);
  const [comentario, setComentario] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [sendingSurvey, setSendingSurvey] = useState(false);
  const [showThanks, setShowThanks] = useState(false);

  const needsComment = useMemo(
    () => ratingServicio < 4 || ratingSistema < 4,
    [ratingServicio, ratingSistema]
  );

  const itemNames = useMemo(
    () => items.map((r) => r.items?.nombre).filter(Boolean) as string[],
    [items]
  );
  const firstImage =
    useMemo(() => items.find((r) => r.items?.image_url)?.items?.image_url, [items]) || logo;

  // ---- LOGICA "VOLVER A LA CARTA" ----
  const goBack = () => {
    // 1) Si hay historial útil, retroceder
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    // 2) Si venimos con state.returnTo desde ClientMesa, úsalo
    const state = location.state as { returnTo?: string } | null;
    const returnTo = state?.returnTo;
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    // 3) Respaldo: URL guardada al escanear el QR
    let stored = '';
    try { stored = sessionStorage.getItem('qr:return') || ''; } catch {}
    if (stored) {
      const sameOrigin = stored.startsWith(window.location.origin);
      if (sameOrigin) {
        const path = stored.replace(window.location.origin, '');
        navigate(path, { replace: true });
      } else {
        window.location.assign(stored);
      }
      return;
    }
    // 4) Último fallback: landing con token
    navigate(token ? `/landing?t=${token}` : '/landing', { replace: true });
  };

  // Carga + validar token
  useEffect(() => {
    let cancelled = false;
    if (!id || !token) {
      navigate('/landing?alert=mesa-invalida', { replace: true });
      return;
    }

    (async () => {
      try {
        // 1) pedido
        const { data: p, error: pe } = await supabase
          .from('pedidos')
          .select('id, mesa_id, name_user, estado, created_at')
          .eq('id', id)
          .maybeSingle();
        if (pe || !p) throw new Error('Pedido no encontrado');

        if (cancelled) return;

        // 2) validar token pertenece a mesa del pedido
        const { data: m, error: me } = await supabase
          .from('mesas')
          .select('id, token, activa')
          .eq('id', p.mesa_id)
          .maybeSingle();
        if (me || !m || !m.activa || m.token !== token) {
          navigate('/landing?alert=sala-inactiva', { replace: true });
          return;
        }

        setPedido(p as Pedido);

        // 3) items
        const { data: pi, error: pie } = await supabase
          .from('pedido_items')
          .select('id, pedido_id, item_id, cantidad, nota, items(id, nombre, image_url)')
          .eq('pedido_id', id);
        if (pie) throw pie;

        if (cancelled) return;
        setItems((pi || []) as PedidoItemRow[]);
      } catch (e: any) {
        toast({ title: 'Error', description: e?.message || 'No se pudo cargar el pedido', variant: 'destructive' });
        navigate('/landing?alert=sala-inactiva', { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Realtime
    const chPedido = supabase
      .channel(`pedido_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` },
        (payload) => setPedido(prev => ({ ...(prev || {}), ...(payload.new as Pedido) }))
      )
      .subscribe();

    const chItems = supabase
      .channel(`pedido_items_${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedido_items', filter: `pedido_id=eq.${id}` },
        async () => {
          const { data } = await supabase
            .from('pedido_items')
            .select('id, pedido_id, item_id, cantidad, nota, items(id, nombre, image_url)')
            .eq('pedido_id', id);
          setItems((data || []) as PedidoItemRow[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chPedido);
      supabase.removeChannel(chItems);
    };
  }, [id, token, navigate]);

  // Notificación + abrir encuesta cuando pase a "listo"
  const prevPasoRef = useRef<number>(0);
  useEffect(() => {
    const curPaso = pasoEstado(pedido?.estado);
    const prevPaso = prevPasoRef.current;

    if (prevPaso < 2 && curPaso === 2) {
      const texto = (() => {
        const names = itemNames;
        if (!names.length) return 'Tu pedido está listo.';
        return names.length === 1 ? `Tu ${names[0]} está listo.` : `Tus ${names.join(', ')} están listos.`;
      })();

      toast({ title: '¡Listo! 🎉', description: texto });

      const t = setTimeout(() => setShowSurvey(true), 5000);
      prevPasoRef.current = curPaso;
      return () => clearTimeout(t);
    }
    prevPasoRef.current = curPaso;
  }, [pedido?.estado, itemNames]);

  const handleSurveyOpenChange = (open: boolean) => {
    setShowSurvey(open);
    if (!open) setShowThanks(true);
  };

  const submitSurvey = async () => {
    if (!pedido) return;

    if (needsComment && !comentario.trim()) {
      toast({
        title: 'Falta tu comentario',
        description: 'Por favor cuéntanos qué podemos mejorar cuando la calificación es menor a 3.',
        variant: 'destructive',
      });
      textareaRef.current?.focus();
      return;
    }

    try {
      setSendingSurvey(true);
      const { error } = await supabase.from('encuestas').insert({
        pedido_id: pedido.id,
        mesa_id: pedido.mesa_id,
        rating_servicio: ratingServicio,
        rating_sistema: ratingSistema,
        comentario: comentario?.trim() || null,
      });
      if (error) throw error;
      setShowSurvey(false);
      setShowThanks(true);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo enviar la encuesta', variant: 'destructive' });
    } finally {
      setSendingSurvey(false);
    }
  };

  // paso calculado para condicionar el botón
  const paso = useMemo(() => pasoEstado(pedido?.estado), [pedido?.estado]);

  // ──────────────── UI ─────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p>Cargando…</p>
        </div>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Pedido no disponible</CardTitle>
            <CardDescription>Verifica el enlace o regresa a la mesa.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={goBack}>Volver a la carta</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* keyframes locales para barra animada */}
      <style>{`
        @keyframes stripeMove {
          0% { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* Fondo responsivo */}
      <div className="fixed inset-0 -z-10">
        <div
          className="h-full w-full bg-no-repeat bg-center bg-cover"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
        <div className="absolute inset-0 bg-black/25" />
      </div>

      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-9 w-9 rounded object-contain" />
            <div>
              <h1 className="text-base md:text-lg font-semibold leading-tight">
                <span className="font-bold">Seguimiento de pedido</span>
              </h1>
              <p className="text-xs text-muted-foreground -mt-0.5">
                {pedido.name_user ? `Para: ${pedido.name_user}` : 'En tiempo real'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {paso === 2 && (
              <Button size="sm" variant="ghost" onClick={goBack}>
                Volver a la carta
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-8">
          {/* Progreso */}
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Progreso</div>
            </div>
            <div className="px-4 pb-5 space-y-2">
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>Pendiente</span>
                <span>En preparación</span>
                <span>Listo</span>
              </div>

              <div className="flex gap-2 items-center">
                <div className="flex-[1]"><Segment filled={paso > 0} current={paso === 0} /></div>
                <div className="flex-[2]"><Segment filled={paso > 1} current={paso === 1} /></div>
                <div className="flex-[1]"><Segment filled={paso > 2} current={paso === 2} /></div>
              </div>

              <div className="flex items-center gap-3 mt-3">
                {paso === 2 ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
                <Badge variant={paso === 2 ? 'default' : 'secondary'} className="text-sm">
                  {labelEstado(pedido?.estado).toUpperCase()}
                </Badge>
              </div>
            </div>
          </section>

          {/* Detalle del pedido */}
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Tu pedido</div>
            </div>
            <div className="px-4 pb-4">
              <ul className="divide-y">
                {items.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="min-w-0">
                      <div className="font-medium text-[15px] leading-snug line-clamp-1">
                        {r.cantidad}× {r.items?.nombre || '—'}
                      </div>
                      {r.nota && <div className="text-[12px] text-muted-foreground">{r.nota}</div>}
                    </div>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="py-6 text-sm text-muted-foreground">No se encontraron ítems para este pedido.</li>
                )}
              </ul>

              {/* BLOQUE LISTO con botón adicional cerca del contenido */}
              {paso === 2 && (
                <div className="mt-4">
                  <div className="rounded-xl overflow-hidden bg-black/5 aspect-[16/9] mb-3">
                    <img src={firstImage} alt="Pedido listo" className="h-full w-full object-cover" />
                  </div>
                  <div className="rounded-lg p-4 bg-green-50 border border-green-200">
                    <div className="font-semibold">¡Listo! 🎉</div>
                    <div className="text-sm text-green-800">
                      {(() => {
                        const names = itemNames;
                        const texto = names.length
                          ? (names.length === 1 ? names[0]! : names.join(', '))
                          : 'pedido';
                        return <>Disfruta tu {texto}.</>;
                      })()}
                    </div>

                    <div className="mt-3">
                      <Button onClick={goBack}>Volver a la carta</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Encuesta con estrellas */}
      <Dialog open={showSurvey} onOpenChange={handleSurveyOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>¿Cómo estuvo el servicio?</DialogTitle>
          </DialogHeader>

        <div className="space-y-5">
            <div className="space-y-2">
              <Label>Califica el servicio</Label>
              <StarRating value={ratingServicio} onChange={setRatingServicio} ariaLabel="Calificación servicio" />
            </div>

            <div className="space-y-2">
              <Label>Califica el sistema</Label>
              <StarRating value={ratingSistema} onChange={setRatingSistema} ariaLabel="Calificación sistema" />
            </div>

            {/* Comentario con obligatoriedad condicional */}
            <div className="space-y-2">
              <Label>
                Comentario {needsComment && <span className="text-red-600 font-medium">*</span>}
                <span className="block text-xs text-muted-foreground">
                  {needsComment ? 'Obligatorio cuando alguna calificación es menor igual a 3.' : 'Opcional'}
                </span>
              </Label>
              <Textarea
                ref={textareaRef}
                rows={3}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder={needsComment ? 'Cuéntanos qué podemos mejorar…' : '¿Algo que podamos mejorar?'}
                aria-invalid={needsComment && !comentario.trim() ? 'true' : 'false'}
                className={needsComment && !comentario.trim() ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {needsComment && !comentario.trim() && (
                <p className="text-xs text-red-600">Este campo es obligatorio por la calificación ingresada.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSurvey(false)}>Cerrar</Button>
            <Button onClick={submitSurvey} disabled={sendingSurvey || (needsComment && !comentario.trim())}>
              {sendingSurvey ? 'Enviando…' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de agradecimiento */}
      <Dialog open={showThanks} onOpenChange={(o) => setShowThanks(o)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>¡Gracias por tu opinión! ✨</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Estamos mejorando constantemente gracias a tus comentarios.
          </div>
          <DialogFooter>
            <Button onClick={() => setShowThanks(false)}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
