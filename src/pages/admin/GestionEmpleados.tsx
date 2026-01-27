import { useEffect, useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/use-debounce';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

import { ArrowLeft, PlusCircle, Edit, Trash2, Search, User } from 'lucide-react';

/* =========================
   Tipos
========================= */
type Direccion = {
  id: string;
  nombre: string;
  slug: string | null;
};

type EmpleadoAutorizado = {
  id: string;
  email: string;
  nombre_completo: string;
  telefono: string | null;
  direccion_id: string;
  fecha_nacimiento: string | null;
  direcciones?: { nombre: string; slug: string | null } | null;
};

type AppUser = {
  id: string;
  email: string;
  username: string;
  role: string;
  is_verified: boolean;
  created_at: string;
};

/* =========================
   Página principal
========================= */
export default function GestionEmpleados() {
  const { user, isDTH, isDAC } = useAuth();
  const canManageEmpleados = isDTH || isDAC;

  const [empleados, setEmpleados] = useState<EmpleadoAutorizado[]>([]);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<EmpleadoAutorizado | null>(null);

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  /* =========================
     Cargar datos
  ========================= */
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: direData, error: direError } = await supabase
        .from('direcciones')
        .select('id, nombre, slug')
        .order('nombre');

      if (direError) throw direError;
      setDirecciones(direData || []);

      let query = supabase
        .from('empleados_autorizados')
        .select('*, direcciones(nombre, slug)')
        .order('nombre_completo');

      if (debouncedSearchTerm) {
        const search = `%${debouncedSearchTerm}%`;
        query = query.or(`nombre_completo.ilike.${search},email.ilike.${search}`);
      }

      const { data: empData, error: empError } = await query;
      if (empError) throw empError;

      setEmpleados(empData || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (canManageEmpleados) fetchAllData();
  }, [canManageEmpleados, fetchAllData]);

  /* =========================
     Acciones
  ========================= */
  const openNew = () => {
    setEditData(null);
    setIsModalOpen(true);
  };

  const openEdit = (emp: EmpleadoAutorizado) => {
    setEditData(emp);
    setIsModalOpen(true);
  };

  const handleViewAppUser = async (email: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from('app_users')
      .select('id, email, username, role, is_verified, created_at')
      .eq('email', email)
      .maybeSingle();

    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    if (!data) {
      toast({ title: 'Sin cuenta', description: 'El empleado aún no se ha registrado.' });
      return;
    }

    setAppUser(data);
    setIsUserDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!user || !appUser) return;

    const { error } = await supabase.rpc('reset_app_user_password', {
      p_admin_user_id: user.id,
      p_user_id: appUser.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Contraseña reestablecida',
        description: 'La nueva contraseña es el username del usuario.',
      });
    }
  };

  const handleDeleteConfirm = async (empleado: EmpleadoAutorizado) => {
    if (!user) return;

    const { error } = await supabase.rpc('delete_empleado_sincronizado', {
      p_admin_user_id: user.id,
      p_empleado_id: empleado.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Empleado eliminado' });
      fetchAllData();
    }
  };

  /* =========================
     Seguridad
  ========================= */
  if (!canManageEmpleados) {
    return (
      <ProtectedRoute>
        <div className="text-center py-10">
          <h1 className="text-xl font-bold">Acceso denegado</h1>
        </div>
      </ProtectedRoute>
    );
  }

  /* =========================
     Render
  ========================= */
  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        <header className="border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex justify-between">
            <Link to="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <Button onClick={openNew} className="btn-accent">
              <PlusCircle className="mr-2 h-4 w-4" />
              Autorizar empleado
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Empleados autorizados</CardTitle>
              <CardDescription>Usuarios permitidos para registrarse en la PWA</CardDescription>
              <div className="relative pt-4" >
                <Search className="absolute left-2.5 top-[2.2rem] h-4 w-4 text-slate-500" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por nombre o email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : empleados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        Sin registros
                      </TableCell>
                    </TableRow>
                  ) : (
                    empleados.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>{emp.nombre_completo}</TableCell>
                        <TableCell>{emp.email}</TableCell>
                        <TableCell>{emp.direcciones?.nombre || 'N/A'}</TableCell>
                        <TableCell>{emp.telefono || 'N/A'}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(emp)}>
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleViewAppUser(emp.email)}
                          >
                            <User className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar empleado</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción es irreversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600"
                                  onClick={() => handleDeleteConfirm(emp)}
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

        <EmpleadoAutorizadoModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={fetchAllData}
          empleado={editData}
          direcciones={direcciones}
          adminUserId={user?.id}
        />

        {/* =========================
            MODAL USUARIO APP
        ========================= */}
        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usuario de la aplicación</DialogTitle>
              <DialogDescription>Información de acceso</DialogDescription>
            </DialogHeader>

            {appUser && (
              <div className="space-y-1 text-sm">
                <p><strong>Email:</strong> {appUser.email}</p>
                <p><strong>Username:</strong> {appUser.username}</p>
                <p><strong>Rol:</strong> {appUser.role}</p>
                <p><strong>Verificado:</strong> {appUser.is_verified ? 'Sí' : 'No'}</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="destructive" onClick={handleResetPassword}>
                Reestablecer contraseña
              </Button>
              <DialogClose asChild>
                <Button variant="outline">Cerrar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}

/* =========================
   MODAL CRUD EMPLEADO
========================= */
type EmpleadoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  empleado: EmpleadoAutorizado | null;
  direcciones: Direccion[];
  adminUserId?: string;
};

function EmpleadoAutorizadoModal({
  isOpen,
  onClose,
  onSave,
  empleado,
  direcciones,
  adminUserId,
}: EmpleadoModalProps) {
  const [formData, setFormData] = useState<Partial<EmpleadoAutorizado>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(
        empleado ?? {
          nombre_completo: '',
          email: '',
          telefono: '',
          direccion_id: undefined,
          fecha_nacimiento: '',
        }
      );
    }
  }, [isOpen, empleado]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUserId || !formData.email || !formData.nombre_completo || !formData.direccion_id) {
      toast({ title: 'Campos obligatorios faltantes', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    const rpc = empleado
      ? 'update_empleado_autorizado_y_sincronizar'
      : 'create_empleado_autorizado';

    const payload = {
      p_admin_user_id: adminUserId,
      p_empleado_id: empleado?.id,
      p_email: formData.email,
      p_nombre_completo: formData.nombre_completo,
      p_telefono: formData.telefono || null,
      p_direccion_id: formData.direccion_id,
      p_fecha_nacimiento: formData.fecha_nacimiento || null,
    };

    const { error } = await supabase.rpc(rpc, payload);

    setIsSubmitting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Guardado correctamente' });
      onSave();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{empleado ? 'Editar' : 'Autorizar'} empleado</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <Input
            placeholder="Nombre completo"
            value={formData.nombre_completo || ''}
            onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
          />
          <Input
            placeholder="Email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            placeholder="Teléfono"
            value={formData.telefono || ''}
            onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
          />

          <Select
            value={formData.direccion_id}
            onValueChange={(v) => setFormData({ ...formData, direccion_id: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione dirección" />
            </SelectTrigger>
            <SelectContent>
              {direcciones.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button disabled={isSubmitting} className="btn-accent">
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
