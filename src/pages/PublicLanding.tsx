import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import LocationSection from "@/components/LocationSection";
import Footer from "@/components/Footer";
import Events from "@/components/EventsSection";

const Index = () => {
  const [showEvents, setShowEvents] = useState(false);

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
    </div>
  );
};

export default Index;
