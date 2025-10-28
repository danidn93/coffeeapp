import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// ✅ Logo desde /public
import visitasLogo from '/assets/visitas-logo.png';

type Categoria =
  | 'desayuno' | 'almuerzo' | 'merienda'
  | 'bebida_desayuno' | 'bebida_almuerzo' | 'bebida_merienda';

const TITLE_MAP: Record<Categoria, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  bebida_desayuno: 'Bebida — Desayuno',
  bebida_almuerzo: 'Bebida — Almuerzo',
  bebida_merienda: 'Bebida — Merienda',
};

// 🔧 Normalizador robusto: mapea lo que venga de DB a nuestro enum
const NORMALIZE: Record<string, Categoria> = {
  // directos
  desayuno: 'desayuno',
  almuerzo: 'almuerzo',
  merienda: 'merienda',
  bebida_desayuno: 'bebida_desayuno',
  bebida_almuerzo: 'bebida_almuerzo',
  bebida_merienda: 'bebida_merienda',
  // variantes frecuentes desde versiones anteriores
  'bebidas desayuno': 'bebida_desayuno',
  'bebidas almuerzo': 'bebida_almuerzo',
  'bebidas merienda': 'bebida_merienda',
  'bebida desayuno': 'bebida_desayuno',
  'bebida almuerzo': 'bebida_almuerzo',
  'bebida merienda': 'bebida_merienda',
};

function normalizeCategoria(raw: unknown): Categoria | null {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (NORMALIZE[s]) return NORMALIZE[s];
  // intentos adicionales: reemplazar espacios por guion bajo
  const sUnderscore = s.replace(/\s+/g, '_');
  if (NORMALIZE[sUnderscore]) return NORMALIZE[sUnderscore];
  return null; // desconocida → se ignora sin romper
}

interface DiaMenu { id:string; fecha:string; publicado:boolean }
interface CatalogItem { id:string; nombre:string; image_url?:string|null; description?:string|null }
interface DiaItem {
  id:string;
  item_id:string;
  categoria:Categoria;
  disponible:boolean;
  orden:number|null;
  item?:CatalogItem;
}

function useQuery(){ return new URLSearchParams(useLocation().search); }
function resolveDate(q: URLSearchParams){
  const date = q.get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const t = new Date(); const n = new Date(t.getFullYear(), t.getMonth(), t.getDate() ); //+ 1 agregar luego
  return n.toISOString().slice(0,10); // “mañana” por defecto
}

