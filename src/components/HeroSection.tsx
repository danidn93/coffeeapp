import { useEffect, useState } from "react";
import { MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/* =========================
   Props
========================= */
type HeroSectionProps = {
  cafeteriaId?: string | null;
};

/* =========================
   Tipos
========================= */
type Config = {
  nombre_local: string | null;
  direccion: string | null;
  telefono: string | null;
  horario: string | null;
  hero_bg_url: string | null;
  horario_arr: unknown; // ⚠️ jsonb → se normaliza luego
};

/* =========================
   Componente
========================= */
const HeroSection = ({ cafeteriaId }: HeroSectionProps) => {
  const [conf, setConf] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);

      let query = supabase
        .from("configuracion")
        .select(
          "id,nombre_local,direccion,telefono,horario,horario_arr,hero_bg_url"
        );

      // 🟢 Cafetería específica
      if (cafeteriaId) {
        query = query.eq("id", cafeteriaId).limit(1);
      }
      // 🔵 Fallback: última configuración
      else {
        query = query.order("updated_at", { ascending: false }).limit(1);
      }

      const { data, error } = await query.maybeSingle<Config>();

      if (!alive) return;

      if (!error && data) {
        setConf(data);
      } else {
        setConf(null);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [cafeteriaId]);

  /* =========================
     Normalización segura
  ========================= */

  const nombre = (conf?.nombre_local || "CAFETERÍA").toUpperCase();
  const dir = conf?.direccion || "Av. Principal 123, Centro Histórico";
  const bg = conf?.hero_bg_url || "/assets/hero-bar.png";

  // 🔑 NORMALIZACIÓN REAL DE horario_arr (jsonb)
  let lines: string[] = [];

  if (Array.isArray(conf?.horario_arr)) {
    lines = conf!.horario_arr.map(String);
  } else if (conf?.horario) {
    lines = conf.horario
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /* =========================
     Render
  ========================= */

  if (loading) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-black text-white">
        Cargando…
      </section>
    );
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Fondo */}
      <div className="absolute inset-0">
        <img
          src={bg}
          alt={`Interior de ${nombre}`}
          className="w-full h-full object-cover md:object-[65%_50%] lg:object-[70%_50%]"
        />
        <div className="absolute inset-0 bg-black/65 md:bg-black/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />
      </div>

      {/* Contenido */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-5 text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]">
          {nombre}
        </h1>

        <p className="text-xl md:text-2xl text-white/95 mb-4">
          Cafetería
        </p>

        <p className="text-lg text-white/90 mb-10 max-w-2xl mx-auto">
          Aromas que inspiran, espacios que conectan.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
          <a href="#menu">
            <Button variant="hero" size="xl">
              Ver Carta
            </Button>
          </a>
        </div>

        {/* Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#002E45]/70 backdrop-blur-md rounded-lg p-6 border border-white/10 shadow-xl">
            <MapPin className="w-6 h-6 text-white mx-auto mb-3 opacity-90" />
            <p className="text-sm font-semibold text-white">Ubicación</p>
            <p className="text-xs text-white/90">{dir}</p>
          </div>

          <div className="bg-[#002E45]/70 backdrop-blur-md rounded-lg p-6 border border-white/10 shadow-xl">
            <Clock className="w-6 h-6 text-white mx-auto mb-3 opacity-90" />
            <p className="text-sm font-semibold text-white text-center">
              Horarios
            </p>
            <div className="mt-2 space-y-1">
              {lines.length > 0 ? (
                lines.map((l, i) => (
                  <p
                    key={i}
                    className="text-xs text-white/90 text-center"
                  >
                    {l}
                  </p>
                ))
              ) : (
                <p className="text-xs text-white/80 text-center">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Indicador scroll */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-95">
        <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
