// src/components/MenuSection.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* =========================
   Props
========================= */
type MenuSectionProps = {
  cafeteriaId?: string | null;
};

/* =========================
   Tipos
========================= */
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

/* ========================= */

const fallbackImg = "/assets/food.jpg";

const MenuSection = ({ cafeteriaId }: MenuSectionProps) => {
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<number | null>(null);

  /* =========================
     Fetch productos
  ========================= */
  useEffect(() => {
    let query = supabase
      .from("items")
      .select("id,tipo,nombre,disponible,image_url,description")
      .eq("tipo", "producto")
      .eq("disponible", true);

    // 🟢 Si viene cafeteriaId → filtrar
    if (cafeteriaId) {
      query = query.eq("cafeteria_id", cafeteriaId);
    }

    (async () => {
      const { data, error } = await query.order("created_at", { ascending: false });

      if (!error) {
        setItems((data as Item[]) || []);
        setIdx(0);
      }
    })();
  }, [cafeteriaId]);

  /* =========================
     Autoplay carrusel
  ========================= */
  useEffect(() => {
    if (items.length === 0) return;

    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, 2000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [items.length]);

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
          {current ? (
            <div key={current.id} className="absolute inset-0 grid place-items-center">
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
