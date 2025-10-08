// src/pages/Index.tsx  (tu "publiclanding.tsx")
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import LocationSection from "@/components/LocationSection";
import Footer from "@/components/Footer";
import Events from "@/components/EventsSection";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import logo from "/assets/logo-admin.png";

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

const Index = () => {
  const [showEvents, setShowEvents] = useState(false);

  // ----- Modal de alerta según ?alert= -----
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const alertKey = (params.get("alert") as AlertKey | null) || null;

  const [openAlert, setOpenAlert] = useState<boolean>(Boolean(alertKey));
  const alertContent = useMemo(
    () => (alertKey && ALERTS[alertKey]) ? ALERTS[alertKey] : null,
    [alertKey]
  );

  // Auto-cerrar en 2 s y limpiar el query param
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

  return (
    <div className="unemi min-h-screen">
      <HeroSection />
      {showEvents && <Events />}
      <MenuSection />
      <LocationSection />
      <Footer />

      {/* Modal de alerta (si viene de /m/... redirigido acá) */}
      <Dialog open={openAlert} onOpenChange={setOpenAlert}>
        <DialogContent className="sm:max-w-[420px] text-center">
          <div className="mx-auto mb-3">
            <img src={logo} alt="Logo" className="h-12 w-12 rounded bg-white p-1 inline-block" />
          </div>
          <h3 className="text-lg font-semibold">{alertContent?.title ?? "Aviso"}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {alertContent?.desc ?? "Por favor, intenta nuevamente en unos minutos."}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
