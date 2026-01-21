// src/pages/Eventos.tsx
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Evento = {
  id: string;
  titulo: string;
  fecha: string;              // ISO en UTC
  descripcion?: string | null;
  image_url?: string | null;
};

const DIAS_SOON = 7;

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

function isWithinDays(iso: string, days: number) {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const diff = ts - now; // ms en el futuro (si es pasado, será negativo)
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

export default function Eventos() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  const nowIso = useMemo(() => new Date().toISOString(), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("eventos")
        // 👇 esto ya oculta los pasados desde la consulta
        .select("*")
        .gte("fecha", nowIso)
        .order("fecha", { ascending: true });

      if (!error) setEventos((data as Evento[]) || []);
      setLoading(false);
    })();
  }, [nowIso]);

  return (
    <div id="eventos" className="min-h-screen py-20 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Eventos</h1>
          <p className="text-muted-foreground">Conoce lo que se viene en Almibar</p>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Cargando…</p>
        ) : eventos.length === 0 ? (
          <p className="text-center text-muted-foreground">No hay eventos próximos.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {eventos.map((ev) => {
              const soon = isWithinDays(ev.fecha, DIAS_SOON);

              return (
                <Card
                  key={ev.id}
                  className="relative bg-gradient-card border-amber-500/20 shadow-elegant overflow-hidden"
                >
                  {/* Banda inclinada “PRÓXIMAMENTE” (se muestra sólo si soon === true) */}
                  {soon && (
                    <div
                      className="
                        pointer-events-none
                        absolute left-[-60px] top-6
                        rotate-[-18deg]
                        bg-red-600/90 text-white
                        px-24 py-2
                        shadow-md
                        uppercase tracking-widest text-sm font-extrabold
                        ring-1 ring-red-800/70
                      "
                      style={{ letterSpacing: "0.15em" }}
                    >
                      Próximamente
                    </div>
                  )}

                  {ev.image_url && (
                    <img src={ev.image_url} alt={ev.titulo} className="w-full h-44 object-cover" />
                  )}

                  <CardHeader>
                    <CardTitle className="text-foreground">{ev.titulo}</CardTitle>
                    <CardDescription>{fmtFecha(ev.fecha)}</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {ev.descripcion || "¡Te esperamos!"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
