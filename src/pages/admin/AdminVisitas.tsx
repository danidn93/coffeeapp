// src/pages/admin/AdminVisitas.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import QRCode from 'qrcode';

interface CatalogItem { id:string; nombre:string; categoria?:string|null; disponible:boolean }
interface Dia { id:string; fecha:string; publicado:boolean; notas?:string|null }
type SelectedEntry = { checked: boolean; orden: string }; // <-- checked requerido; orden string

export default function AdminVisitas(){
  const [fecha, setFecha] = useState<string>(()=> {
    const dt = new Date();
    const y = dt.getFullYear(), m = String(dt.getMonth()+1).padStart(2,'0'), d = String(dt.getDate()+1).padStart(2,'0');
    return `${y}-${m}-${d}`; // default: mañana
  });
  const [notas, setNotas] = useState('');
  const [publicado, setPublicado] = useState(false);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selected, setSelected] = useState<Record<string, SelectedEntry>>({});
  const [saving, setSaving] = useState(false);
  const [dia, setDia] = useState<Dia|null>(null);

  const qrCanvasRef = useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{ (async()=>{
    const { data, error } = await supabase
      .from('menu_visitas_catalog')
      .select('*')
      .eq('disponible', true)
      .order('categoria', { ascending: true });
    if (error) console.error(error);
    setCatalog((data||[]) as any);
  })(); },[]);

  const createOrUpdateDay = async ()=>{
    setSaving(true);
    try {
      // upsert día
      const { data: up, error: upErr } = await supabase
        .from('menu_visitas_dias')
        .upsert({ fecha, publicado, notas: notas?.trim() || null })
        .select()
        .single();
      if (upErr) throw upErr;
      setDia(up as any);

      // limpiar items del día y reinsertar seleccionados
      const { error: delErr } = await supabase
        .from('menu_visitas_dia_items')
        .delete()
        .eq('dia_id', (up as any).id);
      if (delErr) throw delErr;

      const payload = Object.entries(selected)
        .filter(([, v])=>v.checked)
        .map(([id, v])=>({
          dia_id: (up as any).id,
          item_id: id,
          disponible: true,
          orden: v.orden ? Number(v.orden) : 0,
        }));
      if (payload.length){
        const { error: insErr } = await supabase.from('menu_visitas_dia_items').insert(payload);
        if (insErr) throw insErr;
      }
      toast({ title:'Guardado', description:'Menú del día actualizado' });
    } catch(e:any){
      console.error(e);
      toast({ title:'Error', description: e?.message || 'No se pudo guardar', variant:'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const linkNext = useMemo(() => `${window.location.origin}/visitas?when=next`, []);
  const linkDate = useMemo(() => `${window.location.origin}/visitas?date=${fecha}`, [fecha]);

  const makeQR = async (url:string)=>{
    if (!qrCanvasRef.current) return;
    await QRCode.toCanvas(qrCanvasRef.current, url, { width: 256 });
  };
  const downloadQR = ()=>{
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `QR_visitas_${fecha}.png`;
    a.click();
  };

  const toggleCheck = (id: string, value: boolean) => {
    setSelected(prev => {
      const current = prev[id] ?? { checked: false, orden: '0' };
      return { ...prev, [id]: { ...current, checked: value } };
    });
  };
  const setOrden = (id: string, value: string) => {
    setSelected(prev => {
      const current = prev[id] ?? { checked: false, orden: '0' };
      return { ...prev, [id]: { ...current, orden: value } };
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Menú de Visitas (por día)</h1>

      <Card className="mb-6">
        <CardHeader><CardTitle>Configurar día</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div>
              <Label>Fecha del menú</Label>
              <Input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="pub" checked={publicado} onCheckedChange={(v)=>setPublicado(Boolean(v))} />
              <Label htmlFor="pub">Publicado (visible para visitas)</Label>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={2} />
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Seleccionar ítems del catálogo</h3>
            <div className="border rounded-lg divide-y">
              {catalog.map(ci => (
                <div key={ci.id} className="p-3 grid sm:grid-cols-6 gap-2 items-center">
                  <div className="sm:col-span-3 flex items-center gap-2">
                    <Checkbox
                      checked={selected[ci.id]?.checked ?? false}
                      onCheckedChange={(v)=>toggleCheck(ci.id, Boolean(v))}
                    />
                    <div>
                      <div className="font-medium">{ci.nombre}</div>
                      <div className="text-xs text-muted-foreground">{ci.categoria || 'Sin categoría'}</div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Orden</Label>
                    <Input
                      placeholder="0"
                      value={selected[ci.id]?.orden ?? '0'}
                      onChange={e=>setOrden(ci.id, e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2 text-right">
                    <Button variant="secondary" onClick={()=> {
                      // Seleccionar rápido con orden 0
                      setSelected(prev => ({ ...prev, [ci.id]: { checked: true, orden: prev[ci.id]?.orden ?? '0' } }));
                    }}>Seleccionar</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={createOrUpdateDay} disabled={saving}>{saving? 'Guardando…':'Guardar menú del día'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Enlaces y QR</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Link (día siguiente dinámico)</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={linkNext} />
                <Button onClick={()=>navigator.clipboard.writeText(linkNext)}>Copiar</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Siempre mostrará el menú de mañana.</p>
            </div>
            <div>
              <Label>Link fijo por fecha</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={linkDate} />
                <Button onClick={()=>navigator.clipboard.writeText(linkDate)}>Copiar</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Útil si necesitas un QR específico para {fecha}.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={()=>makeQR(linkDate)}>Generar QR (fecha)</Button>
            <Button variant="secondary" onClick={()=>makeQR(linkNext)}>Generar QR (día siguiente)</Button>
            <Button onClick={downloadQR}>Descargar PNG</Button>
          </div>
          <canvas ref={qrCanvasRef} className="mt-2 border rounded" width={256} height={256} />
        </CardContent>
      </Card>
    </div>
  );
}
