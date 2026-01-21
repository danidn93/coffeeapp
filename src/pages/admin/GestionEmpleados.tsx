// src/pages/admin/GestionEmpleados.tsx
import { useEffect, useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/use-debounce'; // (Necesitarás este hook)

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
} from "@/components/ui/alert-dialog";
import { ArrowLeft, PlusCircle, Edit, Trash2, Search } from 'lucide-react';

// --- Tipos para DTH ---
type Direccion = { id: string; nombre: string; slug: string | null };

type EmpleadoAutorizado = {
  id: string;
  email: string;
  nombre_completo: string;
  telefono: string | null;
  direccion_id: string;
  fecha_nacimiento: string | null;
  direcciones?: { nombre: string; slug: string | null } | null; // Para el join
};

export default function GestionEmpleados() {
  // ✨ Obtenemos el 'user' (para el user_id de la auditoría) y 'isDTH'
  const { user, isDTH } = useAuth(); 
  const [empleados, setEmpleados] = useState<EmpleadoAutorizado[]>([]);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<EmpleadoAutorizado | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300); 

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Cargar Direcciones (TODAS, activas o no)
      const { data: direData, error: direError } = await supabase
          .from('direcciones')
          .select('id, nombre, slug, activa') // Incluimos 'activa' para info
          .order('nombre', { ascending: true });
          
      if (direError) throw direError;
      setDirecciones(direData || []);

      // 2. Cargar Empleados (con filtro de búsqueda)
      let query = supabase
        .from('empleados_autorizados')
        .select('*, direcciones(nombre, slug)')
        .order('nombre_completo', { ascending: true });

      if (debouncedSearchTerm) {
        // ✨ Busca por nombre, apellido (palabras en el nombre) o email
        const search = `%${debouncedSearchTerm}%`;
        query = query.or(`nombre_completo.ilike.${search}, email.ilike.${search}`);
      }

      const { data: empData, error: empError } = await query;
      if (empError) throw empError;
      setEmpleados(empData || []);

    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setEmpleados([]);
      setDirecciones([]);
    }
    setLoading(false);
  }, [debouncedSearchTerm]); 

  useEffect(() => {
    if (isDTH) {
      fetchAllData();
    }
  }, [isDTH, fetchAllData]);

  const openNew = () => {
    setEditData(null);
    setIsModalOpen(true);
  };

  const openEdit = (user: EmpleadoAutorizado) => {
    setEditData(user);
    setIsModalOpen(true);
  };
  
  // --- Lógica de Borrado Seguro (RPC) ---
  const handleDeleteConfirm = async (empleado: EmpleadoAutorizado) => {
    if (!user) {
      toast({ title: 'Error', description: 'Usuario admin no encontrado.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // ✨ Llama al RPC de borrado sincronizado
      const { error } = await supabase.rpc('delete_empleado_sincronizado', {
        p_admin_user_id: user.id, // ID del Admin
        p_empleado_id: empleado.id // ID del empleado a borrar
      });
      
      if (error) throw error;
      
      toast({ title: 'Éxito', description: `Empleado ${empleado.nombre_completo} eliminado y/o anonimizado.` });
      fetchAllData(); // Recargar la lista

    } catch (e: any) {
      toast({ title: 'Error al eliminar', description: e.message, variant: 'destructive' });
      setLoading(false);
    }
  };


  // Renderizado condicional
  if (!isDTH) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-white">Acceso Denegado</h1>
          <p className="text-white/80">No tienes permisos para ver esta sección (Solo DTH).</p>
          <Link to="/admin">
            <Button variant="outline" className="mt-4">Volver al Dashboard</Button>
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        <header className="admin-header border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin">
                <Button variant="outline" size="sm" className="btn-white-hover">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>
              </Link>
              <h1 className="text-2xl font-aventura tracking-wide text-white">Autorizar Empleados</h1>
            </div>
            <Button onClick={openNew} className="btn-accent">
              <PlusCircle className="mr-2 h-4 w-4" />
              Autorizar Empleado
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card className="bg-white text-slate-800 shadow-lg">
             <CardHeader>
                <CardTitle className="text-slate-900">Empleados Autorizados</CardTitle>
                <CardDescription className="text-slate-600">
                  Esta lista contiene los empleados que pueden registrarse en la aplicación PWA.
                </CardDescription>
                {/* ✨ Buscador */}
                <div className="relative pt-4">
                  <Search className="absolute left-2.5 top-[2.2rem] h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Buscar por nombre, apellido o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 bg-white"
                  />
                </div>
              </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>Email (para registro)</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">Cargando...</TableCell>
                    </TableRow>
                  ) : empleados.length === 0 ? (
                       <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                          {searchTerm ? 'No se encontraron resultados.' : 'No hay empleados autorizados.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                    empleados.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.nombre_completo}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.direcciones?.nombre || 'N/A'}</TableCell>
                        <TableCell>{user.telefono || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" title="Editar Usuario" onClick={() => openEdit(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          {/* ✨ Botón de Borrado Sincronizado */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Eliminar" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar Empleado?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminará a <strong>{user.nombre_completo}</strong> de la lista de <span className="font-bold">Empleados Autorizados</span> 
                                  y se <span className="font-bold">anonimizará</span> su cuenta de login (PWA) si existe.
                                  <br/><br/>
                                  <span className="text-red-600">Esta acción no se puede deshacer.</span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteConfirm(user)} className="bg-red-600 hover:bg-red-700">
                                  Confirmar Eliminación
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
          adminUserId={user?.id} // ✨ Pasa el ID del admin para la auditoría
        />
      </div>
    </ProtectedRoute>
  );
}

// --- Componente Modal para Crear/Editar Empleado Autorizado ---
type EmpleadoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  empleado: EmpleadoAutorizado | null;
  direcciones: Direccion[];
  adminUserId?: string; // ✨ Recibe el ID del admin
};

