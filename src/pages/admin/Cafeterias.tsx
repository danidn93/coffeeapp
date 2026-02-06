'use client';

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ArrowLeft, PlusCircle } from 'lucide-react';

/* =========================
 * TIPOS
 * ========================= */
type CafeteriaRow = {
  id: string;
  abierto: boolean;
  nombre_local: string | null;
  direccion: string | null;
  horario: string | null;
};

/* =========================
 * CONSTANTES
 * ========================= */
const SUPER_ADMIN_EMAIL = 'darmijoss1';
const TEMPLATE_CAFETERIA_ID = 'ffdcee7f-dd24-4209-b7d8-e1557bbb1346'; // la que ya tiene imágenes

export default function GestionCafeterias() {
  const { user } = useAuth();

  /* =========================
   * PERMISOS
   * ========================= */
  const isSuperAdmin = user?.username === SUPER_ADMIN_EMAIL;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<CafeteriaRow[]>([]);

  // Form creación (arriba)
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [horario, setHorario] = useState('');

  /* =========================
   * DATA
   * ========================= */
  const fetchCafeterias = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('configuracion')
      .select('id,abierto,nombre_local,direccion,horario')
      .order('nombre_local', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows((data as CafeteriaRow[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) fetchCafeterias();
  }, [isSuperAdmin]);

  /* =========================
   * ACCIONES
   * ========================= */

  // Abrir / Cerrar (única acción en lista)
  const toggleAbierto = async (row: CafeteriaRow) => {
    const next = !row.abierto;

    const { error } = await supabase
      .from('configuracion')
      .update({ abierto: next })
      .eq('id', row.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: next ? 'Cafetería abierta' : 'Cafetería cerrada' });

    // update optimista
    setRows(prev =>
      prev.map(r => (r.id === row.id ? { ...r, abierto: next } : r))
    );
  };

  // Crear (hereda imágenes desde TEMPLATE_CAFETERIA_ID; horario lo das tú)
  const createCafeteria = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim() || !horario.trim()) {
      toast({
        title: 'Datos incompletos',
        description: 'Nombre y horario son obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    const horarioArr = horario
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      // 1) tomar imágenes del template
      const { data: tpl, error: tplErr } = await supabase
        .from('configuracion')
        .select('logo_url, hero_bg_url, movil_bg')
        .eq('id', TEMPLATE_CAFETERIA_ID)
        .single();

      if (tplErr) throw tplErr;

      // 2) insertar nueva cafetería heredando imágenes
      const { data: inserted, error } = await supabase
        .from('configuracion')
        .insert({
          abierto: true,
          nombre_local: nombre.trim(),
          direccion: direccion.trim() || null,
          horario: horarioArr.join('\n'),
          horario_arr: horarioArr,
          logo_url: tpl?.logo_url ?? null,
          hero_bg_url: tpl?.hero_bg_url ?? null,
          movil_bg: tpl?.movil_bg ?? null,
        })
        .select('id,abierto,nombre_local,direccion,horario')
        .single();

      if (error) throw error;

      toast({ title: 'Cafetería creada' });

      // limpiar form
      setNombre('');
      setDireccion('');
      setHorario('');

      // agregar arriba en lista
      if (inserted) {
        setRows(prev => {
          const next = [inserted as CafeteriaRow, ...prev];
          // reordenar por nombre (opcional)
          return next.sort((a, b) =>
            (a.nombre_local || '').localeCompare(b.nombre_local || '')
          );
        });
      } else {
        await fetchCafeterias();
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'No se pudo crear la cafetería.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  /* =========================
   * BLOQUEO SI NO ES ADMIN
   * ========================= */
  if (!isSuperAdmin) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-white">Acceso Denegado</h1>
          <p className="text-white/80">Solo el usuario autorizado puede acceder.</p>
          <Link to="/admin">
            <Button variant="outline" className="mt-4">Volver</Button>
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  /* =========================
   * RENDER
   * ========================= */
  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">

        <header className="admin-header border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/admin">
                <Button variant="outline" size="sm" className="btn-white-hover">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>
              </Link>

              <h1 className="text-2xl font-aventura tracking-wide text-white">
                Gestión de Cafeterías
              </h1>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 space-y-6">

          {/* ====== CREACIÓN ARRIBA ====== */}
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="card-title">Nueva Cafetería</CardTitle>
              <CardDescription className="card-subtitle">
                El horario lo defines tú. Las imágenes (logo/fondos) se heredarán automáticamente.
              </CardDescription>
            </CardHeader>

            <CardContent className="card-inner">
              <form onSubmit={createCafeteria} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/90">Nombre</Label>
                    <Input
                      className="bg-white/90 text-[hsl(240_1.4%_13.5%)]"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Cafetería Biblioteca"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/90">Dirección</Label>
                    <Input
                      className="bg-white/90 text-[hsl(240_1.4%_13.5%)]"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Ej: Planta baja, junto a ..."
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-white/90">Horario (una línea por día)</Label>
                    <textarea
                      className="mt-1 w-full rounded-md border border-white/20 bg-white/90 p-2 text-sm text-[hsl(240_1.4%_13.5%)]"
                      rows={5}
                      value={horario}
                      onChange={(e) => setHorario(e.target.value)}
                      placeholder={`Lunes 07:00 - 18:00\nMartes 07:00 - 18:00\n...`}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="btn-accent" disabled={saving}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {saving ? 'Creando…' : 'Crear cafetería'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ====== LISTA DEBAJO ====== */}
          <Card className="bg-white text-slate-800 shadow-lg">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='text-black'>Nombre</TableHead>
                    <TableHead className='text-black'>Dirección</TableHead>
                    <TableHead className='text-black'>Horario</TableHead>
                    <TableHead className='text-black'>Estado</TableHead>
                    <TableHead className="text-center text-black">Acción</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        Cargando…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        No hay cafeterías creadas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.nombre_local || '—'}
                        </TableCell>

                        <TableCell>
                          {c.direccion || '—'}
                        </TableCell>

                        <TableCell className="text-xs whitespace-pre-line">
                          {c.horario || '—'}
                        </TableCell>

                        <TableCell>
                          <Badge className={c.abierto ? 'bg-emerald-600' : 'bg-red-600'}>
                            {c.abierto ? 'Abierta' : 'Cerrada'}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={c.abierto ? 'destructive' : 'default'}
                            onClick={() => toggleAbierto(c)}
                          >
                            {c.abierto ? 'Cerrar' : 'Abrir'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>

              </Table>
            </CardContent>
          </Card>

        </main>
      </div>
    </ProtectedRoute>
  );
}
