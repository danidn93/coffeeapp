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
import { useAuth } from '@/contexts/AuthContext';

const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

type Config = {
  id: string;
  abierto: boolean;
  nombre_local?: string | null;
  direccion?: string | null;
  horario?: string | null;
  horario_arr?: string[] | null;
  logo_url?: string | null;
  hero_bg_url?: string | null;
  movil_bg?: string | null;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function AdminConfiguracion() {
  const [conf, setConf] = useState<Config | null>(null);
  const [horarioText, setHorarioText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';

  const [cafeteriaId, setCafeteriaId] = useState<string | null>(
    () => localStorage.getItem(CAFETERIA_LS_KEY)
  );

  const fileLogo = useRef<HTMLInputElement | null>(null);
  const fileHero = useRef<HTMLInputElement | null>(null);
  const fileMovil = useRef<HTMLInputElement | null>(null);

  /* ======================================================
   * Escuchar cambio de cafetería (SIN REFRESH)
   * ====================================================== */
  useEffect(() => {
    const handler = () => {
      setCafeteriaId(localStorage.getItem(CAFETERIA_LS_KEY));
    };
    window.addEventListener('cafeteria-change', handler);
    return () => window.removeEventListener('cafeteria-change', handler);
  }, []);

  /* ======================================================
   * Cargar configuración POR ID (cafetería)
   * ====================================================== */
  const fetchConfig = async () => {
    if (!cafeteriaId) {
      setConf(null);
      setHorarioText('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracion')
        .select('*')
        .eq('id', cafeteriaId)
        .single();

      if (error) throw error;

      const horarioArr =
        (data.horario_arr as string[] | null) ??
        (typeof data.horario === 'string'
          ? data.horario.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
          : []);

      setConf({
        ...data,
        horario: horarioArr.join('\n'),
        horario_arr: horarioArr,
      });
      setHorarioText(horarioArr.join('\n'));
    } catch (e: any) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración',
        variant: 'destructive',
      });
      setConf(null);
      setHorarioText('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [cafeteriaId]);

  /* ======================================================
   * Guardar (UPDATE sobre la cafetería activa)
   * ====================================================== */
  const save = async () => {
    if (!cafeteriaId || !conf) return;

    const arr = horarioText
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const { error } = await supabase
        .from('configuracion')
        .update({
          abierto: conf.abierto,
          nombre_local: conf.nombre_local || null,
          direccion: conf.direccion || null,
          horario: arr.join('\n') || null,
          horario_arr: arr,
          logo_url: conf.logo_url || null,
          hero_bg_url: conf.hero_bg_url || null,
        })
        .eq('id', cafeteriaId);

      if (error) throw error;

      toast({ title: 'Guardado', description: 'Configuración actualizada' });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  /* ======================================================
   * Subida de imágenes (logo / fondo)
   * ====================================================== */
  const upFile = async (
    file: File,
    kind: 'logo' | 'hero' | 'movil'
  ) => {
    if (!cafeteriaId) return;

    if (!isAdmin) {
      toast({
        title: 'Acceso restringido',
        description: 'Solo administradores pueden cambiar imágenes',
        variant: 'destructive',
      });
      return;
    }

    try {
      const base64 = await fileToBase64(file);

      const patch =
        kind === 'logo'
          ? { logo_url: base64 }
          : kind === 'hero'
          ? { hero_bg_url: base64 }
          : { movil_bg: base64 };

      const { error } = await supabase
        .from('configuracion')
        .update(patch)

      if (error) throw error;

      await fetchConfig();

      setConf(c => (c ? { ...c, ...(patch as any) } : c));

      toast({ title: 'Imagen guardada' });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la imagen',
        variant: 'destructive',
      });
    } finally {
      if (fileLogo.current) fileLogo.current.value = '';
      if (fileHero.current) fileHero.current.value = '';
      if (fileMovil.current) fileMovil.current.value = '';
    }
  };

  /* ======================================================
   * Render (ESTILO ORIGINAL – SIN CAMBIOS)
   * ====================================================== */
  return (
    <ProtectedRoute>
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
              Configuración del Local
            </h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
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
              ) : !conf ? (
                <p className="text-white/80">No hay cafetería seleccionada.</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-white/90">Nombre del local</Label>
                      <Input
                        className="bg-white/90 text-[hsl(240_1.4%_13.5%)]"
                        value={conf.nombre_local || ''}
                        onChange={(e) =>
                          setConf(c => c ? { ...c, nombre_local: e.target.value } : c)
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-white/90">Dirección</Label>
                      <Input
                        className="bg-white/90 text-[hsl(240_1.4%_13.5%)]"
                        value={conf.direccion || ''}
                        onChange={(e) =>
                          setConf(c => c ? { ...c, direccion: e.target.value } : c)
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-white/90">
                        Horario de atención (una línea por día)
                      </Label>
                      <textarea
                        className="mt-1 w-full rounded-md border border-white/20 bg-white/90 p-2 text-sm text-[hsl(240_1.4%_13.5%)]"
                        rows={5}
                        value={horarioText}
                        onChange={(e) => setHorarioText(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-3">
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
                          onClick={() => isAdmin && fileLogo.current?.click()}
                          disabled={!isAdmin}
                          className="btn-white-hover"
                        >
                          <ImagePlus className="h-4 w-4 mr-2" /> Subir logo
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/90">Fondo Escritorio</Label>
                      <div className="flex items-center gap-3">
                        {conf.hero_bg_url && (
                          <img
                            src={conf.hero_bg_url}
                            className="h-14 w-24 rounded object-cover ring-1 ring-white/30"
                          />
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
                          onClick={() => isAdmin && fileHero.current?.click()}
                          disabled={!isAdmin}
                          className="btn-white-hover"
                        >
                          <ImagePlus className="h-4 w-4 mr-2" /> Subir fondo
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white/90">Fondo móvil</Label>

                      <div className="flex items-center gap-3">
                        {conf.movil_bg && (
                          <img
                            src={conf.movil_bg}
                            className="h-14 w-24 rounded object-cover ring-1 ring-white/30"
                          />
                        )}

                        <input
                          ref={fileMovil}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) upFile(f, 'movil');
                          }}
                        />

                        <Button
                          variant="outline"
                          onClick={() => isAdmin && fileMovil.current?.click()}
                          disabled={!isAdmin}
                          className="btn-white-hover"
                        >
                          <ImagePlus className="h-4 w-4 mr-2" /> Subir fondo móvil
                        </Button>
                      </div>
                    </div>

                  </div>

                  <div className="pt-4">
                    <Button onClick={save} disabled={saving}>
                      {saving ? 'Guardando…' : 'Guardar cambios'}
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
