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
            <p>
              Este resumen fija las reglas de uso y acceso a la cafetería ubicada en la planta alta del Bloque R. 
              Su cumplimiento es obligatorio para el personal que labora en dicho Bloque.
            </p>

            <h4 className="font-semibold">1) Uso y acceso</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>El servicio de cafetería es gratuito y exclusivo para el personal que labora en el Bloque R.</li>
              <li>Se espera mantener siempre un ambiente respetuoso y agradable.</li>
            </ul>

            <h4 className="font-semibold">2) Derechos de los usuarios</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Acceder a los servicios dentro del horario establecido.</li>
              <li>Disfrutar de un espacio limpio y seguro.</li>
              <li>Recibir información clara sobre ingredientes y productos de buena calidad.</li>
              <li>Realizar comentarios o expresar insatisfacciones sobre el servicio.</li>
              <li>Recibir trato igualitario y no discriminatorio.</li>
            </ul>

            <h4 className="font-semibold">3) Prohibiciones de los usuarios</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Ingresar alimentos/bebidas personales, fumar o consumir alcohol.</li>
              <li>Usar lenguaje ofensivo, acosar o incurrir en actos de violencia.</li>
              <li>Dañar instalaciones/equipos o manipular la máquina de café/insumos.</li>
              <li>Ingresar al área interna de la cafetería o aglomerarse en ella.</li>
              <li>Traer recipientes propios (tazas, jarras, etc.) o pedir más de un café por orden.</li>
              <li>Solicitar cambios de proporciones no autorizadas ni alterar turnos de atención.</li>
              <li>Usar tomacorrientes para cargar dispositivos personales.</li>
              <li>Dejar basura en mesas o suelo; permanecer en el área tras recibir la orden.</li>
            </ul>

            <h4 className="font-semibold">4) Responsabilidades de los usuarios</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Respetar las normas, mantener orden y limpieza, y desechar residuos en los cestos.</li>
              <li>Usar el servicio solo en horarios definidos y respetar los turnos.</li>
              <li>Informar incidentes que afecten la seguridad o el bienestar.</li>
              <li>Tratar con respeto al personal y a otros usuarios.</li>
            </ul>

            <h4 className="font-semibold">5) Responsabilidades del personal</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Brindar un servicio eficiente y cortés; mantener higiene y seguridad.</li>
              <li>Atender sugerencias/quejas; informar novedades y necesidades de insumos.</li>
              <li>Realizar limpieza y mantenimiento (incluido preventivo anual) de equipos.</li>
              <li>Verificar que quien solicite el servicio pertenezca a la Institución.</li>
              <li>Servir café (expreso, americano, capuchino, mocachino) en recipientes desechables autorizados, en horarios 07h30–19h00.</li>
            </ul>

            <h4 className="font-semibold">6) Sanciones</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Amonestación verbal.</li>
              <li>Expulsión temporal (2 semanas) del servicio.</li>
              <li>Prohibición permanente en casos graves o reincidencia.</li>
              <li>Reparación o compensación económica por daños a instalaciones o equipos.</li>
            </ul>
            <p className="text-xs text-[hsl(210_20%_32%)]">
              Procedimiento: el personal informa a su jefe inmediato, quien notifica al Rectorado; en faltas económicas, Talento Humano y el área Financiera gestionan el reporte y el descuento correspondiente.
            </p>

            <div className="text-xs text-[hsl(210_20%_32%)]/90 pt-2">
              Fuente: Manual de Uso y Acceso a la Cafetería de la Universidad Estatal de Milagro (Código MAN.02, primera versión 02.08.2024).
            </div>
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
            <p>
              En {nombre} respetamos tu privacidad. Esta política describe de forma simple qué datos tratamos cuando usas nuestro sitio o haces un pedido.
            </p>

            <h4 className="font-semibold">Datos que podemos tratar</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-medium">Datos de contacto</span> que decidas compartir (p. ej., nombre para identificar tu pedido).</li>
              <li><span className="font-medium">Datos técnicos</span> no identificables (IP aproximada, navegador, métricas de uso) para seguridad y mejora del servicio.</li>
            </ul>

            <h4 className="font-semibold">Para qué usamos los datos</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gestionar y entregar tus pedidos.</li>
              <li>Mejorar la estabilidad y experiencia del sitio.</li>
              <li>Dar respuesta a solicitudes o incidencias.</li>
            </ul>

            <h4 className="font-semibold">Con quién los compartimos</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>No vendemos tus datos. Podemos usar proveedores de infraestructura (hosting/analítica) con obligaciones de confidencialidad.</li>
              <li>Podemos revelar información si la ley lo exige o para proteger la seguridad del servicio.</li>
            </ul>

            <h4 className="font-semibold">Tus opciones</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Puedes pedir acceso, rectificación o eliminación de tus datos de contacto.</li>
              <li>Si no deseas que se conserven datos opcionales, evita proporcionarlos.</li>
            </ul>

            <p>
              Para ejercer tus derechos, escríbenos a <span className="font-medium">{`${
                /* si hay correo en la config lo mostramos; si no, fallback */
                "{conf?.correo || 'contacto@coffeapp.com'}"
              }`}</span>.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Footer;
