import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ─────────────────────────────────────────────
   CORS
───────────────────────────────────────────── */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ─────────────────────────────────────────────
   SUPABASE CLIENT (SERVICE ROLE)
───────────────────────────────────────────── */
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/* ─────────────────────────────────────────────
   VAPID (DEL PROYECTO GESTOR)
───────────────────────────────────────────── */
webpush.setVapidDetails(
  "mailto:admin@unemi.edu.ec",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

/* ─────────────────────────────────────────────
   EDGE FUNCTION
───────────────────────────────────────────── */
serve(async (req) => {
  /* 🔴 PRE-FLIGHT */
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const { user_id, title, body } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id requerido" }),
        { status: 400, headers: corsHeaders }
      );
    }

    /* ─────────────────────────────────────────────
       Obtener subscripciones del usuario
    ───────────────────────────────────────────── */
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) throw error;

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "Sin subscripciones" }),
        { status: 200, headers: corsHeaders }
      );
    }

    /* ─────────────────────────────────────────────
       Payload
    ───────────────────────────────────────────── */
    const payload = JSON.stringify({
      title: title ?? "☕ Pedido listo",
      body: body ?? "Tu pedido ya puede ser retirado",
      icon: "/icon-192.png",
    });

    /* ─────────────────────────────────────────────
       Envío de notificaciones
    ───────────────────────────────────────────── */
    await Promise.all(
      subs.map((sub) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          )
          .catch((err) => {
            // ⚠️ No romper la función por un dispositivo inválido
            console.error("Push error:", err?.message || err);
          })
      )
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(
      JSON.stringify({ error: "Error enviando push" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
