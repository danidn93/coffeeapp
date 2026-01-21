import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// UI (paleta clara como “Productos”)
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ExternalLink, QrCode, Copy, RefreshCw, Download } from 'lucide-react';

type Categoria =
  | 'desayuno' | 'almuerzo' | 'merienda'
  | 'bebida_desayuno' | 'bebida_almuerzo' | 'bebida_merienda';

const CATS: Categoria[] = [
  'desayuno', 'almuerzo', 'merienda',
  'bebida_desayuno', 'bebida_almuerzo', 'bebida_merienda',
];

const CAFETERIA_ID = 'ffdcee7f-dd24-4209-b7d8-e1557bbb1346';

const TITLE_MAP: Record<Categoria, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  bebida_desayuno: 'Bebida — Desayuno',
  bebida_almuerzo: 'Bebida — Almuerzo',
  bebida_merienda: 'Bebida — Merienda',
};

interface CatalogItem {
  id: string;
  nombre: string;
  description?: string | null;
  image_url?: string | null;
  disponible: boolean;
  created_at: string;
}

interface Dia {
  id: string;
  fecha: string;          // YYYY-MM-DD
  publicado: boolean;     // “activo”
  notas?: string | null;
}

interface DiaItemRow {
  id: string;
  dia_id: string;
  item_id: string;
  categoria: Categoria;
  disponible: boolean;
}

type SelEntry = { checked: boolean; cats: Categoria[] };

