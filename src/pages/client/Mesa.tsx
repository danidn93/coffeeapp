// src/pages/ClientMesa.tsx
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// fondos / branding
import adminBg from '/assets/movil-bg-ordinario.png'; //Cambiar según la ocasión
import adminBgDesktop from '/assets/admin-bg-ordinario.png'; //Cambiar según la ocasión
import logo from '/assets/logo-admin-ordinario.png'; //Cambiar según la ocasión

interface Mesa {
  id: string;
  nombre: string;
  slug: string;
  token: string;
  activa: boolean;
  cafeteria_id: string;
  pin_hash?: string | null;
}

interface Item {
  id: string;
  tipo: 'producto' | 'cancion';
  nombre: string;
  artista?: string;
  categoria?: string;
  precio?: number;
  disponible: boolean;
  image_url?: string | null;
  description?: string | null;
}

interface CartItem {
  item: Item;
  cantidad: number;
  nota?: string;
}

const ClientMesa = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || '';

  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Modal: nombre + notas del pedido
  const [showNameModal, setShowNameModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [pendingCreate, setPendingCreate] = useState(false);

  // Buscador productos
  const [qProductos, setQProductos] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  // === Guardar SIEMPRE la URL del QR para "volver a la carta" ===
  useEffect(() => {
    try {
      // Solo guardamos si tiene token válido (evita pisar con rutas internas)
      if (token && slug) {
        sessionStorage.setItem('qr:return', window.location.href);
      }
    } catch {}
  }, [slug, token]);

  // === Fondo responsivo (móvil vs desktop) ===
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

  useEffect(() => {
    // Si faltan parámetros, redirige con alerta
    if (!slug || !token) {
      navigate('/landing?alert=mesa-invalida', { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // 1) ¿Local abierto?
        const { data, error } = await supabase
          .from('configuracion')
          .select('abierto')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        const abierto = error ? true : (data?.abierto ?? true);
        if (!abierto) {
          navigate('/landing?alert=local-cerrado', { replace: true });
          return;
        }

        // 2) ¿Mesa válida/activa con token correcto?
        const ok = await validateMesaAndToken();
        if (!ok) {
          navigate('/landing?alert=sala-inactiva', { replace: true });
          return;
        }

        // 3) Items
        await fetchItems();
      } catch {
        navigate('/landing?alert=sala-inactiva', { replace: true });
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token]);

  const validateMesaAndToken = async () => {
    try {
      const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .eq('slug', slug)
        .eq('token', token)
        .eq('activa', true)
        .maybeSingle();

      if (error || !data) return false;
      setMesa(data as Mesa);
      return true;
    } catch {
      return false;
    }
  };

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('disponible', true)
        .eq('cafeteria_id', mesa.cafeteria_id)
        .order('tipo', { ascending: true });

      if (error) throw error;
      setItems((data as Item[]) || []);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los items', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.item.id === item.id);
      if (existing) {
        return prev.map(ci => (ci.item.id === item.id ? { ...ci, cantidad: ci.cantidad + 1 } : ci));
      }
      return [...prev, { item, cantidad: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev =>
      prev.reduce((acc, ci) => {
        if (ci.item.id === itemId) {
          if (ci.cantidad > 1) acc.push({ ...ci, cantidad: ci.cantidad - 1 });
        } else acc.push(ci);
        return acc;
      }, [] as CartItem[]),
    );
  };

  const mapTipoPedido = (hasProd: boolean, hasSong: boolean) =>
    (hasProd && hasSong ? 'mixto' : hasProd ? 'productos' : 'canciones') as 'productos' | 'canciones' | 'mixto';

  // === Crear pedido: SIEMPRE pide nombre ===
  const handleClickCreate = () => {
    if (!mesa || cart.length === 0 || isCreating) return;
    setPendingCreate(true);
    setCustomerName('');
    setOrderNotes('');
    setShowNameModal(true);
  };

  const confirmNameAndCreate = async () => {
    if (!mesa) return;

    const name = (customerName || '').trim();
    if (name.length < 2) {
      return toast({ title: 'Nombre requerido', description: 'Ingresa tu nombre (mínimo 2 caracteres).' });
    }

    setShowNameModal(false);
    setPendingCreate(false);
    await createOrder(name, orderNotes);
  };

  const createOrder = async (name_user: string, notas: string) => {
    if (!mesa || cart.length === 0 || isCreating) return;

    setIsCreating(true);
    try {
      const productItems = cart.filter(ci => ci.item.tipo === 'producto');
      const songItems = cart.filter(ci => ci.item.tipo === 'cancion');
      const tipo = mapTipoPedido(productItems.length > 0, songItems.length > 0);

      // INSERT en pedidos con notas generales
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          mesa_id: mesa.id,
          cafeteria_id: mesa.cafeteria_id,
          tipo,
          name_user,
          notas: notas?.trim() ? notas.trim() : null,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      const allItems = [...productItems, ...songItems];
      const pedidoItems = allItems.map(ci => ({
        pedido_id: (pedido as any).id,
        item_id: ci.item.id,
        cantidad: ci.cantidad,
        ...(ci.nota?.trim() ? { nota: ci.nota } : {}),
      }));

      if (pedidoItems.length > 0) {
        const { error: itemsError } = await supabase.from('pedido_items').insert(pedidoItems);
        if (itemsError) throw itemsError;
      }

      // Navegación al estado del pedido:
      // - mantenemos el token
      // - pasamos returnTo para "volver a la carta"
      navigate(`/pedido/${(pedido as any).id}?t=${token}`, {
        replace: true,
        state: { returnTo: location.pathname + location.search },
      });

      setCart([]);
      setOrderNotes('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `No se pudo crear el pedido: ${error?.message || 'Error desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getCartItemQuantity = (itemId: string): number => {
    const ci = cart.find(c => c.item.id === itemId);
    return ci ? ci.cantidad : 0;
  };

  const productos = items
    .filter(i => i.tipo === 'producto')
    .filter(i =>
      (qProductos ? (i.nombre + ' ' + (i.categoria || '')).toLowerCase().includes(qProductos.toLowerCase()) : true)
    );

  function groupByCategoria(arr: Item[]) {
    const map = new Map<string, Item[]>();
    for (const it of arr) {
      const key = (it.categoria || 'Productos').toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }

  const QtyPill = ({
    qty,
    onAdd,
    onRemove,
  }: {
    qty: number;
    onAdd: () => void;
    onRemove: () => void;
  }) => {
    const disabledMinus = qty <= 0;
    return (
      <div className="inline-flex items-center gap-3 rounded-full bg-gray-100 px-4 h-10 shadow-sm select-none">
        <button
          type="button"
          onClick={disabledMinus ? undefined : onRemove}
          className={`text-xl leading-none ${disabledMinus ? 'text-gray-300 cursor-default' : 'cursor-pointer'}`}
          aria-label="Disminuir"
        >
          &minus;
        </button>
        <span className="min-w-[14px] text-base font-medium text-gray-900 text-center">{qty}</span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xl leading-none text-gray-900 cursor-pointer"
          aria-label="Aumentar"
        >
          +
        </button>
      </div>
    );
  };

  const ItemRow = ({
    item,
    qty,
    onAdd,
    onRemove,
  }: {
    item: Item;
    qty: number;
    onAdd: () => void;
    onRemove: () => void;
  }) => {
    return (
      <div className="relative flex items-stretch gap-3 py-3 border-b">
        <div className="flex-1 min-w-0 pr-2">
          <div className="font-semibold text-[15px] leading-snug line-clamp-3">
            {item.nombre}
          </div>
          {(item.description || item.categoria) && (
            <div className="text-[13px] text-muted-foreground line-clamp-6">
              {item.description || item.categoria}
            </div>
          )}
          <div className="mt-2 sm:hidden">
            <QtyPill qty={qty} onAdd={onAdd} onRemove={onRemove} />
          </div>
        </div>

        <div className="relative w-[192px] shrink-0">
          <div className="rounded-xl overflow-hidden bg-black/5 aspect-[16/9]">
            {item.image_url ? (
              <img src={item.image_url} alt={item.nombre} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="h-full w-full grid place-items-center text-muted-foreground">
                <Package className="h-6 w-6 opacity-60" />
              </div>
            )}
          </div>
          <div className="hidden sm:block absolute -bottom-3 right-2">
            <QtyPill qty={qty} onAdd={onAdd} onRemove={onRemove} />
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!mesa) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sala no disponible</CardTitle>
            <CardDescription>Serás redirigido…</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
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
                <span className="font-bold">{mesa.nombre}</span>
              </h1>
              <p className="text-xs text-muted-foreground -mt-0.5">Realiza tu pedido</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              size="sm"
              onClick={handleClickCreate}
              disabled={cart.length === 0 || isCreating}
              className={cart.length > 0 && !isCreating ? 'bg-primary text-primary-foreground animate-pulse' : ''}
            >
              {isCreating ? 'Enviando...' : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Realizar Pedido ({cart.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-8">
          {/* Productos LISTA AGRUPADA */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
              <div className="w-full sm:w-64">
                <Input
                  value={qProductos}
                  onChange={(e) => setQProductos(e.target.value)}
                  placeholder="Buscar productos..."
                />
              </div>
            </div>

            {groupByCategoria(productos).map(([categoria, lista]) => (
              <div key={categoria} className="mb-6 bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    {categoria}
                  </div>
                </div>
                <div className="px-4">
                  {lista.map((p) => (
                    <ItemRow
                      key={p.id}
                      item={p}
                      qty={getCartItemQuantity(p.id)}
                      onAdd={() => addToCart(p)}
                      onRemove={() => removeFromCart(p.id)}
                    />
                  ))}
                  {lista.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">No hay productos que coincidan con tu búsqueda.</p>
                  )}
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>

      {/* Modal: nombre + notas */}
      <Dialog open={showNameModal} onOpenChange={(o) => setShowNameModal(o)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Tu nombre y notas del pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Nombre</Label>
              <Input
                id="customer_name"
                autoFocus
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Valeria"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_notes">Notas (opcional)</Label>
              <Textarea
                id="order_notes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Ej.: sin azúcar, con hielo, poco picante…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNameModal(false);
                setPendingCreate(false);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={confirmNameAndCreate} disabled={!pendingCreate || isCreating || customerName.trim().length < 2}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientMesa;
