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

/* =======================
 * Tipos
 * ======================= */

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

type ConfigStatusRow = {
  id: string;
  abierto: boolean;
  nombre_local: string | null;
  horario: string | null;
  updated_at: string;
};

/* =======================
 * Componente
 * ======================= */

const Index = () => {
  /* -----------------------
   * Query params
   * ----------------------- */
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);

  const cafeteriaId = params.get("c"); // ← ESTE ES EL ID DE CONFIGURACION
  const alertKey = (params.get("alert") as AlertKey | null) ?? null;
  const hasQueryAlert = Boolean(alertKey);

  /* -----------------------
   * Alert modal
   * ----------------------- */
  const [openAlert, setOpenAlert] = useState(hasQueryAlert);

  const alertContent = useMemo(
    () => (alertKey ? ALERTS[alertKey] : null),
    [alertKey]
  );

  const [blockStatusThisSession] = useState(hasQueryAlert);

  useEffect(() => {
    if (!alertKey) return;

    const t = setTimeout(() => {
      setOpenAlert(false);
      const next = new URLSearchParams(location.search);
      next.delete("alert");
      navigate(
        { pathname: location.pathname, search: next.toString() },
        { replace: true }
      );
    }, 3000);

    return () => clearTimeout(t);
  }, [alertKey, location.pathname, location.search, navigate]);

  /* -----------------------
   * Eventos futuros
   * ----------------------- */
  const [showEvents, setShowEvents] = useState(false);

  const checkHasUpcoming = async () => {
    const nowIso = new Date().toISOString();

    let q = supabase
      .from("eventos")
      .select("id", { count: "exact", head: true })
      .gte("fecha", nowIso);

    // ⚠️ filtrar por cafetería si existe
    if (cafeteriaId) {
      q = q.eq("cafeteria_id", cafeteriaId);
    }

    const { count, error } = await q;
    setShowEvents(!error && (count ?? 0) > 0);
  };

  useEffect(() => {
    checkHasUpcoming();

    const ch = supabase
      .channel("events-home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "eventos" },
        checkHasUpcoming
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [cafeteriaId]);

  /* -----------------------
   * Estado de apertura
   * ----------------------- */
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  const fetchConfigStatus = async () => {
    let q = supabase
      .from("configuracion")
      .select("id, abierto, nombre_local, horario, updated_at");

    if (cafeteriaId) {
      q = q.eq("id", cafeteriaId).limit(1);
    } else {
      q = q.order("updated_at", { ascending: false }).limit(1);
    }

    const { data, error } = await q.maybeSingle<ConfigStatusRow>();

    if (error || !data) {
      setStatusLoaded(true);
      return;
    }

    setIsOpen(Boolean(data.abierto));
    setHorario(data.horario ?? null);
    setStatusLoaded(true);
  };

  useEffect(() => {
    fetchConfigStatus();

    const ch = supabase
      .channel("config-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "configuracion" },
        fetchConfigStatus
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [cafeteriaId]);

  /* -----------------------
   * Modal estado abierto/cerrado
   * ----------------------- */
  const [openStatusModal, setOpenStatusModal] = useState(false);
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!statusLoaded || isOpen === null) return;
    if (blockStatusThisSession) return;
    if (openAlert) return;

    setOpenStatusModal(true);
    statusTimerRef.current = window.setTimeout(
      () => setOpenStatusModal(false),
      3000
    );

    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    };
  }, [statusLoaded, isOpen, openAlert, blockStatusThisSession]);

  const statusTitle = isOpen ? "Estamos abiertos" : "Estamos cerrados";
  const statusDesc = isOpen
    ? "En este momento estamos atendiendo. ¡Te esperamos!"
    : "En este momento no estamos atendiendo. Revisa nuestros horarios.";

  const statusDescFull = horario
    ? `${statusDesc}\n${horario}`
    : statusDesc;

  /* -----------------------
   * Render
   * ----------------------- */
  return (
    <div className="unemi min-h-screen">
      <HeroSection cafeteriaId={cafeteriaId} />

      {showEvents && <Events cafeteriaId={cafeteriaId} />}

      <MenuSection cafeteriaId={cafeteriaId} />
      <LocationSection cafeteriaId={cafeteriaId} />
      <Footer />

      {/* Modal alerta */}
      <Dialog open={openAlert} onOpenChange={setOpenAlert}>
        <DialogContent className="sm:max-w-[420px] text-center">
          <img
            src={logo}
            alt="Logo"
            className="h-12 w-12 mx-auto mb-3 rounded bg-white p-1"
          />
          <h3 className="text-lg font-semibold">
            {alertContent?.title ?? "Aviso"}
          </h3>
          <p
            className="text-sm text-muted-foreground mt-1"
            style={{ whiteSpace: "pre-line" }}
          >
            {alertContent?.desc ??
              "Por favor, intenta nuevamente en unos minutos."}
          </p>
        </DialogContent>
      </Dialog>

      {/* Modal estado */}
      <Dialog open={openStatusModal} onOpenChange={setOpenStatusModal}>
        <DialogContent className="sm:max-w-[420px] text-center">
          <img
            src={logo}
            alt="Logo"
            className="h-12 w-12 mx-auto mb-3 rounded bg-white p-1"
          />
          <h3 className="text-lg font-semibold">{statusTitle}</h3>
          <p
            className="text-sm text-muted-foreground mt-1"
            style={{ whiteSpace: "pre-line" }}
          >
            {statusDescFull}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
