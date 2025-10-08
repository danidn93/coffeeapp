// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Toaster de shadcn (para useToast())
import { Toaster as ShadToaster } from "@/components/ui/toaster";
// Toaster de sonner (para import { toast } from "sonner")
import { Toaster as SonnerToaster } from "sonner";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    {/* Aparecerá abajo a la derecha (según tu toaster.tsx de shadcn) */}
    <ShadToaster />
    {/* Sonner en parte inferior (puedes cambiar a "bottom-center" si prefieres) */}
    <SonnerToaster position="bottom-right" richColors closeButton expand />
  </React.StrictMode>
);
