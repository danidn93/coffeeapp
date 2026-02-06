import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';

import { AuthProvider } from '@/contexts/AuthContext';

// Público
import AdminLogin from '@/pages/admin/Login';
import PublicLanding from '@/pages/PublicLanding';
import Terminos from "@/pages/Terminos";
import Privacidad from "@/pages/Privacidad";
import ClientPedidoStatus from '@/pages/ClientPedidoStatus';

// Admin pages
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminPedidos from '@/pages/admin/Pedidos';
import AdminMesas from './pages/admin/Mesas';
import ClientMesa from './pages/client/Mesa';
import AdminUsuarios from '@/pages/admin/Usuarios';
import AdminItems from '@/pages/admin/Items';
import AdminConfiguracion from '@/pages/admin/Configuracion';
import HistorialPedidos from '@/pages/admin/HistorialPedidos';
import AdminEncuestas from '@/pages/admin/Encuestas';
import AdminOnly from '@/components/AdminOnly';
import GestionDirecciones from './pages/admin/GestionDirecciones';
import GestionEmpleados from './pages/admin/GestionEmpleados';
import PedidosPWA from './pages/admin/PedidosPWA';
import AdminCalificaciones from './pages/admin/Calificaciones';
import AdminCafeterias from './pages/admin/Cafeterias';

// NUEVAS PÁGINAS VISITAS
import ClientVisitas from '@/pages/ClientVisitas';
import VisitasProductos from '@/pages/admin/VisitasProductos';
import VisitasMenuDia from '@/pages/admin/VisitasMenuDia';
import VisitasPedidos from '@/pages/admin/VisitasPedidos';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div style={{ padding: 24 }}>Cargando…</div>}>
          <Routes>
            {/* Público */}
            <Route path="/" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/m/:slug" element={<ClientMesa />} />
            <Route path="/landing" element={<PublicLanding />} />
            <Route path="/pedido/:id" element={<ClientPedidoStatus />} />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />

            {/* Enlace/QR permanente de visitas */}
            <Route path="/visitas" element={<ClientVisitas />} />

            {/* Admin con layout protegido */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="pedidos" element={<AdminPedidos />} />
              <Route path="items" element={<AdminItems />} />
              <Route path="mesas" element={<AdminMesas />} />
              <Route path="usuarios" element={<AdminUsuarios />} />
              <Route path="configuracion" element={<AdminConfiguracion />} />
              <Route path="historial" element={<HistorialPedidos />} />
              <Route
                path="encuestas"
                element={
                  <AdminOnly>
                    <AdminEncuestas />
                  </AdminOnly>
                }
              />
              <Route path="calificaciones" element={<AdminCalificaciones />} />
              <Route path="direcciones" element={<GestionDirecciones />} />
              <Route path="empleados" element={<GestionEmpleados />} />
              <Route path="pedidos-pwa" element={<PedidosPWA />} />
              <Route path="cafeterias" element={<AdminCafeterias />} />

              {/* MÓDULO VISITAS */}
              <Route
                path="visitas/productos"
                element={
                  <AdminOnly>
                    <VisitasProductos />
                  </AdminOnly>
                }
              />
              <Route
                path="visitas/menu"
                element={
                  <AdminOnly>
                    <VisitasMenuDia />
                  </AdminOnly>
                }
              />
              <Route
                path="visitas/pedidos"
                element={
                  <AdminOnly>
                    <VisitasPedidos />
                  </AdminOnly>
                }
              />
            </Route>

            {/* 404 → login */}
            <Route path="*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
