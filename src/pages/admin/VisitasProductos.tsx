import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Icons
import { ArrowLeft, Plus, Trash2, ImagePlus, Pencil, Image as ImageIcon } from 'lucide-react';

// ===== Tipos =====
type CatalogItem = {
  id: string;
  nombre: string;
  categoria_label: string | null;
  description: string | null;
  image_url: string | null;
  disponible: boolean;
  created_at: string;
};

type FormState = {
  id?: string;
  nombre: string;
  categoria_label: string;
  description: string;
  image_url: string;
  disponible: boolean;
};

const emptyForm: FormState = {
  nombre: '',
  categoria_label: '',
  description: '',
  image_url: '',
  disponible: true,
};

export default function VisitasProductos() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Crear
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);

  // Editar
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [updating, setUpdating] = useState(false);

  // Búsqueda
  const [search, setSearch] = useState('');

  // Upload imagen
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // ===== Debug sesión (por si hay 403 en Storage) =====
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('[VisitasProductos] session uid:', data.session?.user?.id ?? 'NO SESSION');
    });
  }, []);

  // ===== Cargar catálogo =====
  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_visitas_catalog')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data as CatalogItem[]) || []);
    } catch (e: any) {
      console.error('[fetchItems] error', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo cargar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // ===== Filtro =====
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      (i.nombre + ' ' + (i.categoria_label || '') + ' ' + (i.description || '')).toLowerCase().includes(q),
    );
  }, [items, search]);

  // ===== Helpers =====
  const openCreate = () => {
    setCreateForm(emptyForm);
    setCreateOpen(true);
  };

  const startEdit = (it: CatalogItem) => {
    setEditItem(it);
    setEditForm({
      id: it.id,
      nombre: it.nombre || '',
      categoria_label: it.categoria_label || '',
      description: it.description || '',
      image_url: it.image_url || '',
      disponible: it.disponible,
    });
    setEditOpen(true);
  };

  // ===== Upload a Storage (bucket: visitas) =====
  const uploadImage = async (file: File, targetId?: string): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    // si tenemos id, guardamos por carpeta; sino, genérico
    const path = targetId
      ? `${targetId}/${Date.now()}.${ext}`
      : `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    console.log('[upload] start', { bucket: 'visitas', path, type: file.type });

    const { error } = await supabase.storage.from('visitas').upload(path, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type,
    });
    if (error) {
      console.error('[upload] error', error);
      throw error;
    }

    const { data } = supabase.storage.from('visitas').getPublicUrl(path);
    return data.publicUrl;
  };

  // ===== Crear =====
  const createItem = async () => {
    if (!createForm.nombre.trim()) {
      toast({ title: 'Nombre requerido', description: 'Ingresa un nombre válido', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const payload = {
        nombre: createForm.nombre.trim(),
        categoria_label: createForm.categoria_label.trim() || null,
        description: createForm.description.trim() || null,
        image_url: createForm.image_url.trim() || null,
        disponible: createForm.disponible,
      };

      const { data, error } = await supabase.from('menu_visitas_catalog').insert(payload).select().single();
      if (error) throw error;

      setItems((prev) => [data as any as CatalogItem, ...prev]);
      setCreateOpen(false);
      toast({ title: 'Producto creado' });
    } catch (e: any) {
      console.error('[createItem] error', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo crear', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // ===== Editar =====
  const updateItem = async () => {
    if (!editItem) return;
    if (!editForm.nombre.trim()) {
      toast({ title: 'Nombre requerido', description: 'Ingresa un nombre válido', variant: 'destructive' });
      return;
    }

    setUpdating(true);
    try {
      const payload = {
        nombre: editForm.nombre.trim(),
        categoria_label: editForm.categoria_label.trim() || null,
        description: editForm.description.trim() || null,
        image_url: editForm.image_url.trim() || null,
        disponible: editForm.disponible,
      };

      const { error } = await supabase.from('menu_visitas_catalog').update(payload).eq('id', editItem.id);
      if (error) throw error;

      toast({ title: 'Producto actualizado', description: editForm.nombre });
      setEditOpen(false);
      setEditItem(null);
      await fetchItems();
    } catch (e: any) {
      console.error('[updateItem] error', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo actualizar', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  // ===== Cambiar estado =====
  const toggleDisponible = async (item: CatalogItem) => {
    try {
      const { error } = await supabase
        .from('menu_visitas_catalog')
        .update({ disponible: !item.disponible })
        .eq('id', item.id);
      if (error) throw error;

      toast({ title: 'Estado actualizado' });
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, disponible: !p.disponible } : p)));
    } catch (e: any) {
      console.error('[toggleDisponible] error', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  // ===== Eliminar =====
  const removeItem = async (id: string) => {
    const prev = items;
    setItems(prev.filter((p) => p.id !== id));

    try {
      const { error } = await supabase.from('menu_visitas_catalog').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Producto eliminado' });
    } catch (e: any) {
      console.error('[removeItem] error', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo eliminar', variant: 'destructive' });
      setItems(prev); // revert
    }
  };

  // ===== Upload desde tabla (cambiar imagen) =====
  const onUploadImage = async (item: CatalogItem, file: File) => {
    try {
      setUploadingId(item.id);
      const publicUrl = await uploadImage(file, item.id);

      const { error: updErr } = await supabase
        .from('menu_visitas_catalog')
        .update({ image_url: publicUrl })
        .eq('id', item.id);
      if (updErr) throw updErr;

      toast({ title: 'Imagen actualizada', description: item.nombre });
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, image_url: publicUrl } : p)));
    } catch (e: any) {
      console.error('[onUploadImage] error', e);
      toast({ title: 'Error', description: e?.message || 'No se pudo subir la imagen', variant: 'destructive' });
    } finally {
      setUploadingId(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-[60vh]">
        {/* Header */}
        <header className="admin-header border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Link to="/admin">
              <Button variant="outline" size="sm" className="btn-white-hover">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl text-white tracking-wide">Productos (Visitas)</h1>
            <div className="ml-auto flex gap-2">
              <Input
                placeholder="Buscar por nombre, etiqueta o descripción…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 bg-white/90 text-[hsl(240_1.4%_13.5%)] placeholder:text-[hsl(240_1.4%_13.5%/_0.65)]"
              />
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo
              </Button>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-xl border bg-white text-slate-800 shadow-sm">
            <div className="p-6 grid gap-6">
              {/* Tabla */}
              <Card className="bg-transparent shadow-none border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">
                    Catálogo independiente de visitas{' '}
                    <Badge className="bg-slate-900 text-white">{filtered.length}</Badge>
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Puedes cambiar imágenes, editar datos y activar/desactivar disponibilidad.
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

                  {loading ? (
                    <div className="py-10 text-sm text-slate-500">Cargando…</div>
                  ) : filtered.length === 0 ? (
                    <div className="py-10 text-sm text-slate-500">No hay productos.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-200">
                          <TableHead className="text-slate-600">Imagen</TableHead>
                          <TableHead className="text-slate-600">Nombre</TableHead>
                          <TableHead className="text-slate-600">Etiqueta</TableHead>
                          <TableHead className="text-slate-600">Descripción</TableHead>
                          <TableHead className="text-slate-600">Estado</TableHead>
                          <TableHead className="text-slate-600">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filtered.map((it) => (
                          <TableRow key={it.id} className="border-slate-200">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {it.image_url ? (
                                  <img
                                    src={it.image_url}
                                    className="h-12 w-12 object-cover rounded ring-1 ring-slate-200"
                                    alt={it.nombre}
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
                                    setUploadingId(it.id);
                                    fileRef.current?.click();
                                  }}
                                  disabled={uploadingId === it.id}
                                >
                                  <ImagePlus className="h-4 w-4 mr-1" />
                                  {uploadingId === it.id ? 'Subiendo…' : 'Cambiar'}
                                </Button>
                              </div>
                            </TableCell>

                            <TableCell className="font-medium text-slate-900">
                              {it.nombre}
                            </TableCell>

                            <TableCell className="text-slate-700">
                              {it.categoria_label || '—'}
                            </TableCell>

                            <TableCell className="max-w-[420px]">
                              <span className="line-clamp-2 text-sm text-slate-700">
                                {it.description || '—'}
                              </span>
                            </TableCell>

                            <TableCell>
                              <Badge
                                className={`cursor-pointer ${
                                  it.disponible
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-slate-300 text-slate-800 hover:bg-slate-400'
                                }`}
                                onClick={() => toggleDisponible(it)}
                              >
                                {it.disponible ? 'Disponible' : 'No disponible'}
                              </Badge>
                            </TableCell>

                            <TableCell className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => startEdit(it)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => removeItem(it.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* ===== Modal Crear ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Nuevo producto (Visitas)</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input
                value={createForm.nombre}
                onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
                placeholder="Ej: Jugo natural"
              />
            </div>

            <div>
              <Label>Etiqueta (opcional)</Label>
              <Input
                value={createForm.categoria_label}
                onChange={(e) => setCreateForm({ ...createForm, categoria_label: e.target.value })}
                placeholder="Ej: Desayuno / Almuerzo / Merienda"
              />
            </div>

            <div>
              <Label>Descripción (opcional)</Label>
              <Input
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Detalles visibles para las visitas"
              />
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="URL de imagen (opcional)"
                value={createForm.image_url}
                onChange={(e) => setCreateForm({ ...createForm, image_url: e.target.value })}
              />
              <input
                type="file"
                ref={fileRef}
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await uploadImage(f); // aún no hay id; crea ruta genérica
                    setCreateForm((prev) => ({ ...prev, image_url: url }));
                    toast({ title: 'Imagen subida' });
                  } catch (err: any) {
                    console.error('[create upload] error', err);
                    toast({
                      title: 'Error al subir',
                      description: err?.message || 'Revisa policies de storage',
                      variant: 'destructive',
                    });
                  } finally {
                    e.currentTarget.value = '';
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                <ImageIcon className="h-4 w-4 mr-1" />
                Subir
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Label>Disponible</Label>
              <input
                type="checkbox"
                checked={createForm.disponible}
                onChange={(e) => setCreateForm({ ...createForm, disponible: e.target.checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createItem} disabled={creating || !createForm.nombre.trim()}>
              {creating ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modal Editar ===== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Editar producto (Visitas)</DialogTitle>
          </DialogHeader>

          {!editItem ? (
            <div className="py-6 text-sm text-muted-foreground">Selecciona un producto para editar.</div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                />
              </div>

              <div>
                <Label>Etiqueta (opcional)</Label>
                <Input
                  value={editForm.categoria_label}
                  onChange={(e) => setEditForm({ ...editForm, categoria_label: e.target.value })}
                />
              </div>

              <div>
                <Label>Descripción (opcional)</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Descripción visible"
                />
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="URL de imagen (opcional)"
                  value={editForm.image_url}
                  onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                />
                <input
                  type="file"
                  ref={fileRef}
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !editItem) return;
                    try {
                      const url = await uploadImage(f, editItem.id);
                      setEditForm((prev) => ({ ...prev, image_url: url }));
                      toast({ title: 'Imagen subida' });
                    } catch (err: any) {
                      console.error('[edit upload] error', err);
                      toast({
                        title: 'Error al subir',
                        description: err?.message || 'Revisa policies de storage',
                        variant: 'destructive',
                      });
                    } finally {
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-1" />
                  Subir
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Label>Disponible</Label>
                <input
                  type="checkbox"
                  checked={editForm.disponible}
                  onChange={(e) => setEditForm({ ...editForm, disponible: e.target.checked })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={updateItem} disabled={!editItem || updating}>
              {updating ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