function toLocalISO(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function plusDaysLocalISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

export default function MenuDiaSimple() {
  // Por defecto: “mañana”
  const [fecha, setFecha] = useState<string>(() => plusDaysLocalISO(1));
  const [activo, setActivo] = useState<boolean>(false);
  const [notas, setNotas] = useState('');

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selected, setSelected] = useState<Record<string, SelEntry>>({});
  const [dia, setDia] = useState<Dia | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Migración
  const [migrarOpen, setMigrarOpen] = useState(false);
  const [fechaOrigen, setFechaOrigen] = useState<string>(() => toLocalISO(new Date()));
  const [origenCargando, setOrigenCargando] = useState(false);
  const [origenItems, setOrigenItems] = useState<Array<{
    item_id: string;
    nombre: string;
    categoria: Categoria;
    image_url?: string | null;
    checked: boolean;
  }>>([]);

  // Enlace / QR fijo
  const enlaceFijo = useMemo(() => `${window.location.origin}/visitas`, []);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!qrRef.current) return;
    QRCode.toCanvas(qrRef.current, enlaceFijo, { width: 220 }).catch(() => {});
  }, [enlaceFijo]);

  /** Cargar catálogo */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('menu_visitas_catalog')
        .select('*')
        .eq('disponible', true)
        .order('created_at', { ascending: false })
        .eq('cafeteria_id', CAFETERIA_ID);

      if (error) {
        console.error('[catalog]', error);
        toast({ title: 'Error', description: 'No se pudo cargar el catálogo', variant: 'destructive' });
      } else {
        setCatalog((data || []) as any);
      }
      setLoading(false);
    })();
  }, []);

  /** Cargar menú del día y su selección (multi-categoría por item) */
  useEffect(() => {
    (async () => {
      const { data: d, error } = await supabase
        .from('menu_visitas_dias')
        .select('*')
        .eq('fecha', fecha)
        .eq('cafeteria_id', CAFETERIA_ID)
        .maybeSingle();

      if (error) {
        console.error('[dia]', error);
        toast({ title: 'Error', description: 'No se pudo cargar el día', variant: 'destructive' });
        return;
      }

      if (!d) {
        setDia(null);
        setActivo(false);
        setNotas('');
        setSelected({});
        return;
      }

      setDia(d as any);
      setActivo((d as any).publicado);
      setNotas((d as any).notas || '');

      const { data: di, error: e2 } = await supabase
        .from('menu_visitas_dia_items')
        .select('id,item_id,categoria,disponible')
        .eq('dia_id', (d as any).id)
        .eq('cafeteria_id', CAFETERIA_ID);

      if (e2) {
        console.error('[dia_items]', e2);
        toast({ title: 'Error', description: 'No se pudieron cargar los productos del día', variant: 'destructive' });
        return;
      }

      // Construir map item_id -> { checked, cats[] } (agrupar múltiples filas por item)
      const map: Record<string, SelEntry> = {};
      (di || []).forEach((x: any) => {
        const cat = (CATS.includes(x.categoria as Categoria) ? x.categoria : 'desayuno') as Categoria;
        const entry = map[x.item_id] ?? { checked: false, cats: [] };
        if (x.disponible) entry.checked = true;
        if (!entry.cats.includes(cat)) entry.cats.push(cat);
        map[x.item_id] = entry;
      });
      setSelected(map);
    })();
  }, [fecha]);

  /** Helpers selección */
  const toggleItem = (id: string, checked: boolean) =>
    setSelected(prev => {
      const curr = prev[id] ?? { checked: false, cats: [] };
      return { ...prev, [id]: { ...curr, checked } };
    });

  const toggleCat = (id: string, cat: Categoria, checked: boolean) =>
    setSelected(prev => {
      const curr = prev[id] ?? { checked: false, cats: [] };
      const has = curr.cats.includes(cat);
      const nextCats = checked ? (has ? curr.cats : [...curr.cats, cat]) : curr.cats.filter(c => c !== cat);
      return { ...prev, [id]: { ...curr, cats: nextCats } };
    });

  /** Guardar: múltiples filas por (item, categoría) */
  const save = async () => {
    setSaving(true);
    try {
      // Día (upsert por fecha)
      const { data: up, error: e } = await supabase
        .from('menu_visitas_dias')
        .upsert(
          {
            fecha,
            publicado: activo,
            notas: notas?.trim() || null,
            cafeteria_id: CAFETERIA_ID,
          },
          { onConflict: 'fecha,cafeteria_id' }
        )
        .select()
        .single();
      if (e) throw e;

      const diaId = (up as any).id as string;
      setDia(up as any);

      // Traer existentes del día
      const { data: actuales, error: eAct } = await supabase
        .from('menu_visitas_dia_items')
        .select('id,item_id,categoria,disponible')
        .eq('dia_id', diaId);
      if (eAct) throw eAct;

      // Map de existentes por clave item|cat
      const existMap = new Map<string, { id: string; disponible: boolean }>();
      (actuales || []).forEach((r: any) => {
        existMap.set(`${r.item_id}|${r.categoria}`, { id: r.id, disponible: r.disponible });
      });

      // Deseado: todos los pares (item, cat) de items chequeados
      const desiredKeys: string[] = [];
      Object.entries(selected).forEach(([item_id, val]) => {
        if (!val.checked) return;
        (val.cats || []).forEach(cat => desiredKeys.push(`${item_id}|${cat}`));
      });

      // INSERT nuevos
      const toInsert = desiredKeys.filter(k => !existMap.has(k));
      const insertPayload = toInsert.map(k => {
        const [item_id, categoria] = k.split('|') as [string, Categoria];
        return { dia_id: diaId, item_id, categoria, disponible: true };
      });

      // UPDATE → poner disponible=true a los que existen y están deseados pero tal vez quedaron en false
      const toUpdateIds: string[] = [];
      desiredKeys.forEach(k => {
        const ex = existMap.get(k);
        if (ex && ex.disponible !== true) toUpdateIds.push(ex.id);
      });

      // DELETE los que existen pero ya no están deseados
      const desiredSet = new Set(desiredKeys);
      const toDeleteIds: string[] = [];
      existMap.forEach((v, k) => { if (!desiredSet.has(k)) toDeleteIds.push(v.id); });

      // Ejecutar en paralelo
      const ops: Array<Promise<any>> = [];
      if (insertPayload.length) ops.push(supabase.from('menu_visitas_dia_items').insert(insertPayload));
      if (toUpdateIds.length) ops.push(supabase.from('menu_visitas_dia_items').update({ disponible: true }).in('id', toUpdateIds));
      if (toDeleteIds.length) ops.push(supabase.from('menu_visitas_dia_items').delete().in('id', toDeleteIds));

      if (ops.length) {
        const res = await Promise.all(ops);
        const err = res.find(r => r?.error);
        if (err?.error) throw err.error;
      }

      toast({ title: 'Guardado', description: 'Menú del día actualizado.' });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: err?.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /** Migración */
  const abrirMigrar = async () => {
    setMigrarOpen(true);
    await cargarOrigen(fechaOrigen);
  };

  const cargarOrigen = async (f: string) => {
    setOrigenCargando(true);
    try {
      setFechaOrigen(f);
      const { data: d, error } = await supabase
        .from('menu_visitas_dias')
        .select('id,fecha')
        .eq('fecha', f)
        .maybeSingle();
      if (error) throw error;
      if (!d) {
        setOrigenItems([]);
        return;
      }

      const { data: di, error: e2 } = await supabase
        .from('menu_visitas_dia_items')
        .select('item_id,categoria,disponible,menu_visitas_catalog(id,nombre,image_url)')
        .eq('dia_id', (d as any).id)
        .eq('disponible', true);
      if (e2) throw e2;

      const arr =
        (di || []).map((r: any) => ({
          item_id: r.item_id,
          nombre: r.menu_visitas_catalog?.nombre ?? '—',
          image_url: r.menu_visitas_catalog?.image_url ?? null,
          categoria: (CATS.includes(r.categoria) ? r.categoria : 'desayuno') as Categoria,
          checked: true,
        })) || [];

      setOrigenItems(arr);
    } catch (e: any) {
      console.error('[migrar]', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo cargar el menú origen', variant: 'destructive' });
    } finally {
      setOrigenCargando(false);
    }
  };

  const aplicarMigracion = async () => {
    if (!origenItems.length) {
      toast({ title: 'Sin elementos', description: 'El menú origen no tiene productos activos.' });
      return;
    }
    setSaving(true);
    try {
      const { data: up, error: e } = await supabase
        .from('menu_visitas_dias')
        .upsert({ fecha, publicado: activo, notas: notas?.trim() || null }, { onConflict: 'fecha' })
        .select()
        .single();
      if (e) throw e;
      const diaId = (up as any).id as string;
      setDia(up as any);

      // existentes destino
      const { data: actuales, error: eAct } = await supabase
        .from('menu_visitas_dia_items')
        .select('id,item_id,categoria,disponible')
        .eq('dia_id', diaId);
      if (eAct) throw eAct;

      const exist = new Set<string>((actuales || []).map((r: any) => `${r.item_id}|${r.categoria}`));
      const aCopiar = origenItems.filter(x => x.checked);
      const nuevos = aCopiar.filter(x => !exist.has(`${x.item_id}|${x.categoria}`));

      if (nuevos.length) {
        const { error: insErr } = await supabase.from('menu_visitas_dia_items').insert(
          nuevos.map(x => ({ dia_id: diaId, item_id: x.item_id, categoria: x.categoria, disponible: true }))
        );
        if (insErr) throw insErr;
      }

      // refrescar selección en pantalla (merge)
      setSelected(prev => {
        const next = { ...prev };
        aCopiar.forEach(x => {
          const curr = next[x.item_id] ?? { checked: true, cats: [] };
          if (!curr.cats.includes(x.categoria)) curr.cats.push(x.categoria);
          curr.checked = true;
          next[x.item_id] = curr;
        });
        return next;
      });

      setMigrarOpen(false);
      toast({ title: 'Menú migrado', description: `Se copió el menú de ${fechaOrigen} a ${fecha}.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e?.message || 'No se pudo migrar el menú', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /** Contadores por categoría (mismos colores/orden) */
  const counters = useMemo(() => {
    const c = Object.fromEntries(CATS.map(k => [k, 0])) as Record<Categoria, number>;
    Object.values(selected).forEach(v => {
      if (!v?.checked) return;
      (v.cats || []).forEach(cat => { c[cat] += 1; });
    });
    return c;
  }, [selected]);

  /** ======== UI ======== */
  return (
    <div className="min-h-[60vh]">
      {/* Header claro, como “Productos” */}
      <header className="admin-header border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/admin">
            <Button variant="outline" size="sm" className="btn-white-hover">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-aventura tracking-wide text-white">Menú por día (Visitas)</h1>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-600 text-white">Desayuno: {counters.desayuno}</Badge>
            <Badge className="bg-sky-600 text-white">Almuerzo: {counters.almuerzo}</Badge>
            <Badge className="bg-fuchsia-600 text-white">Merienda: {counters.merienda}</Badge>
            <Badge className="bg-emerald-700 text-white">Beb D: {counters.bebida_desayuno}</Badge>
            <Badge className="bg-sky-700 text-white">Beb A: {counters.bebida_almuerzo}</Badge>
            <Badge className="bg-fuchsia-700 text-white">Beb M: {counters.bebida_merienda}</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Configuración (paleta clara) */}
        <Card className="mb-6 bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">Configuración del día</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3 items-end">
              <div>
                <Label htmlFor="fecha" className="text-slate-900 font-semibold">Fecha</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="bg-white text-slate-900"
                />
                <div className="text-xs text-slate-600 mt-1">
                  Hoy: {toLocalISO(new Date())} • Sugerido: {plusDaysLocalISO(1)}
                </div>
              </div>

              <div className="pt-6 flex items-center gap-2">
                <Checkbox id="activo" checked={activo} onCheckedChange={v => setActivo(Boolean(v))} />
                <Label htmlFor="activo" className="text-slate-900 font-semibold">Menú activo</Label>
              </div>

              <div>
                <Label htmlFor="notas" className="text-slate-900 font-semibold">Notas</Label>
                <Textarea
                  id="notas"
                  rows={2}
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Ej.: Menú sujeto a disponibilidad"
                  className="bg-white text-slate-900 placeholder:text-slate-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enlace fijo + QR final */}
        <Card className="mb-6 bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">Enlace público (fijo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <Input readOnly value={enlaceFijo} className="w-full md:w-[360px] bg-white text-slate-900" />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => navigator.clipboard.writeText(enlaceFijo)}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar
                </Button>
                <a href={enlaceFijo} target="_blank" rel="noreferrer">
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                  </Button>
                </a>
                <Button variant="outline" onClick={() => qrRef.current && QRCode.toCanvas(qrRef.current, enlaceFijo, { width: 220 })}>
                  <QrCode className="h-4 w-4 mr-1" /> Generar QR
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <canvas ref={qrRef} className="border rounded" width={220} height={220} />
              <Button
                variant="outline"
                onClick={() => {
                  const c = qrRef.current; if (!c) return;
                  const a = document.createElement('a');
                  a.href = c.toDataURL('image/png');
                  a.download = 'QR_visitas.png';
                  a.click();
                }}
              >
                <Download className="h-4 w-4 mr-1" /> Descargar PNG
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Selector de productos (multi-categoría por item) */}
        <Card className="mb-6 bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">Selecciona productos del catálogo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-slate-700">Cargando catálogo…</p>
            ) : catalog.length === 0 ? (
              <div className="text-sm text-slate-600">
                No hay productos. <Link to="/admin/visitas/productos" className="underline">Crear productos</Link>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y">
                {catalog.map(it => {
                  const entry = selected[it.id] ?? { checked: false, cats: [] };
                  const isIn = (cat: Categoria) => entry.cats.includes(cat);
                  return (
                    <div key={it.id} className="p-3 grid sm:grid-cols-12 gap-3 items-center">
                      {/* Col 1: activar producto */}
                      <div className="sm:col-span-5 flex items-start gap-3">
                        <Checkbox
                          checked={entry.checked}
                          onCheckedChange={v => toggleItem(it.id, Boolean(v))}
                        />
                        <div>
                          <div className="font-medium text-slate-900">{it.nombre}</div>
                          {it.description && (
                            <div className="text-xs text-slate-600">{it.description}</div>
                          )}
                          <div className="text-[11px] text-slate-500 mt-1">
                            Marca una o varias categorías para este producto.
                          </div>
                        </div>
                      </div>

                      {/* Col 2: categorías (checkboxes) */}
                      <div className="sm:col-span-4">
                        <div className="grid grid-cols-2 gap-2">
                          {CATS.map(cat => (
                            <label key={cat} className="flex items-center gap-2 rounded border px-2 py-1">
                              <Checkbox
                                checked={isIn(cat)}
                                onCheckedChange={v => toggleCat(it.id, cat, Boolean(v))}
                                disabled={!entry.checked}
                              />
                              <span className="text-sm text-black">{TITLE_MAP[cat]}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Col 3: imagen */}
                      <div className="sm:col-span-3">
                        {it.image_url ? (
                          <img
                            src={it.image_url}
                            alt={it.nombre}
                            className="h-16 w-28 object-cover rounded ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="h-16 w-28 grid place-items-center bg-slate-100 rounded text-xs text-slate-500">
                            Sin foto
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3 pt-3">
              <Button onClick={save} disabled={saving} className="btn-accent">
                {saving ? 'Guardando…' : 'Guardar menú del día'}
              </Button>

              <Button variant="secondary" onClick={abrirMigrar}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Migrar menú
              </Button>
            </div>
          </CardContent>
        </Card>

        
      </main>

      {/* Modal Migrar */}
      <Dialog open={migrarOpen} onOpenChange={setMigrarOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Migrar menú desde otro día</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <Label htmlFor="fecha_origen" className="text-slate-900 font-semibold">Fecha origen</Label>
                <Input
                  id="fecha_origen"
                  type="date"
                  value={fechaOrigen}
                  onChange={e => {
                    setFechaOrigen(e.target.value);
                    cargarOrigen(e.target.value);
                  }}
                  className="bg-white text-slate-900"
                />
              </div>
              <div>
                <Label className="text-slate-900 font-semibold">Destino</Label>
                <Input readOnly value={fecha} className="bg-white text-slate-900" />
              </div>
            </div>

            {origenCargando ? (
              <p className="text-slate-700">Cargando origen…</p>
            ) : origenItems.length === 0 ? (
              <div className="text-sm text-slate-600">No hay productos activos en el día origen.</div>
            ) : (
              <div className="border border-slate-200 rounded-lg max-h-[360px] overflow-auto divide-y">
                {origenItems.map((x, idx) => (
                  <div key={`${x.item_id}-${idx}`} className="p-3 grid sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-7 flex items-center gap-3">
                      <Checkbox
                        checked={x.checked}
                        onCheckedChange={v =>
                          setOrigenItems(prev => prev.map((y, i) => (i === idx ? { ...y, checked: Boolean(v) } : y)))
                        }
                      />
                      <div>
                        <div className="font-medium text-slate-900">{x.nombre}</div>
                        <div className="text-xs text-slate-600">Categoría: {TITLE_MAP[x.categoria]}</div>
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs text-slate-700">Categoría</Label>
                      <select
                        className="border border-slate-300 rounded px-2 py-2 w-full bg-white text-slate-900"
                        value={x.categoria}
                        onChange={e =>
                          setOrigenItems(prev => prev.map((y, i) => (i === idx ? { ...y, categoria: e.target.value as Categoria } : y)))
                        }
                      >
                        {CATS.map(c => (
                          <option key={c} value={c}>{TITLE_MAP[c]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      {x.image_url ? (
                        <img src={x.image_url} className="h-12 w-20 object-cover rounded ring-1 ring-slate-200" />
                      ) : (
                        <div className="h-12 w-20 grid place-items-center bg-slate-100 rounded text-[10px] text-slate-500">Sin foto</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMigrarOpen(false)}>Cancelar</Button>
            <Button onClick={aplicarMigracion} disabled={saving || origenItems.length === 0}>
              {saving ? 'Aplicando…' : 'Copiar al día destino'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
