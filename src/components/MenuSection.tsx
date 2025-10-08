import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Imágenes de soporte (puedes personalizar por categoría si quieres)
const fallbackImg = "/assets/food.jpg";

type Item = {
  id: string;
  tipo: "producto" | "cancion";
  nombre: string;
  categoria?: string | null;
  precio?: number | null;
  disponible: boolean;
  image_url?: string | null;
  description?: string | null;
};

const fmtCOP = (n?: number | null) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(Number(n || 0));

/** Normaliza categoría para agrupar */
const norm = (s?: string | null) =>
  (s ?? "Otros").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const MenuSection = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Fetch productos disponibles
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id,tipo,nombre,disponible,image_url,description")
        .eq("tipo", "producto")
        .eq("disponible", true)
        .order("created_at", { ascending: false });

      if (!error) setItems((data as Item[]) || []);
    })();
  }, []);

  // Autoplay 2s
  useEffect(() => {
    if (items.length === 0) return;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, 2000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [items.length]);

  // Agrupar por categoría para mostrar info auxiliar
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const key = norm(it.categoria);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const current = items[idx];

  return (
    <section className="py-20 px-4 bg-[hsl(210_40%_96%)]/40" id="menu">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(210_40%_10%)]">
            Nuestra <span className="text-[#FF6900]">Carta</span>
          </h2>
          <p className="text-lg text-[hsl(215_16%_35%)]">
            Selección de productos destacados. Desliza automáticamente cada 2&nbsp;segundos.
          </p>
        </div>

        {/* Carrusel */}
        <div className="relative h-[420px] sm:h-[460px]">
          {/* Slide activo */}
          {current ? (
            <div
              key={current.id}
              className="absolute inset-0 grid place-items-center"
            >
              <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                <div className="relative h-64 sm:h-80">
                  <img
                    src={current.image_url || fallbackImg}
                    alt={current.nombre}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#002E45]/80 via-[#002E45]/30 to-transparent" />
                </div>

                <div className="bg-white/85 backdrop-blur px-6 py-5 sm:py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[hsl(215_16%_35%)]">
                        {current.categoria ?? "Producto"}
                      </p>
                      <h3 className="text-2xl font-bold text-[hsl(210_40%_10%)]">
                        {current.nombre}
                      </h3>
                      {current.description && (
                        <p className="text-sm text-[hsl(215_16%_42%)] mt-1 line-clamp-2">
                          {current.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-block rounded-full bg-[#FF6900] text-white px-3 py-1 text-sm font-semibold">
                        {current.precio != null ? fmtCOP(current.precio) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[hsl(215_16%_42%)]">
              Aún no hay productos disponibles.
            </div>
          )}
        </div>

        {/* Píldoras de categoría (informativas) */}
        {grouped.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {grouped.map(([cat]) => (
              <span
                key={cat}
                className="text-xs uppercase tracking-wide bg-[#002E45] text-white/95 px-3 py-1 rounded-full"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MenuSection;