export default function ClientVisitas(){
  const q = useQuery();
  const targetDate = useMemo(()=>resolveDate(q), [q]);

  const [dia, setDia] = useState<DiaMenu|null>(null);
  const [items, setItems] = useState<DiaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedByCat, setSelectedByCat] = useState<Partial<Record<Categoria, DiaItem>>>({});

  const [openModal, setOpenModal] = useState(false);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(()=>{ let cancel=false;(async()=>{
    try{
      const { data: d, error: e } = await supabase
        .from('menu_visitas_dias').select('*')
        .eq('fecha', targetDate).eq('publicado', true).maybeSingle();
      if (e) throw e;
      if (!d){ if (!cancel){ setDia(null); setItems([]); } return; }
      if (cancel) return;
      setDia(d as any);

      const { data: di, error: e2 } = await supabase
        .from('menu_visitas_dia_items')
        .select('*')
        .eq('dia_id', (d as any).id)
        .eq('disponible', true)
        .order('categoria', { ascending: true })
        .order('orden', { ascending: true });
      if (e2) throw e2;

      const ids = (di||[]).map((x:any)=>x.item_id);
      let map: Record<string, CatalogItem> = {};
      if (ids.length){
        const { data: cats, error: e3 } = await supabase
          .from('menu_visitas_catalog').select('id,nombre,image_url,description').in('id', ids);
        if (e3) throw e3;
        (cats||[]).forEach((c:any)=>{ map[c.id] = c; });
      }

      // Enriquecemos y normalizamos categorías; ignoramos las desconocidas
      const enriched: DiaItem[] = (di||[])
        .map((x:any)=> {
          const cat = normalizeCategoria(x.categoria);
          if (!cat) return null;
          return {
            ...x,
            categoria: cat,
            item: map[x.item_id]
          } as DiaItem;
        })
        .filter(Boolean) as DiaItem[];

      if (cancel) return;
      setItems(enriched);
    }catch(err:any){
      console.error(err);
      toast({ title:'Sin menú', description:'Aún no hay menú publicado para esa fecha.' });
      if (!cancel){ setDia(null); setItems([]); }
    }finally{ if (!cancel) setLoading(false); }
  })(); return ()=>{cancel=true}; },[targetDate]);

  const byCat = useMemo(()=>{
    const groups: Record<Categoria, DiaItem[]> = {
      desayuno:[], almuerzo:[], merienda:[],
      bebida_desayuno:[], bebida_almuerzo:[], bebida_merienda:[]
    };
    for (const it of items){
      groups[it.categoria]?.push(it);
    }
    return groups;
  },[items]);

  const choose = (cat: Categoria, it: DiaItem) => setSelectedByCat(prev => ({ ...prev, [cat]: it }));

  const openOrder = ()=>{
    if (!dia) return;
    // Al menos 1 selección entre todas las categorías
    const any = Object.values(selectedByCat).filter(Boolean).length > 0;
    if (!any) {
      toast({ title:'Selecciona al menos una opción', description:'Elige 1 en cualquiera de las categorías.' });
      return;
    }
    setCustomerName(''); setOrderNotes(''); setOpenModal(true);
  };

  const confirm = async ()=>{
    if (!dia) return;
    const name = customerName.trim();
    if (name.length < 2) return toast({ title:'Nombre requerido', description:'Mínimo 2 caracteres.' });

    const picks = (Object.keys(TITLE_MAP) as Categoria[])
      .map(c => selectedByCat[c] ? ({ cat:c, it: selectedByCat[c]! }) : null)
      .filter(Boolean) as {cat:Categoria; it:DiaItem}[];
    if (picks.length === 0) return;

    setCreating(true);
    try{
      const { data: ped, error: perr } = await supabase
        .from('pedidos_visitas')
        .insert({ dia_id: dia.id, name_user: name, notas: orderNotes?.trim() || null })
        .select()
        .single();
      if (perr) throw perr;

      const payload = picks.map(p => ({
        pedido_id: (ped as any).id,
        item_id: p.it.item_id,
        categoria: p.cat, // ya normalizada
        cantidad: 1,
        item_nombre: p.it.item?.nombre ?? null,
      }));
      const { error: ierr } = await supabase.from('pedido_items_visitas').insert(payload);
      if (ierr) throw ierr;

      setOpenModal(false); setThanksOpen(true); setSelectedByCat({});
    }catch(err:any){
      console.error(err);
      toast({ title:'Error', description: err?.message || 'No se pudo crear el pedido', variant:'destructive' });
    }finally{ setCreating(false); }
  };

  /* ====================== UI ====================== */

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[url('/assets/visitas-bg.jpg')] bg-cover bg-center">
        <p className="px-4 py-2 rounded-md bg-white/80 text-slate-900">Cargando menú…</p>
      </div>
    );
  }

  if (!dia) {
    return (
      <div className="min-h-screen grid place-items-center bg-[url('/assets/visitas-bg.jpg')] bg-cover bg-center p-6">
        <Card className="max-w-md w-full p-6 text-center backdrop-blur bg-white/85">
          <img src={visitasLogo} alt="Visitas" className="mx-auto h-12 mb-3" />
          <p className="text-lg font-semibold text-slate-900">Aún no hay menú publicado para {targetDate}.</p>
          <p className="text-sm text-slate-700 mt-2">Vuelve más tarde, por favor.</p>
        </Card>
      </div>
    );
  }

  const CatBlock = ({ cat, title }:{cat:Categoria; title:string})=>{
    const list = byCat[cat];
    if (!list || list.length === 0) return null; // oculta categorías vacías

    return (
      <section className="rounded-2xl overflow-hidden border border-white/40 bg-white/80 backdrop-blur shadow-sm">
        <div className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-wide text-slate-600">{title}</div>
        <ul>
          {list.map(it => {
            const active = selectedByCat[cat]?.id === it.id;
            return (
              <li key={it.id} className={`flex items-stretch gap-3 p-4 border-t first:border-t-0 border-white/50 ${active ? 'bg-white/60' : ''}`}>
                <div className="flex-1 min-w-0 pr-2">
                  <label className="font-semibold leading-snug cursor-pointer text-slate-900">
                    <input
                      type="radio"
                      name={`pick-${cat}`}
                      className="mr-2 align-middle"
                      checked={active}
                      onChange={()=>choose(cat, it)}
                    />
                    {it.item?.nombre}
                  </label>
                  {it.item?.description && <div className="text-sm text-slate-700">{it.item.description}</div>}
                </div>
                <div className="relative w-40 shrink-0">
                  <div className="rounded-xl overflow-hidden bg-slate-100/80 aspect-[16/9] ring-1 ring-white/60">
                    {it.item?.image_url ? (
                      <img src={it.item.image_url} alt={it.item.nombre} className="h-full w-full object-cover" loading="lazy"/>
                    ) : (
                      <div className="h-full w-full grid place-items-center text-slate-500"><Package className="h-6 w-6 opacity-70"/></div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-[url('/assets/visitas-bg.jpg')] bg-cover bg-center">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Cabecera sobre el fondo visible */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Contenedor blanco para el logo */}
            <div className="bg-white/95 rounded-xl p-2 ring-1 ring-white/70 shadow-sm">
              <img src={visitasLogo} alt="Visitas" className="h-10 w-auto" />
            </div>

            <div className="rounded-lg px-3 py-2 bg-white/70 backdrop-blur">
              <h1 className="text-2xl font-semibold text-slate-900">Elige tu menú de mañana</h1>
              <p className="text-sm text-slate-800">Fecha: {targetDate}</p>
            </div>
          </div>
          <div className="hidden sm:block" />
        </div>

        {/* Categorías (solo las que tienen ítems) */}
        <div className="grid gap-6">
          <CatBlock cat="desayuno" title={TITLE_MAP.desayuno} />
          <CatBlock cat="bebida_desayuno" title={TITLE_MAP.bebida_desayuno} />
          <CatBlock cat="almuerzo" title={TITLE_MAP.almuerzo} />
          <CatBlock cat="bebida_almuerzo" title={TITLE_MAP.bebida_almuerzo} />
          <CatBlock cat="merienda" title={TITLE_MAP.merienda} />
          <CatBlock cat="bebida_merienda" title={TITLE_MAP.bebida_merienda} />
        </div>

        {/* CTA */}
        <div className="mt-6 flex justify-end">
          <Button onClick={openOrder} className="btn-accent">
            Confirmar selección
          </Button>
        </div>
      </div>

      {/* Modal: nombre + notas */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Tu nombre y notas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Valeria" />
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea value={orderNotes} onChange={e=>setOrderNotes(e.target.value)} rows={3} placeholder="Indicaciones…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpenModal(false)}>Cancelar</Button>
            <Button onClick={confirm} disabled={creating || customerName.trim().length<2}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gracias */}
      <Dialog open={thanksOpen} onOpenChange={setThanksOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>¡Gracias! 🙌</DialogTitle></DialogHeader>
          <p>Tu pedido fue registrado. ¡Nos vemos pronto!</p>
          <DialogFooter><Button onClick={()=>setThanksOpen(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
