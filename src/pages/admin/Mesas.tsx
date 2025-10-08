// src/pages/admin/AdminMesas.tsx
import { useState, useEffect } from 'react';
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
}

type MesaUpdate = TablesUpdate<'mesas'>;

const AdminMesas = () => {
  const { toast } = useToast();

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [newMesaName, setNewMesaName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMesas();
  }, []);

  const fetchMesas = async () => {
    try {
      const { data, error } = await supabase
        .from('mesas')
        .select('*')
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
  };

  const createMesa = async () => {
    if (!newMesaName.trim()) {
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

      const { error } = await supabase
        .from('mesas')
        .insert([{ nombre: newMesaName.trim(), slug, token, activa: true }]); // por defecto activa

      if (error) throw error;

      setNewMesaName('');
      await fetchMesas();
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

  const generateQRCode = async (mesa: Mesa) => {
    try {
      const QRCode = await import('qrcode');
      const url = `${window.location.origin}/m/${mesa.slug}?t=${mesa.token}`;
      const qrCodeDataURL = await QRCode.toDataURL(url, { width: 300, margin: 2 });

      const link = document.createElement('a');
      link.download = `qr-${mesa.nombre}.png`;
      link.href = qrCodeDataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'QR generado',
        description: `Se descargó el QR de “${mesa.nombre}”.`,
      });
    } catch (error) {
      console.error('Error generating QR:', error);
      toast({
        title: 'No se pudo generar el QR',
        description: 'Intenta nuevamente.',
        variant: 'destructive',
      });
    }
  };

  const copyMesaURL = (mesa: Mesa) => {
    const url = `${window.location.origin}/m/${mesa.slug}?t=${mesa.token}`;
    navigator.clipboard
      .writeText(url)
      .then(() =>
        toast({
          title: 'URL copiada',
          description: 'El enlace de la sala se copió al portapapeles.',
        })
      )
      .catch(() =>
        toast({
          title: 'No se pudo copiar',
          description: 'Intenta nuevamente.',
          variant: 'destructive',
        })
      );
  };

  const deleteMesa = async (id: string) => {
    try {
      const { error } = await supabase.from('mesas').delete().eq('id', id);
      if (error) throw error;
      await fetchMesas();
      toast({
        title: 'Sala eliminada',
        description: 'La sala se eliminó exitosamente.',
      });
    } catch (error) {
      console.error('Error deleting sala:', error);
      toast({
        title: 'No se pudo eliminar',
        description: 'Ocurrió un problema eliminando la sala.',
        variant: 'destructive',
      });
    }
  };

  // Activar / Desactivar mesa (toggle)
  const toggleActiva = async (mesa: Mesa, nuevaActiva: boolean) => {
    // Optimistic UI
    setMesas((prev) => prev.map((m) => (m.id === mesa.id ? { ...m, activa: nuevaActiva } : m)));
    try {
      const payload: MesaUpdate = { activa: nuevaActiva };
      const { error } = await supabase.from('mesas').update(payload).eq('id', mesa.id);
      if (error) throw error;

      toast({
        title: nuevaActiva ? 'Sala activada' : 'Sala desactivada',
        description: mesa.nombre,
      });
    } catch (error) {
      // revertir si falla
      setMesas((prev) => prev.map((m) => (m.id === mesa.id ? { ...m, activa: !nuevaActiva } : m)));
      console.error('Error toggling activa:', error);
      toast({
        title: 'No se pudo actualizar',
        description: 'No se actualizó el estado de la sala.',
        variant: 'destructive',
      });
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        {/* Header translúcido */}
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

        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-6">
            {/* Crear nueva sala (card translúcida) */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="card-title">Crear Nueva Sala</CardTitle>
                <CardDescription className="card-subtitle">
                  Agrega una nueva sala al sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="card-inner">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex-1">
                    <Label htmlFor="mesa-name" className="text-white/90">Nombre de la Sala</Label>
                    <Input
                      id="mesa-name"
                      value={newMesaName}
                      onChange={(e) => setNewMesaName(e.target.value)}
                      placeholder="Ej: Sala 1, VIP 1, etc."
                      className="bg-white/90 text-[hsl(240_1.4%_13.5%)] placeholder:text-[hsl(240_1.4%_13.5%_/_.65)]"
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

            {/* Listado (card translúcida) */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="card-title">Salas Existentes</CardTitle>
                <CardDescription className="card-subtitle">
                  Lista de todas las salas en el sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="card-inner">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-white/80">Nombre</TableHead>
                      <TableHead className="text-white/80">Slug</TableHead>
                      <TableHead className="text-white/80">Estado</TableHead>
                      <TableHead className="text-white/80">Creación</TableHead>
                      <TableHead className="text-white/80">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mesas.map((mesa) => {
                      const isEditing = editingId === mesa.id;
                      return (
                        <TableRow key={mesa.id}>
                          <TableCell className="font-medium text-white">
                            {mesa.nombre}
                          </TableCell>
                          <TableCell className="text-white/90">{mesa.slug}</TableCell>

                          {/* Columna Estado con Switch blanco */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Switch
                                className="switch-white"
                                checked={mesa.activa}
                                onCheckedChange={(val) => toggleActiva(mesa, Boolean(val))}
                                aria-label={`Cambiar estado de ${mesa.nombre}`}
                              />
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  mesa.activa
                                    ? 'bg-[hsl(150_80%_94%)] text-[hsl(150_30%_22%)]'
                                    : 'bg-[hsl(0_80%_95%)] text-[hsl(0_60%_30%)]'
                                }`}
                              >
                                {mesa.activa ? 'Activa' : 'Inactiva'}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-white/80">
                            {new Date(mesa.created_at).toLocaleDateString()}
                          </TableCell>

                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="btn-white-hover"
                                onClick={() => generateQRCode(mesa)}
                                title="Generar Código QR"
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="btn-white-hover"
                                onClick={() => copyMesaURL(mesa)}
                                title="Copiar enlace de la sala"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="btn-white-hover"
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
    </ProtectedRoute>
  );
};

export default AdminMesas;