function EmpleadoAutorizadoModal({ isOpen, onClose, onSave, empleado, direcciones, adminUserId }: EmpleadoModalProps) {
  
  const [formData, setFormData] = useState<Partial<EmpleadoAutorizado>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (empleado) {
        // Editando
        setFormData({
          nombre_completo: empleado.nombre_completo,
          email: empleado.email,
          telefono: empleado.telefono,
          direccion_id: empleado.direccion_id,
          fecha_nacimiento: empleado.fecha_nacimiento,
        });
      } else {
        // Nuevo
        setFormData({
          nombre_completo: '',
          email: '',
          telefono: '',
          direccion_id: undefined,
          fecha_nacimiento: '',
        });
      }
    }
  }, [isOpen, empleado]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleSelectChange = (value: string) => {
     setFormData(prev => ({ ...prev, direccion_id: value === 'null' ? undefined : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminUserId) {
      toast({ title: 'Error fatal', description: 'No se pudo identificar al administrador. Refresca la página.', variant: 'destructive' });
      return;
    }
    if (!formData.email || !formData.nombre_completo || !formData.direccion_id) {
        toast({ title: 'Campos requeridos', description: 'Email, Nombre y Dirección son obligatorios.', variant: 'destructive' });
        return;
    }
    
    setIsSubmitting(true);
    let error = null;

    if (empleado) {
      // --- ✨ ACTUALIZAR (Llama al RPC con auditoría) ---
      const { error: updateError } = await supabase.rpc('update_empleado_autorizado_y_sincronizar', {
          p_admin_user_id: adminUserId,
          p_empleado_id: empleado.id,
          p_email: formData.email,
          p_nombre_completo: formData.nombre_completo,
          p_telefono: formData.telefono || null,
          p_direccion_id: formData.direccion_id,
          p_fecha_nacimiento: formData.fecha_nacimiento || null
      });
      error = updateError;
      
    } else {
      // --- CREAR (Llama al RPC con auditoría) ---
      const { error: createError } = await supabase.rpc('create_empleado_autorizado', {
          p_admin_user_id: adminUserId,
          p_email: formData.email,
          p_nombre_completo: formData.nombre_completo,
          p_telefono: formData.telefono || null,
          p_direccion_id: formData.direccion_id,
          p_fecha_nacimiento: formData.fecha_nacimiento || null,
      });
      error = createError;
    }

    if (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: `Empleado ${empleado ? 'actualizado' : 'autorizado'}.` });
      onSave();
      onClose();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white text-slate-900 max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{empleado ? 'Editar' : 'Autorizar'} Empleado</DialogTitle>
          <DialogDescription>
            {empleado ? 'Modifica los datos del empleado.' : 'Autoriza a un empleado a registrarse en la PWA.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <Label>Nombre Completo*</Label>
            <Input name="nombre_completo" value={formData.nombre_completo || ''} onChange={handleChange} className="bg-white" />
            
            <Label>Email (para registro)*</Label>
            <Input name="email" type="email" value={formData.email || ''} onChange={handleChange} className="bg-white" />

            <Label>Teléfono</Label>
            <Input name="telefono" value={formData.telefono || ''} onChange={handleChange} className="bg-white" />
            
            <Label>Fecha Nacimiento</Label>
            <Input name="fecha_nacimiento" type="date" value={formData.fecha_nacimiento || ''} onChange={handleChange} className="bg-white" />
            
            <Label>Dirección*</Label>
            <Select name="direccion_id" value={formData.direccion_id || 'null'} onValueChange={handleSelectChange}>
              <SelectTrigger className="bg-white text-slate-900"><SelectValue placeholder="Seleccione una dirección..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="null" disabled>Seleccione una dirección...</SelectItem>
                {direcciones.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre} ({d.slug})
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className="btn-accent">
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// (Asegúrate de tener este hook en src/hooks/use-debounce.ts)
/*
// src/hooks/use-debounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
*/