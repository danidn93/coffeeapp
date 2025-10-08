// src/components/Footer.tsx
import { useEffect, useState } from "react";
import { Instagram, Facebook, MapPin, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Config = {
  nombre_local?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
};

const Footer = () => {
  const [conf, setConf] = useState<Config | null>(null);
  const [hasEventos, setHasEventos] = useState(false);
  const [openTerminos, setOpenTerminos] = useState(false);
  const [openPrivacidad, setOpenPrivacidad] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: cfg }, { data: evs }] = await Promise.all([
        supabase.from("configuracion").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("eventos").select("id").gte("fecha", new Date().toISOString()).limit(1),
      ]);
      setConf((cfg as any) || null);
      setHasEventos(!!evs && evs.length > 0);
    })();
  }, []);

  const nombre = conf?.nombre_local || "Cafetería Bloque R";

  return (
    <>
      <footer className="bg-white/95 border-t border-[#002E45]/25">
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-3xl font-bold text-[hsl(210_40%_10%)] mb-4">{nombre}</h3>
              <p className="text-[hsl(215_16%_35%)] mb-6 max-w-md">
                Café de calidad, atención cercana y un ambiente que invita a conversar, crear y compartir.
              </p>

              <div className="flex gap-4">
                <a
                  href="#"
                  className="w-10 h-10 rounded-full grid place-items-center border border-[#002E45]/30 hover:bg-[#002E45]/6 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5 text-[#002E45]" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full grid place-items-center border border-[#002E45]/30 hover:bg-[#002E45]/6 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="w-5 h-5 text-[#002E45]" />
                </a>
              </div>
            </div>

            {/* Enlaces */}
            <div>
              <h4 className="text-lg font-semibold text-[hsl(210_40%_10%)] mb-4">Enlaces</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#menu" className="text-[hsl(215_16%_35%)] hover:text-[#FF6900]">Nuestra Carta</a>
                </li>
                {hasEventos && (
                  <li>
                    <a href="#eventos" className="text-[hsl(215_16%_35%)] hover:text-[#FF6900]">Eventos</a>
                  </li>
                )}
                <li>
                  <a href="#ubicacion" className="text-[hsl(215_16%_35%)] hover:text-[#FF6900]">Ubicación</a>
                </li>
              </ul>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="text-lg font-semibold text-[hsl(210_40%_10%)] mb-4">Contacto</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#002E45]" />
                  <span className="text-sm text-[hsl(215_16%_35%)]">
                    {conf?.direccion || "Planta Alta Bloque R, junto a sala de sesiones"}
                  </span>
                </div>
                
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-[#002E45]/25 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-[hsl(215_16%_45%)]">
              © {new Date().getFullYear()} {nombre}. Todos los derechos reservados.
            </p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <button
                onClick={() => setOpenTerminos(true)}
                className="text-sm text-[hsl(215_16%_35%)] hover:text-[#FF6900]"
              >
                Términos y Condiciones
              </button>
              <button
                onClick={() => setOpenPrivacidad(true)}
                className="text-sm text-[hsl(215_16%_35%)] hover:text-[#FF6900]"
              >
                Política de Privacidad
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal: Términos */}
      <Dialog open={openTerminos} onOpenChange={setOpenTerminos}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Términos y Condiciones</DialogTitle>
            <DialogDescription>
              Última actualización: {new Date().toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed text-[hsl(210_40%_10%)]/90">
            <p>Bienvenido a {nombre}. Al utilizar nuestro sitio y servicios aceptas estos términos.</p>
            <h4 className="font-semibold">Uso del sitio</h4>
            <p>El contenido es propiedad de {nombre}. Prohibida su reproducción sin autorización.</p>
            <h4 className="font-semibold">Responsabilidad</h4>
            <p>{nombre} no se responsabiliza por daños derivados del uso del sitio.</p>
            <h4 className="font-semibold">Cambios</h4>
            <p>Podemos actualizar estos términos en cualquier momento.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Privacidad */}
      <Dialog open={openPrivacidad} onOpenChange={setOpenPrivacidad}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Política de Privacidad</DialogTitle>
            <DialogDescription>
              Última actualización: {new Date().toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed text-[hsl(210_40%_10%)]/90">
            <p>Respetamos tu privacidad y protegemos tus datos.</p>
            <h4 className="font-semibold">Datos que recopilamos</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Información de contacto (si la proporcionas).</li>
              <li>Datos de uso anónimos para mejorar la experiencia.</li>
            </ul>
            <h4 className="font-semibold">Tus derechos</h4>
            <p>
              Puedes solicitar acceso, rectificación o eliminación escribiendo a{" "}
              {conf?.correo || "contacto@coffeapp.com"}.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Footer;
