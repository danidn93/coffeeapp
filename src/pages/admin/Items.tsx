// src/pages/admin/Items.tsx
import { useState, useEffect, useRef } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, ImagePlus, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Item {
  id: string;
  tipo: 'producto';
  nombre: string;
  disponible: boolean;
  created_at: string;
  image_url?: string | null;
  description?: string | null;
}

const AdminItems = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Crear
  const [formData, setFormData] = useState({
    tipo: 'producto' as 'producto',
    nombre: '',
    description: '',
  });

  // Editar (solo productos)
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    description: '',
  });

  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data as Item[]) || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los items', variant: 'destructive' });
    }
  };

  /* ====================== CREAR ====================== */
  const createItem = async () => {
    if (!formData.nombre.trim()) return;

    setIsLoading(true);
    try {
      const itemData: any = {
        tipo: formData.tipo,
        nombre: formData.nombre.trim(),
        disponible: true,
      };

      if (formData.tipo === 'producto') {
        if (formData.description) itemData.description = formData.description.trim();
      }

      const { error } = await supabase.from('items').insert([itemData]);
      if (error) throw error;

      setFormData({ tipo: 'producto', nombre: '', description: '' });
      fetchItems();
      toast({ title: 'Item creado', description: 'El item se ha creado exitosamente' });
    } catch (error) {
      console.error('Error creating item:', error);
      toast({ title: 'Error', description: 'No se pudo crear el item', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  /* ====================== EDITAR ====================== */
  const startEdit = (item: Item) => {
    if (item.tipo !== 'producto') return;
    setEditItem(item);
    setEditForm({
      nombre: item.nombre || '',
      description: item.description || '',
    });
    setEditOpen(true);
  };

  const updateItem = async () => {
    if (!editItem) return;
    if (!editForm.nombre.trim()) {
      toast({ title: 'Nombre requerido', description: 'Ingresa un nombre válido', variant: 'destructive' });
      return;
    }

    try {
      const payload: any = {
        nombre: editForm.nombre.trim(),
        description: editForm.description.trim() || null,
      };

      const { error } = await supabase.from('items').update(payload).eq('id', editItem.id);
      if (error) throw error;

      toast({ title: 'Producto actualizado', description: editForm.nombre });
      setEditOpen(false);
      setEditItem(null);
      await fetchItems();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  /* ====================== ESTADO / ELIMINAR ====================== */
  const toggleDisponible = async (id: string, disponible: boolean) => {
    try {
      const { error } = await supabase.from('items').update({ disponible: !disponible }).eq('id', id);
      if (error) throw error;
      fetchItems();
      toast({ title: 'Estado actualizado', description: 'El estado del item se ha actualizado' });
    } catch (error) {
      console.error('Error updating item:', error);
      toast({ title: 'Error', description: 'No se pudo actualizar el item', variant: 'destructive' });
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
      fetchItems();
      toast({ title: 'Item eliminado', description: 'El item se ha eliminado exitosamente' });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar el item', variant: 'destructive' });
    }
  };

  /* ====================== IMAGEN ====================== */
  const onUploadImage = async (item: Item, file: File) => {
    try {
      setUploadingId(item.id);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${item.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('productos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('productos').getPublicUrl(path);
      const publicUrl = pub?.publicUrl;

      const { error: updErr } = await supabase.from('items').update({ image_url: publicUrl }).eq('id', item.id);
      if (updErr) throw updErr;

      toast({ title: 'Imagen actualizada', description: item.nombre });
      fetchItems();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo subir la imagen', variant: 'destructive' });
    } finally {
      setUploadingId(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /* ====================== FILTRO ====================== */
  const productos = items
    .filter(i => i.tipo === 'producto')
    .filter(i => {
      const q = search.trim().toLowerCase();
      const matchSearch = q
        ? i.nombre.toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q)
        : true;
      return matchSearch;
    });

  /* ====================== RENDER ====================== */
  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        {/* Header translúcido (tema oscuro de tu layout) */}
        <header className="admin-header border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Link to="/admin">
              <Button variant="outline" size="sm" className="btn-white-hover">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl font-aventura tracking-wide text-white">Productos</h1>
            <div className="ml-auto flex gap-2">
              <Input
                placeholder="Buscar por nombre o descripción…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 bg-white/90 text-[hsl(240_1.4%_13.5%)] placeholder:text-[hsl(240_1.4%_13.5%/_0.65)]"
              />
            </div>
          </div>
        </header>

        {/* 🔲 Contenedor blanco para crear + listar productos */}
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-xl border bg-white text-slate-800 shadow-sm">
            <div className="p-6 grid gap-6">
              {/* Crear nuevo item */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Crear Nuevo Producto</CardTitle>
                  <CardDescription className="text-slate-600">
                    Agrega un nuevo producto al sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                    <div className="lg:col-span-2">
                      <Label htmlFor="nombre" className="text-slate-800">Nombre</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Expreso"
                        className="bg-white text-slate-900 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="lg:col-span-6">
                      <Label htmlFor="description" className="text-slate-800">Descripción (opcional)</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Ej: Bolón mixto con queso y chicharrón. Con salsa de queso."
                        className="bg-white text-slate-900 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="lg:col-span-1 flex items-end">
                      <Button
                        onClick={createItem}
                        disabled={isLoading || !formData.nombre.trim()}
                        className="w-full btn-accent"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {isLoading ? 'Creando…' : 'Crear'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Listado de productos */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    Productos <Badge className="bg-slate-900 text-white">{productos.length}</Badge>
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Incluye imagen, descripción, edición y disponibilidad
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      const item = items.find((it) => it.id === uploadingId);
                      if (file && item) onUploadImage(item, file);
                    }}
                  />

                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200">
                        <TableHead className="text-slate-600">Imagen</TableHead>
                        <TableHead className="text-slate-600">Nombre</TableHead>
                        <TableHead className="text-slate-600">Descripción</TableHead>
                        <TableHead className="text-slate-600">Estado</TableHead>
                        <TableHead className="text-slate-600">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {productos.map((producto) => (
                        <TableRow key={producto.id} className="border-slate-200">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {producto.image_url ? (
                                <img
                                  src={producto.image_url}
                                  className="h-12 w-12 object-cover rounded ring-1 ring-slate-200"
                                  alt={producto.nombre}
                                />
                              ) : (
                                <div className="h-12 w-12 rounded bg-slate-100 grid place-items-center text-xs text-slate-500">
                                  Sin img
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setUploadingId(producto.id);
                                  fileRef.current?.click();
                                }}
                                disabled={uploadingId === producto.id}
                              >
                                <ImagePlus className="h-4 w-4 mr-1" />
                                {uploadingId === producto.id ? 'Subiendo…' : 'Cambiar'}
                              </Button>
                            </div>
                          </TableCell>

                          <TableCell className="font-medium text-slate-900">{producto.nombre}</TableCell>

                          <TableCell className="max-w-[420px]">
                            <span className="line-clamp-2 text-sm text-slate-700">
                              {producto.description || '—'}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge
                              className={`cursor-pointer ${producto.disponible ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-300 text-slate-800 hover:bg-slate-400'}`}
                              onClick={() => toggleDisponible(producto.id, producto.disponible)}
                            >
                              {producto.disponible ? 'Disponible' : 'No disponible'}
                            </Badge>
                          </TableCell>

                          <TableCell className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => startEdit(producto)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => deleteItem(producto.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Modal Editar Producto */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
          </DialogHeader>

          {!editItem ? (
            <div className="py-6 text-sm text-muted-foreground">Selecciona un producto para editar.</div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nombre</Label>
                <Input
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Descripción visible en la vista de mesa"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={updateItem} disabled={!editItem} className="btn-accent">
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
};

export default AdminItems;
