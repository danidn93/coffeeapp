// src/components/admin/AdminEventosPanel.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImagePlus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Evento = {
  id: string;
  titulo: string;
  fecha: string;        // ISO
  descripcion?: string | null;
  image_url?: string | null;
  created_at: string;
};

export default function AdminEventosPanel() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  // crear/editar
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(""); // datetime-local
  const [descripcion, setDescripcion] = useState("");

  // imagen
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null); // dataURL para vista previa inmediata
  const [imageUrl, setImageUrl] = useState<string | null>(null); // URL pública del bucket (después de subir)
  const fileRef = useRef<HTMLInputElement | null>(null);

  // modo edición
  const [editId, setEditId] = useState<string | null>(null);

  const fetchEventos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("eventos")
      .select("*")
      .order("fecha", { ascending: true });
    if (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar los eventos", variant: "destructive" });
    } else {
      setEventos((data as Evento[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEventos();
    const ch = supabase
      .channel("eventos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos" }, fetchEventos)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Subida al bucket "eventos"
  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `ev-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("eventos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("eventos").getPublicUrl(path);
      const url = pub?.publicUrl || null;
      if (!url) throw new Error("No se pudo obtener URL pública");
      setImageUrl(url);
      toast({ title: "Imagen subida" });
      return url;
    } finally {
      setUploading(false);
    }
  };

  // Al elegir archivo: sólo previsualizamos y guardamos el File
  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFileToUpload(f);
    // si selecciona nueva imagen, limpia la url anterior (la reemplazaremos)
    if (f) setImageUrl(null);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPreviewSrc(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreviewSrc(null);
    }
  };

  const clearForm = () => {
    setTitulo("");
    setFecha("");
    setDescripcion("");
    setFileToUpload(null);
    setPreviewSrc(null);
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = "";
    setEditId(null);
  };

  const createOrUpdate = async () => {
    if (!titulo.trim() || !fecha) {
      toast({ title: "Faltan datos", description: "Título y fecha son obligatorios", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let finalUrl = imageUrl;

      // Si hay archivo seleccionado pero aún no subido, súbelo ahora
      if (!finalUrl && fileToUpload) {
        finalUrl = await uploadImage(fileToUpload);
      }

      const payload = {
        titulo: titulo.trim(),
        fecha: new Date(fecha).toISOString(),
        descripcion: descripcion.trim() || null,
        image_url: finalUrl || null, // permite crear/editar sin imagen si no se sube
      };

      if (editId) {
        // UPDATE
        const { error } = await supabase.from("eventos").update(payload).eq("id", editId);
        if (error) {
          console.error("[eventos update]", error);
          toast({
            title: "Error",
            description: error.message || "No se pudo actualizar (revisa policies RLS de la tabla eventos)",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Evento actualizado" });
      } else {
        // INSERT
        const { error } = await supabase.from("eventos").insert([payload]);
        if (error) {
          console.error("[eventos insert]", error);
          toast({
            title: "Error",
            description: error.message || "No se pudo crear (revisa policies RLS de la tabla eventos)",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Evento creado" });
      }

      clearForm();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Operación no realizada", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (ev: Evento) => {
    setEditId(ev.id);
    setTitulo(ev.titulo);
    // convertir ISO -> input datetime-local (YYYY-MM-DDTHH:mm)
    const dt = new Date(ev.fecha);
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setFecha(local);
    setDescripcion(ev.descripcion || "");
    setImageUrl(ev.image_url || null);
    setFileToUpload(null);
    setPreviewSrc(null);
    if (fileRef.current) fileRef.current.value = "";
    // scroll al formulario
    window?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    clearForm();
    toast({ title: "Edición cancelada" });
  };

  const deleteEvento = async (id: string) => {
    const ok = confirm("¿Eliminar este evento?");
    if (!ok) return;
    const { error } = await supabase.from("eventos").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Evento eliminado" });
      // si estabas editando este, resetea
      if (editId === id) clearForm();
    }
  };

  const removeImage = () => {
    setImageUrl(null);
    setFileToUpload(null);
    setPreviewSrc(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Eventos</CardTitle>
        <CardDescription>Crear y administrar eventos del local</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {/* Form Crear/Editar */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {editId ? "Editar evento" : "Crear evento"}
            </h3>
            {editId && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Noche de Karaoke" />
          </div>
          <div className="space-y-2">
            <Label>Fecha y hora</Label>
            <Input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Descripción (opcional)</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Detalles del evento…" />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Imagen del evento</Label>
            <div className="flex items-center gap-3">
              {/* Preview inmediato si hay archivo, o URL subida si ya existe */}
              {previewSrc ? (
                <img src={previewSrc} className="h-16 w-24 rounded object-cover" />
              ) : imageUrl ? (
                <img src={imageUrl} className="h-16 w-24 rounded object-cover" />
              ) : null}

              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <ImagePlus className="h-4 w-4 mr-2" />
                {uploading ? "Subiendo…" : (imageUrl || previewSrc ? "Cambiar imagen" : "Subir imagen")}
              </Button>

              {(imageUrl || previewSrc) && (
                <Button variant="ghost" onClick={removeImage}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Quitar imagen
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se muestra una vista previa inmediata. Si no subiste aún, se subirá automáticamente al {editId ? "guardar cambios" : "crear el evento"}.
            </p>
          </div>

          <div className="md:col-span-2">
            <Button onClick={createOrUpdate} disabled={uploading || saving || !titulo.trim() || !fecha}>
              {saving ? (editId ? "Guardando…" : "Guardando…") : (editId ? "Guardar cambios" : "Crear evento")}
            </Button>
          </div>
        </div>

        {/* Listado */}
        <div>
          {loading ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imagen</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell>
                      {ev.image_url ? (
                        <img src={ev.image_url} className="h-12 w-20 rounded object-cover" />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{ev.titulo}</TableCell>
                    <TableCell>{fmt(ev.fecha)}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => startEdit(ev)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteEvento(ev.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {eventos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No hay eventos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
