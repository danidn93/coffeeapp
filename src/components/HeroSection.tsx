import { useEffect, useState } from "react";
import { MapPin, Clock, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Config = {
  nombre_local?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  horario?: string | null;
  hero_bg_url?: string | null;
  horario_arr?: string[] | null;
};

const HeroSection = () => {
  const [conf, setConf] = useState<Config | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("configuracion")
        .select("nombre_local,direccion,horario,horario_arr,hero_bg_url")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setConf((data as any) || null);
    })();
  }, []);

  const nombre = (conf?.nombre_local || "COFFE APP").toUpperCase();
  const dir = conf?.direccion || "Av. Principal 123, Centro Histórico";
  const tel = conf?.telefono || "+1 (555) 123-4567";
  const bg  = conf?.hero_bg_url || "/assets/hero-bar.png";
  const lines: string[] =
    conf?.horario_arr?.length
      ? conf.horario_arr!
      : (conf?.horario ? conf.horario.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Fondo + oscurecedores para máximo contraste */}
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
            <Button variant="hero" size="xl">Ver Carta</Button>
          </a>
        </div>

        {/* Tarjetas de info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#002E45]/70 backdrop-blur-md rounded-lg p-6 border border-white/10 shadow-xl">
            <MapPin className="w-6 h-6 text-white mx-auto mb-3 opacity-90" />
            <p className="text-sm font-semibold text-white">Ubicación</p>
            <p className="text-xs text-white/90">{dir}</p>
          </div>
          <div className="bg-[#002E45]/70 backdrop-blur-md rounded-lg p-6 border border-white/10 shadow-xl">
            <Clock className="w-6 h-6 text-white mx-auto mb-3 opacity-90" />
            <p className="text-sm font-semibold text-white text-center">Horarios</p>
            <div className="mt-2 space-y-1">
              {lines.length > 0 ? (
                lines.map((l, i) => (
                  <p key={i} className="text-xs text-white/90 text-center">{l}</p>
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
