// src/pages/Index.tsx  (tu "publiclanding.tsx")
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import LocationSection from "@/components/LocationSection";
import Footer from "@/components/Footer";
import Events from "@/components/EventsSection";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import logo from "/assets/logo-admin-navidad.png";

type AlertKey = "local-cerrado" | "sala-inactiva" | "mesa-invalida";

const ALERTS: Record<AlertKey, { title: string; desc: string }> = {
  "local-cerrado": {
    title: "Cafetería cerrada",
    desc: "En este momento no estamos atendiendo. ¡Te esperamos en nuestro horario de apertura!",
  },
  "sala-inactiva": {
    title: "Sala no disponible",
    desc: "La sala está desactivada o el enlace no es válido por el momento.",
  },
  "mesa-invalida": {
    title: "Enlace incompleto",
    desc: "Faltan datos de la sala. Por favor, vuelve a escanear el código QR.",
  },
};

type ConfigRow = {
  id: string;
  abierto: boolean;
  nombre_local: string | null;
  direccion: string | null;
  horario: string | null;
  logo_url: string | null;
  hero_bg_url: string | null;
  updated_at: string | null;
  horario_arr: string[] | null;
};

const Index = () => {
  const [showEvents, setShowEvents] = useState(false);

  // ----- Modal de alerta según ?alert= -----
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const alertKey = (params.get("alert") as AlertKey | null) || null;
  const hasQueryAlert = Boolean(alertKey);

  const [openAlert, setOpenAlert] = useState<boolean>(Boolean(alertKey));
  const alertContent = useMemo(
    () => (alertKey && ALERTS[alertKey]) ? ALERTS[alertKey] : null,
    [alertKey]
  );

  // Bloquea mostrar el modal de estado si hubo ?alert= en esta carga
  const [blockStatusThisSession] = useState<boolean>(hasQueryAlert);

  // Auto-cerrar en 3 s y limpiar el query param
  useEffect(() => {
    if (!alertKey) return;
    setOpenAlert(true);
    const t = setTimeout(() => {
      setOpenAlert(false);
      const next = new URLSearchParams(location.search);
      next.delete("alert");
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
    }, 3000);
    return () => clearTimeout(t);
  }, [alertKey, location.pathname, location.search, navigate]);

  // ----- Eventos futuros -----
  const checkHasUpcoming = async () => {
    const nowIso = new Date().toISOString();
    const { count, error } = await supabase
      .from("eventos")
      .select("id", { count: "exact", head: true })
      .gte("fecha", nowIso);
    setShowEvents(!error && (count ?? 0) > 0);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await checkHasUpcoming();
    })();

    const ch = supabase
      .channel("events-home")
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos" }, () => {
        checkHasUpcoming();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  // ----- Estado de apertura desde BD (tabla configuracion) -----
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [localName, setLocalName] = useState<string>("Cafetería");
  const [horario, setHorario] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from("configuracion")
      .select("id, abierto, nombre_local, horario, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<ConfigRow>();

    if (!error && data) {
      setIsOpen(Boolean(data.abierto));
      setLocalName(data.nombre_local || "Cafetería");
      setHorario(data.horario ?? null);
    }
    setStatusLoaded(true);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await fetchConfig();
    })();

    const ch = supabase
      .channel("config-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "configuracion" },
        () => fetchConfig()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  // Modal de estado (Abierto/Cerrado) — mismo layout que el de alert
  const [openStatusModal, setOpenStatusModal] = useState(false);
  const statusTimerRef = useRef<number | null>(null);

  // Mostrar modal de estado solo si:
  // - ya cargó el estado y hay valor
  // - NO hay (ni hubo) modal de alerta en esta sesión
  // - y no está abierto el modal de alerta ahora mismo
  useEffect(() => {
    if (!statusLoaded || isOpen === null) return;
    if (blockStatusThisSession) return;
    if (openAlert) return;

    setOpenStatusModal(true);
    statusTimerRef.current = window.setTimeout(() => setOpenStatusModal(false), 3000); // 3s para igualar alert

    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    };
  }, [statusLoaded, isOpen, openAlert, blockStatusThisSession]);

  // Asegurar exclusión mutua si el usuario abre/cierra manualmente
  const handleAlertOpenChange = (open: boolean) => {
    if (open) setOpenStatusModal(false);
    setOpenAlert(open);
  };
  const handleStatusOpenChange = (open: boolean) => {
    if (open) setOpenAlert(false);
    setOpenStatusModal(open);
  };

  // Mensajes distintos para abierto/cerrado con mismo layout que alert
  const statusTitle = isOpen ? "Estamos abiertos" : "Estamos cerrados";
  const statusDesc = isOpen
    ? "En este momento estamos atendiendo. ¡Te esperamos!"
    : "En este momento no estamos atendiendo. Revisa nuestros horarios.";

  // Si quieres incluir el horario debajo (cuando exista), añadimos una segunda línea:
  const statusDescFull = horario
    ? `${statusDesc}\n${horario}`
    : statusDesc;

  return (
    <div className="unemi min-h-screen">
      <HeroSection />
      {showEvents && <Events />}
      <MenuSection />
      <LocationSection />
      <Footer />

      {/* Modal de alerta (si viene de /m/... redirigido acá) */}
      <Dialog open={openAlert} onOpenChange={handleAlertOpenChange}>
        <DialogContent className="sm:max-w-[420px] text-center">
          <div className="mx-auto mb-3">
            <img src={logo} alt="Logo" className="h-12 w-12 rounded bg-white p-1 inline-block" />
          </div>
          <h3 className="text-lg font-semibold">{alertContent?.title ?? "Aviso"}</h3>
          <p className="text-sm text-muted-foreground mt-1" style={{ whiteSpace: "pre-line" }}>
            {alertContent?.desc ?? "Por favor, intenta nuevamente en unos minutos."}
          </p>
        </DialogContent>
      </Dialog>

      {/* Modal de estado (Abierto/Cerrado) — MISMO LAYOUT QUE ALERT */}
      <Dialog open={openStatusModal} onOpenChange={handleStatusOpenChange}>
        <DialogContent className="sm:max-w-[420px] text-center">
          <div className="mx-auto mb-3">
            <img src={logo} alt="Logo" className="h-12 w-12 rounded bg-white p-1 inline-block" />
          </div>
          <h3 className="text-lg font-semibold">{statusTitle}</h3>
          <p className="text-sm text-muted-foreground mt-1" style={{ whiteSpace: "pre-line" }}>
            {statusDescFull}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
