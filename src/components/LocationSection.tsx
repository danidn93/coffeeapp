import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Microwave,
  Clock,
  Table2,
  Armchair,
  Navigation,
  Wifi,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* =========================
   Props
========================= */
type LocationSectionProps = {
  cafeteriaId?: string | null;
};

/* =========================
   Tipos
========================= */
type Config = {
  nombre_local?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  horario?: string | null;
  horario_arr?: string[] | null;
  maps_url?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;
};

/* =========================
   Constantes
========================= */
const DEFAULT_LAT = -2.150259239945485;
const DEFAULT_LNG = -79.60386782884599;

const UNEMI_VIEWER_URL =
  "https://navegador-unemi.onrender.com/?lat=-2.150356&lng=-79.604133&z=17";

/* ========================= */

const LocationSection = ({ cafeteriaId }: LocationSectionProps) => {
  const [conf, setConf] = useState<Config | null>(null);

  useEffect(() => {
    let alive = true;

    let query = supabase
      .from("configuracion")
      .select(
        "nombre_local,direccion,telefono,horario,horario_arr,maps_url,lat,lng"
      );

    // 🟢 Si viene cafeteriaId → filtrar
    if (cafeteriaId) {
      query = query.eq("id", cafeteriaId).limit(1);
    }
    // 🔵 Si no viene → última config
    else {
      query = query.order("updated_at", { ascending: false }).limit(1);
    }

    (async () => {
      const { data, error } = await query.maybeSingle();
      if (!alive) return;
      if (!error) setConf((data as Config) || null);
    })();

    return () => {
      alive = false;
    };
  }, [cafeteriaId]);

  /* =========================
     Datos derivados
  ========================= */
  const nombre = conf?.nombre_local || "Cafetería Bloque R";
  const direccion =
    conf?.direccion ?? "Planta Alta Bloque R, junto a sala de sesiones";
  const telefono = conf?.telefono ?? "+52 (55) 1234-5678";

  const lines: string[] =
    conf?.horario_arr && conf.horario_arr.length > 0
      ? conf.horario_arr
      : conf?.horario
      ? conf.horario
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const lat =
    typeof conf?.lat === "string"
      ? parseFloat(conf.lat)
      : (conf?.lat as number | undefined);

  const lng =
    typeof conf?.lng === "string"
      ? parseFloat(conf.lng)
      : (conf?.lng as number | undefined);

  const mapLat = Number.isFinite(lat) ? (lat as number) : DEFAULT_LAT;
  const mapLng = Number.isFinite(lng) ? (lng as number) : DEFAULT_LNG;

  const mapHref = conf?.maps_url || UNEMI_VIEWER_URL;

  /* ========================= */

  return (
    <section className="py-20 px-4 bg-[hsl(210_40%_96%)]/40" id="ubicacion">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-[hsl(210_40%_10%)]">
            Ubicación & <span className="text-[#FF6900]">Horarios</span>
          </h2>
          <p className="text-lg md:text-xl text-[hsl(215_16%_35%)] max-w-2xl mx-auto">
            Estamos en el corazón del campus. Encuéntranos fácil y disfruta tu
            pausa con buen café.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Mapa + acciones */}
          <div className="relative">
            <div className="rounded-2xl p-6 bg-white/95 shadow-2xl border border-[#002E45]/25">
              <div className="px-1 pt-5 pb-2 text-center">
                <h3 className="text-xl font-semibold text-[hsl(210_40%_10%)]">
                  {nombre}
                </h3>
                <p className="text-sm text-[hsl(215_16%_35%)]">{direccion}</p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3">
                <a href={mapHref} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-[#002E45] text-white hover:bg-[#002E45]/90">
                    <Navigation className="w-4 h-4 mr-2" />
                    Ver en mapa
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-6">
            {/* Horarios */}
            <Card className="bg-white/95 border border-[#002E45]/25 shadow-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-[#002E45]/10 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-[#002E45]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[hsl(210_40%_10%)]">
                    Horarios de Atención
                  </h3>
                </div>
                <div className="py-2 border-t border-b border-[#002E45]/20 text-[hsl(210_40%_10%)]">
                  {lines.length ? (
                    lines.map((line, i) => (
                      <p key={i} className="text-sm">
                        {line}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm">—</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Comodidades */}
            <Card className="bg-white/95 border border-[#002E45]/25 shadow-2xl">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-[hsl(210_40%_10%)] mb-4">
                  Comodidades
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-[#002E45]" />
                    <span className="text-sm">WiFi Gratis</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Table2 className="w-5 h-5 text-[#002E45]" />
                    <span className="text-sm">Mesas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Armchair className="w-5 h-5 text-[#002E45]" />
                    <span className="text-sm">Sillas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Microwave className="w-5 h-5 text-[#002E45]" />
                    <span className="text-sm">Microondas</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LocationSection;
