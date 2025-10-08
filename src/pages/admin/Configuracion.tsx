// src/pages/admin/Configuracion.tsx
import { useEffect, useRef, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import { Link } from 'react-router-dom';

type Config = {
  id: string;
  abierto: boolean;
  nombre_local?: string | null;
  direccion?: string | null;
  horario?: string | null;          // texto con saltos de línea
  horario_arr?: string[] | null;    // NUEVO: text[]
  logo_url?: string | null;
  hero_bg_url?: string | null;
};

const EMPTY_CONF: Config = {
  id: '',
  abierto: true,
  nombre_local: '',
  direccion: '',
  horario: '',
  horario_arr: [],
  logo_url: null,
  hero_bg_url: null,
};

export default function AdminConfiguracion() {
  const [conf, setConf] = useState<Config>(EMPTY_CONF);
  const [horarioText, setHorarioText] = useState<string>(''); // textarea controlado
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fileLogo = useRef<HTMLInputElement | null>(null);
  const fileHero = useRef<HTMLInputElement | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracion')
        .select('id,abierto,nombre_local,direccion,horario,horario_arr,logo_url,hero_bg_url')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const horarioArr: string[] =
          (data.horario_arr as string[] | null) ??
          (typeof data.horario === 'string'
            ? data.horario.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
            : []);

        setConf({
          id: data.id,
          abierto: !!data.abierto,
          nombre_local: data.nombre_local ?? '',
          direccion: data.direccion ?? '',
          horario: data.horario ?? horarioArr.join('\n'),
          horario_arr: horarioArr,
          logo_url: data.logo_url ?? null,
          hero_bg_url: data.hero_bg_url ?? null,
        });
        setHorarioText(horarioArr.join('\n'));
      } else {
        setConf(EMPTY_CONF);
        setHorarioText('');
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo cargar la configuración', variant: 'destructive' });
      setConf(EMPTY_CONF);
      setHorarioText('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Crea la fila si no existe y devuelve el id
  const ensureRow = async () => {
    // construye horario_arr a partir del textarea actual
    const arr = horarioText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (conf.id) return conf.id;

    const insertPayload = {
      abierto: conf.abierto,
      nombre_local: conf.nombre_local || null,
      direccion: conf.direccion || null,
      horario: arr.join('\n') || null, // espejo en texto
      horario_arr: arr.length ? arr : null,
      logo_url: conf.logo_url || null,
      hero_bg_url: conf.hero_bg_url || null,
    };
    const { data, error } = await supabase
      .from('configuracion')
      .insert([insertPayload])
      .select()
      .single();
    if (error) throw error;
    setConf((c) => ({ ...c, id: data.id }));
    return data.id as string;
  };

  const save = async () => {
    const arr = horarioText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

    setSaving(true);
    try {
      if (!conf.id) {
        await ensureRow();
        toast({ title: 'Guardado', description: 'Configuración creada' });
      } else {
        const { error } = await supabase
          .from('configuracion')
          .update({
            abierto: conf.abierto,
            nombre_local: conf.nombre_local || null,
            direccion: conf.direccion || null,
            // guarda ambos: texto y array
            horario: arr.join('\n') || null,
            horario_arr: arr.length ? arr : null,
            logo_url: conf.logo_url || null,
            hero_bg_url: conf.hero_bg_url || null,
          })
          .eq('id', conf.id);
        if (error) throw error;

        setConf(c => ({ ...c, horario: arr.join('\n'), horario_arr: arr }));
        toast({ title: 'Guardado', description: 'Configuración actualizada' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const upFile = async (file: File, kind: 'logo' | 'hero') => {
    try {
      const id = await ensureRow();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${id}/${kind}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('branding').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('branding').getPublicUrl(path);
      const publicUrl = pub?.publicUrl;

      const patch = kind === 'logo' ? { logo_url: publicUrl } : { hero_bg_url: publicUrl };
      const { error: updErr } = await supabase.from('configuracion').update(patch).eq('id', id);
      if (updErr) throw updErr;

      setConf((c) => ({ ...c, ...(patch as any) }));
      toast({ title: 'Imagen actualizada' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Subida fallida', variant: 'destructive' });
    } finally {
      if (fileLogo.current) fileLogo.current.value = '';
      if (fileHero.current) fileHero.current.value = '';
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        {/* Header translúcido + tipografía Aventura */}
        <header className="admin-header border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Link to="/admin">
              <Button
                variant="outline"
                size="sm"
                className="btn-white-hover"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl font-aventura tracking-wide text-white">
              Configuración del Local
            </h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* Card translúcido (glass) */}
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="card-title">Datos del local</CardTitle>
              <CardDescription className="card-subtitle">
                Control de apertura y datos de contacto
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 card-inner">
              {loading ? (
                <p className="text-white/80">Cargando…</p>
              ) : (
                <>
                  {/* Estado */}
                  <div className="flex items-center gap-3">
                    <Label className="text-white/90">Estado</Label>
                    <Switch
                      className="switch-white"
                      checked={!!conf.abierto}
                      onCheckedChange={(v) => setConf((c) => ({ ...c, abierto: v }))}
                    />
                    <span className="text-sm">{conf.abierto ? 'Abierto' : 'Cerrado'}</span>
                  </div>

                  {/* Campos */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-white/90">Nombre del local</Label>
                      <Input
                        className="bg-white/90 text-[hsl(240_1.4%_13.5%)]"
                        value={conf.nombre_local || ''}
                        onChange={(e) => setConf((c) => ({ ...c, nombre_local: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label className="text-white/90">Dirección</Label>
                      <Input
                        className="bg-white/90 text-[hsl(240_1.4%_13.5%)]"
                        value={conf.direccion || ''}
                        onChange={(e) => setConf((c) => ({ ...c, direccion: e.target.value }))}
                      />
                    </div>

                    {/* Horario (textarea para líneas -> horario_arr) */}
                    <div className="md:col-span-2">
                      <Label className="text-white/90">Horario de atención (una línea por día)</Label>
                      <textarea
                        className="mt-1 w-full rounded-md border border-white/20 bg-white/90 p-2 text-sm text-[hsl(240_1.4%_13.5%)] placeholder:text-[hsl(240_1.4%_13.5%_/_.65)]"
                        rows={5}
                        placeholder={`Ej:\nMartes - Jueves 18:00 - 01:00\nViernes - Sábado 18:00 - 02:00\nDomingo 18:00 - 00:00`}
                        value={horarioText}
                        onChange={(e) => setHorarioText(e.target.value)}
                      />
                      <p className="text-xs text-white/80 mt-1">
                        Cada línea se guardará en <code>horario_arr</code> y todo el bloque en <code>horario</code>.
                      </p>
                    </div>
                  </div>

                  {/* Branding */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Logo */}
                    <div className="space-y-2">
                      <Label className="text-white/90">Logo</Label>
                      <div className="flex items-center gap-3">
                        {conf.logo_url && (
                          <div className="bg-white rounded-full p-1 shadow-md ring-2 ring-[hsl(24_100%_50%/_0.6)]">
                            <img
                              src={conf.logo_url}
                              className="h-14 w-14 rounded-full object-contain bg-white"
                            />
                          </div>
                        )}
                        <input
                          ref={fileLogo}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) upFile(f, 'logo');
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={() => fileLogo.current?.click()}
                          className="btn-white-hover"
                        >
                          <ImagePlus className="h-4 w-4 mr-2" /> Subir logo
                        </Button>
                      </div>
                    </div>

                    {/* Fondo */}
                    <div className="space-y-2">
                      <Label className="text-white/90">Fondo</Label>
                      <div className="flex items-center gap-3">
                        {conf.hero_bg_url && (
                          <img src={conf.hero_bg_url} className="h-14 w-24 rounded object-cover ring-1 ring-white/30" />
                        )}
                        <input
                          ref={fileHero}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) upFile(f, 'hero');
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={() => fileHero.current?.click()}
                          className="btn-white-hover"
                        >
                          <ImagePlus className="h-4 w-4 mr-2" /> Subir fondo
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Guardar */}
                  <div className="pt-4">
                    <Button onClick={save} disabled={saving}>
                      {saving ? 'Guardando…' : (conf.id ? 'Guardar cambios' : 'Crear configuración')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
