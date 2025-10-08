// supabase/functions/send-invoice-email/index.ts
// Enviar correo con Resend cuando una factura se marca como emitida

import "jsr:@supabase/functions-js/edge-runtime/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // o tu dominio específico
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Facturación <facturas@tudominio.com>";

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      to,             // string - correo del cliente
      nombre,         // string - nombre/razón social
      identificacion, // string opcional
      telefono,       // string opcional
      direccion,      // string opcional
      total,          // number opcional
      mesa,           // string opcional (nombre mesa)
      pedidoId,       // string opcional
    } = body ?? {};

    if (!to || !nombre) {
      return new Response(JSON.stringify({ error: "to y nombre son requeridos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const currencyCO = (n: number) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      }).format(n);

    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.5;">
        <h2>Factura emitida</h2>
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Tu solicitud de factura ha sido procesada correctamente.</p>
        <table style="margin-top:12px; border-collapse:collapse;">
          ${mesa ? `<tr><td style="padding:4px 8px;"><b>Mesa:</b></td><td style="padding:4px 8px;">${mesa}</td></tr>` : ""}
          ${pedidoId ? `<tr><td style="padding:4px 8px;"><b>Pedido:</b></td><td style="padding:4px 8px;">${pedidoId}</td></tr>` : ""}
          ${typeof total === "number" ? `<tr><td style="padding:4px 8px;"><b>Total:</b></td><td style="padding:4px 8px;">${currencyCO(total)}</td></tr>` : ""}
          ${identificacion ? `<tr><td style="padding:4px 8px;"><b>Identificación:</b></td><td style="padding:4px 8px;">${identificacion}</td></tr>` : ""}
          ${telefono ? `<tr><td style="padding:4px 8px;"><b>Teléfono:</b></td><td style="padding:4px 8px;">${telefono}</td></tr>` : ""}
          ${direccion ? `<tr><td style="padding:4px 8px;"><b>Dirección:</b></td><td style="padding:4px 8px;">${direccion}</td></tr>` : ""}
        </table>
        <p style="margin-top:16px;">¡Gracias por tu compra!</p>
      </div>
    `;

    // Llamada HTTP directa a Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,        // Debe ser un remitente verificado en Resend
        to,
        subject: "Comprobante de emisión de factura",
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: "Resend error", details: errText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const json = await res.json();
    return new Response(JSON.stringify({ ok: true, resend: json }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
