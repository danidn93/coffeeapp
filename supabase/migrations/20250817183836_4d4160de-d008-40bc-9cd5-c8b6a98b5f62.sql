-- Mesas
CREATE TABLE public.mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  slug text UNIQUE NOT NULL,
  token text NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Items (productos y canciones)
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text CHECK (tipo IN ('producto','cancion')) NOT NULL,
  nombre text NOT NULL,
  artista text,              -- solo para canciones
  categoria text,            -- opcional
  precio numeric(10,2),      -- opcional para productos
  disponible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pedidos (cabezera)
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id uuid NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  tipo text CHECK (tipo IN ('productos','canciones','mixto')) NOT NULL,
  estado text CHECK (estado IN ('pendiente','preparando','entregado','cancelado')) NOT NULL DEFAULT 'pendiente',
  total numeric(10,2) NOT NULL DEFAULT 0,
  liquidado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Detalle de pedido
CREATE TABLE public.pedido_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id),
  cantidad integer NOT NULL DEFAULT 1,
  nota text
);

-- Facturas (opcional por pedido o por mesa)
CREATE TABLE public.facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  mesa_id uuid REFERENCES mesas(id) ON DELETE SET NULL,
  requiere_factura boolean NOT NULL DEFAULT false,
  nombres text,
  identificacion text,   -- cédula/RUC
  telefono text,
  direccion text,
  correo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pagos (liquidación por mesa)
CREATE TABLE public.pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id uuid NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  total numeric(10,2) NOT NULL,
  metodo text, -- opcional
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para optimización
CREATE INDEX idx_pedidos_mesa_liquidado ON pedidos (mesa_id, liquidado, created_at);
CREATE INDEX idx_items_tipo_disponible ON items (tipo, disponible);
CREATE INDEX idx_mesas_slug ON mesas (slug);

-- Habilitar Row Level Security (básico - ajustar según necesidades)
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (permitir todo por ahora)
CREATE POLICY "Allow all operations" ON public.mesas FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.items FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.pedidos FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.pedido_items FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.facturas FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.pagos FOR ALL USING (true);

-- Habilitar Realtime para las tablas necesarias
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE pedido_items;
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE pagos;