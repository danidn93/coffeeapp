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
  

  const current = items[idx];

  return (
    <section className="py-20 px-4 bg-[hsl(210_40%_96%)]/40" id="menu">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(210_40%_10%)]">
            Nuestra <span className="text-[#FF6900]">Carta</span>
          </h2>
          
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
                      
                      <h3 className="text-2xl font-bold text-[hsl(210_40%_10%)]">
                        {current.nombre}
                      </h3>
                      {current.description && (
                        <p className="text-sm text-[hsl(215_16%_42%)] mt-1 line-clamp-2">
                          {current.description}
                        </p>
                      )}
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

        
      </div>
    </section>
  );
};

export default MenuSection;
