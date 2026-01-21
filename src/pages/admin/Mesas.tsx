import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, QrCode, Trash2, Copy, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Link } from 'react-router-dom';

interface Mesa {
  id: string;
  nombre: string;
  slug: string;
  token: string;
  activa: boolean;
  created_at: string;
  cafeteria_id: string;
}

type MesaUpdate = TablesUpdate<'mesas'>;

const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

const AdminMesas = () => {
  const { toast } = useToast();

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [newMesaName, setNewMesaName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [cafeteriaId, setCafeteriaId] = useState<string | null>(
    () => localStorage.getItem(CAFETERIA_LS_KEY)
  );

  /* ======================================================
   * Escuchar cambio de cafetería (SIN reload)
   * ====================================================== */
  useEffect(() => {
    const handler = () => {
      setCafeteriaId(localStorage.getItem(CAFETERIA_LS_KEY));
    };

    window.addEventListener('cafeteria-change', handler);
    return () => window.removeEventListener('cafeteria-change', handler);
  }, []);

  /* ======================================================
   * Fetch mesas por cafetería
   * ====================================================== */
  const fetchMesas = useCallback(async () => {
    if (!cafeteriaId) {
      setMesas([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .eq('cafeteria_id', cafeteriaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMesas((data as Mesa[]) || []);
    } catch (error) {
      console.error('Error fetching salas:', error);
      toast({
        title: 'Error al cargar',
        description: 'No se pudieron cargar las salas',
        variant: 'destructive',
      });
    }
  }, [cafeteriaId, toast]);

  useEffect(() => {
    fetchMesas();
  }, [fetchMesas]);

  /* ======================================================
   * Crear mesa (con cafetería)
   * ====================================================== */
  const createMesa = async () => {
    if (!newMesaName.trim() || !cafeteriaId) {
      toast({
        title: 'Nombre requerido',
        description: 'Ingresa un nombre para la sala.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const slug = `mesa-${Date.now()}`;
      const token = Math.random().toString(36).substring(2, 15);

      const { error } = await supabase.from('mesas').insert([
        {
          nombre: newMesaName.trim(),
          slug,
          token,
          activa: true,
          cafeteria_id: cafeteriaId,
        },
      ]);

      if (error) throw error;

      setNewMesaName('');
      fetchMesas();
      toast({ title: 'Sala creada' });
    } catch (error) {
      console.error('Error creando sala:', error);
      toast({
        title: 'No se pudo crear',
        description: 'Ocurrió un problema creando la sala.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ======================================================
   * QR / Copiar / Eliminar
   * ====================================================== */
  const generateQRCode = async (mesa: Mesa) => {
    const QRCode = await import('qrcode');
    const url = `${window.location.origin}/m/${mesa.slug}?t=${mesa.token}`;
    const qrCodeDataURL = await QRCode.toDataURL(url, { width: 300, margin: 2 });

    const link = document.createElement('a');
    link.download = `qr-${mesa.nombre}.png`;
    link.href = qrCodeDataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyMesaURL = (mesa: Mesa) => {
    navigator.clipboard.writeText(
      `${window.location.origin}/m/${mesa.slug}?t=${mesa.token}`
    );
    toast({ title: 'URL copiada' });
  };

  const deleteMesa = async (id: string) => {
    await supabase.from('mesas').delete().eq('id', id);
    fetchMesas();
  };

  /* ======================================================
   * Toggle activa (sin cambios visuales)
   * ====================================================== */
  const toggleActiva = async (mesa: Mesa, nuevaActiva: boolean) => {
    setMesas((prev) =>
      prev.map((m) => (m.id === mesa.id ? { ...m, activa: nuevaActiva } : m))
    );

    try {
      const payload: MesaUpdate = { activa: nuevaActiva };
      const { error } = await supabase.from('mesas').update(payload).eq('id', mesa.id);
      if (error) throw error;
    } catch (error) {
      setMesas((prev) =>
        prev.map((m) => (m.id === mesa.id ? { ...m, activa: !nuevaActiva } : m))
      );
    }
  };

  /* ======================================================
   * RENDER – 100 % IGUAL AL ORIGINAL
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
              Listado de Salas
            </h1>
          </div>
        </header>

        {/* 🔲 Contenedor blanco para crear + listar salas */}
        <div className="container mx-auto px-4 py-8">
          <div className="rounded-xl border bg-white text-slate-800 shadow-sm">
            <div className="p-6 grid gap-6">
              {/* Crear nueva sala */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Crear Nueva Sala</CardTitle>
                  <CardDescription className="text-slate-600">
                    Agrega una nueva sala al sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex-1">
                      <Label htmlFor="mesa-name" className="text-slate-800">Nombre de la Sala</Label>
                      <Input
                        id="mesa-name"
                        value={newMesaName}
                        onChange={(e) => setNewMesaName(e.target.value)}
                        placeholder="Ej: Sala 1, VIP 1, etc."
                        className="bg-white text-slate-900 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        onClick={createMesa}
                        disabled={isLoading || !newMesaName.trim()}
                        className="btn-accent"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {isLoading ? 'Creando…' : 'Crear Sala'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Listado de salas */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Salas Existentes</CardTitle>
                  <CardDescription className="text-slate-600">
                    Lista de todas las salas en el sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-600">Nombre</TableHead>
                        <TableHead className="text-slate-600">Estado</TableHead>
                        <TableHead className="text-slate-600">Creación</TableHead>
                        <TableHead className="text-slate-600">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mesas.map((mesa) => {
                        const isEditing = editingId === mesa.id;
                        return (
                          <TableRow key={mesa.id} className="border-slate-200">
                            <TableCell className="font-medium text-slate-900">
                              {mesa.nombre}
                            </TableCell>

                            {/* Columna Estado con Switch */}
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={mesa.activa}
                                  onCheckedChange={(val) => toggleActiva(mesa, Boolean(val))}
                                  aria-label={`Cambiar estado de ${mesa.nombre}`}
                                  className="data-[state=checked]:bg-orange-600 data-[state=unchecked]:bg-slate-300"
                                />
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    mesa.activa
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {mesa.activa ? 'Activa' : 'Inactiva'}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="text-slate-700">
                              {new Date(mesa.created_at).toLocaleDateString()}
                            </TableCell>

                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateQRCode(mesa)}
                                  title="Generar Código QR"
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyMesaURL(mesa)}
                                  title="Copiar enlace de la sala"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteMesa(mesa.id)}
                                  title="Eliminar sala"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminMesas;
