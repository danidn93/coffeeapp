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

const CAFETERIA_LS_KEY = 'cafeteria_activa_id';

interface Item {
  id: string;
  tipo: 'producto';
  nombre: string;
  disponible: boolean;
  created_at: string;
  image_url?: string | null;
  description?: string | null;
  cafeteria_id: string;
}

const AdminItems = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [cafeteriaId, setCafeteriaId] = useState<string | null>(
    () => localStorage.getItem(CAFETERIA_LS_KEY)
  );

  const [formData, setFormData] = useState({
    tipo: 'producto' as 'producto',
    nombre: '',
    description: '',
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    description: '',
  });

  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  /* ============================
   * ESCUCHAR CAMBIO DE CAFETERÍA
   * ============================ */
  useEffect(() => {
    const onCafeteriaChange = () => {
      setCafeteriaId(localStorage.getItem(CAFETERIA_LS_KEY));
    };

    window.addEventListener('cafeteria-change', onCafeteriaChange);
    return () => {
      window.removeEventListener('cafeteria-change', onCafeteriaChange);
    };
  }, []);

  /* ============================
   * FETCH ITEMS POR CAFETERÍA
   * ============================ */
  const fetchItems = async () => {
    if (!cafeteriaId) {
      setItems([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('cafeteria_id', cafeteriaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data as Item[]) || []);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los items',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchItems();
  }, [cafeteriaId]);

  /* ====================== CREAR ====================== */
  const createItem = async () => {
    if (!formData.nombre.trim() || !cafeteriaId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('items').insert([{
        tipo: 'producto',
        nombre: formData.nombre.trim(),
        description: formData.description.trim() || null,
        disponible: true,
        cafeteria_id: cafeteriaId,
      }]);

      if (error) throw error;

      setFormData({ tipo: 'producto', nombre: '', description: '' });
      fetchItems();
      toast({ title: 'Item creado' });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo crear el item',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ====================== EDITAR ====================== */
  const startEdit = (item: Item) => {
    setEditItem(item);
    setEditForm({
      nombre: item.nombre,
      description: item.description || '',
    });
    setEditOpen(true);
  };

  const updateItem = async () => {
    if (!editItem) return;

    const { error } = await supabase
      .from('items')
      .update({
        nombre: editForm.nombre.trim(),
        description: editForm.description.trim() || null,
      })
      .eq('id', editItem.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Producto actualizado' });
    setEditOpen(false);
    fetchItems();
  };

  /* ====================== ESTADO / ELIMINAR ====================== */
  const toggleDisponible = async (item: Item) => {
    await supabase
      .from('items')
      .update({ disponible: !item.disponible })
      .eq('id', item.id);

    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('items').delete().eq('id', id);
    fetchItems();
  };

  /* ====================== IMAGEN ====================== */
  const onUploadImage = async (item: Item, file: File) => {
    try {
      setUploadingId(item.id);

      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${item.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('productos')
        .upload(path, file, {
          contentType: file.type,
          cacheControl: '0',
        });

      if (uploadError) {
        console.error('UPLOAD ERROR:', uploadError);
        toast({
          title: 'Error al subir imagen',
          description: uploadError.message,
          variant: 'destructive',
        });
        return;
      }

      const { data } = supabase.storage
        .from('productos')
        .getPublicUrl(path);

      if (!data?.publicUrl) {
        toast({
          title: 'Error',
          description: 'No se pudo obtener la URL pública',
          variant: 'destructive',
        });
        return;
      }

      const { error: updateError } = await supabase
        .from('items')
        .update({ image_url: data.publicUrl })
        .eq('id', item.id);

      if (updateError) {
        toast({
          title: 'Error',
          description: updateError.message,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Imagen actualizada' });
      fetchItems();

    } finally {
      setUploadingId(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /* ====================== FILTRO ====================== */
  const productos = items.filter(i => {
    const q = search.toLowerCase();
    return q
      ? i.nombre.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      : true;
  });

  /* ====================== RENDER ====================== */
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
              Productos
            </h1>
            <div className="ml-auto">
              <Input
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 bg-white/90"
              />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="rounded-xl border bg-white text-slate-800 shadow-sm">
            <div className="p-6 grid gap-6">

              {/* Crear */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">
                    Crear Nuevo Producto
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Agrega un nuevo producto al sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                    <div className="lg:col-span-2">
                      <Label className="text-slate-800">Nombre</Label>
                      <Input
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="bg-white text-slate-900 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="lg:col-span-6">
                      <Label className="text-slate-800">Descripción (opcional)</Label>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                        Crear
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabla */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardContent>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      const item = items.find(i => i.id === uploadingId);
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
                                  src={`${producto.image_url}?v=${Date.now()}`}
                                  className="h-12 w-12 object-cover rounded ring-1 ring-slate-200"
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
                              >
                                <ImagePlus className="h-4 w-4 mr-1" />
                                Cambiar
                              </Button>
                            </div>
                          </TableCell>

                          <TableCell className="font-medium text-slate-900">
                            {producto.nombre}
                          </TableCell>

                          <TableCell className="max-w-[420px]">
                            <span className="line-clamp-2 text-sm text-slate-700">
                              {producto.description || '—'}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge
                              className={`cursor-pointer ${
                                producto.disponible
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-slate-300 text-slate-800 hover:bg-slate-400'
                              }`}
                              onClick={() => toggleDisponible(producto)}
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

      {/* Modal editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
          </DialogHeader>

          {editItem && (
            <div className="grid gap-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                />
              </div>
              <div>
                <Label>Descripción</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={updateItem} className="btn-accent">
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
};

export default AdminItems;
