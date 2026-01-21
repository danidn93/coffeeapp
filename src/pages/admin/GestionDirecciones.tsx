import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, PlusCircle, Edit, Trash2 } from 'lucide-react';

/* =========================
 * TIPOS
 * ========================= */

type Direccion = {
  id: string;
  nombre: string;
  slug: string | null;
  activa: boolean;
  cafeteria_ids: string[];
};

type Cafeteria = {
  id: string;
  nombre_local: string | null;
};

/* =========================
 * PÁGINA PRINCIPAL
 * ========================= */

export default function GestionDirecciones() {
  const { user, isDAC } = useAuth();

  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<Direccion | null>(null);

  /* =========================
   * DATA
   * ========================= */

  const fetchDirecciones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('direcciones')
      .select('id, nombre, slug, activa, cafeteria_ids')
      .order('nombre');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setDirecciones([]);
    } else {
      setDirecciones(data || []);
    }
    setLoading(false);
  };

  const fetchCafeterias = async () => {
    const { data, error } = await supabase
      .from('configuracion')
      .select('id, nombre_local')
      .order('nombre_local');

    if (!error) setCafeterias(data || []);
  };

  useEffect(() => {
    if (isDAC) {
      fetchDirecciones();
      fetchCafeterias();
    }
  }, [isDAC]);

  /* =========================
   * ACCIONES
   * ========================= */

  const openNew = () => {
    setEditData(null);
    setIsModalOpen(true);
  };

  const openEdit = (d: Direccion) => {
    setEditData(d);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async (direccionId: string) => {
    if (!user) return;

    setLoading(true);
    const { error } = await supabase
      .from('direcciones')
      .delete()
      .eq('id', direccionId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dirección eliminada' });
      fetchDirecciones();
    }
    setLoading(false);
  };

  /* =========================
   * PERMISOS
   * ========================= */

  if (!isDAC) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-white">Acceso Denegado</h1>
          <p className="text-white/80">Solo usuarios DAC pueden acceder.</p>
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
                Gestión de Direcciones
              </h1>
            </div>

            <Button onClick={openNew} className="btn-accent">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nueva Dirección
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card className="bg-white text-slate-800 shadow-lg">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cafeterías</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        Cargando…
                      </TableCell>
                    </TableRow>
                  ) : direcciones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        No hay direcciones creadas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    direcciones.map((dir) => (
                      <TableRow key={dir.id}>
                        <TableCell className="font-medium">{dir.nombre}</TableCell>
                        <TableCell className="font-mono">{dir.slug}</TableCell>
                        <TableCell>
                          <Badge
                            className={dir.activa ? 'bg-emerald-600' : 'bg-red-600'}
                          >
                            {dir.activa ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {dir.cafeteria_ids.length}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(dir)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar dirección?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600"
                                  onClick={() => handleDeleteConfirm(dir.id)}
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>

        <DireccionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={fetchDirecciones}
          direccion={editData}
          cafeterias={cafeterias}
        />
      </div>
    </ProtectedRoute>
  );
}

/* =========================
 * MODAL
 * ========================= */

type DireccionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  direccion: Direccion | null;
  cafeterias: Cafeteria[];
};

function DireccionModal({
  isOpen,
  onClose,
  onSave,
  direccion,
  cafeterias,
}: DireccionModalProps) {
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [activa, setActiva] = useState(true);
  const [cafeteriaIds, setCafeteriaIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (direccion) {
        setNombre(direccion.nombre);
        setSlug(direccion.slug || '');
        setActiva(direccion.activa);
        setCafeteriaIds(direccion.cafeteria_ids || []);
      } else {
        setNombre('');
        setSlug('');
        setActiva(true);
        setCafeteriaIds([]);
      }
    }
  }, [isOpen, direccion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre || !slug || cafeteriaIds.length === 0) {
      toast({
        title: 'Datos incompletos',
        description: 'Nombre, slug y cafeterías son obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const payload = {
      nombre,
      slug: slug.toUpperCase(),
      activa,
      cafeteria_ids: cafeteriaIds,
    };

    const { error } = direccion
      ? await supabase.from('direcciones').update(payload).eq('id', direccion.id)
      : await supabase.from('direcciones').insert(payload);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Guardado correctamente' });
      onSave();
      onClose();
    }

    setSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>
            {direccion ? 'Editar Dirección' : 'Nueva Dirección'}
          </DialogTitle>
          <DialogDescription>
            Asigna las cafeterías permitidas para esta dirección.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Nombre</Label>
              <Input className="col-span-3" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Slug</Label>
              <Input className="col-span-3" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Activa</Label>
              <Switch checked={activa} onCheckedChange={setActiva} />
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-1">Cafeterías</Label>
              <div className="col-span-3 space-y-2">
                {cafeterias.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cafeteriaIds.includes(c.id)}
                      onChange={(e) =>
                        setCafeteriaIds((prev) =>
                          e.target.checked
                            ? [...prev, c.id]
                            : prev.filter((id) => id !== c.id)
                        )
                      }
                    />
                    {c.nombre_local || 'Cafetería'}
                  </label>
                ))}
              </div>
            </div>

          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={saving} className="btn-accent">
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
