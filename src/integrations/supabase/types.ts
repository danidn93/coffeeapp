// src/integrations/supabase/types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      facturas: {
        Row: {
          correo: string | null
          created_at: string
          direccion: string | null
          id: string
          identificacion: string | null
          mesa_id: string | null
          nombres: string | null
          pedido_id: string | null
          requiere_factura: boolean
          telefono: string | null
          state: string
        }
        Insert: {
          correo?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          identificacion?: string | null
          mesa_id?: string | null
          nombres?: string | null
          pedido_id?: string | null
          requiere_factura?: boolean
          telefono?: string | null
          state: string
        }
        Update: {
          correo?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          identificacion?: string | null
          mesa_id?: string | null
          nombres?: string | null
          pedido_id?: string | null
          requiere_factura?: boolean
          telefono?: string | null
          state: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      // Agrega esta tabla dentro de Database.public.Tables
      configuracion: {
        Row: {
          id: string
          abierto: boolean
          nombre_local: string | null
          direccion: string | null
          telefono: string | null
          correo: string | null
          horario: string | null
          logo_url: string | null
          hero_bg_url: string | null
          updated_at: string
          maps_url?: string | null;   // 👈 nuevo
          lat?: number | null;        // opcional
          lng?: number | null;
          horario_arr?: string[] | null;
        }
        Insert: {
          id?: string
          abierto?: boolean
          nombre_local?: string | null
          direccion?: string | null
          telefono?: string | null
          correo?: string | null
          horario?: string | null
          logo_url?: string | null
          hero_bg_url?: string | null
          updated_at?: string
          maps_url?: string | null;   // 👈 nuevo
          lat?: number | null;        // opcional
          lng?: number | null;
          horario_arr?: string[] | null;
        }
        Update: {
          id?: string
          abierto?: boolean
          nombre_local?: string | null
          direccion?: string | null
          telefono?: string | null
          correo?: string | null
          horario?: string | null
          logo_url?: string | null
          hero_bg_url?: string | null
          updated_at?: string
          maps_url?: string | null;   // 👈 nuevo
          lat?: number | null;        // opcional
          lng?: number | null;
          horario_arr?: string[] | null;
        }
        Relationships: []
      },

      items: {
        Row: {
          artista: string | null
          categoria: string | null
          created_at: string
          disponible: boolean
          id: string
          nombre: string
          precio: number | null
          tipo: string
          image_url: string | null // ← NUEVO
        }
        Insert: {
          artista?: string | null
          categoria?: string | null
          created_at?: string
          disponible?: boolean
          id?: string
          nombre: string
          precio?: number | null
          tipo: string
          image_url?: string | null // ← NUEVO
        }
        Update: {
          artista?: string | null
          categoria?: string | null
          created_at?: string
          disponible?: boolean
          id?: string
          nombre?: string
          precio?: number | null
          tipo?: string
          image_url?: string | null // ← NUEVO
        }
        Relationships: []
      }
      eventos: {
        Row: {
          id: string
          titulo: string
          fecha: string         // timestamptz (ISO)
          descripcion: string | null
          image_url: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          titulo: string
          fecha: string         // ISO: new Date(...).toISOString()
          descripcion?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          titulo?: string
          fecha?: string
          descripcion?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }

      mesas: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          nombre: string
          slug: string
          token: string
          pin_hash: string | null
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre: string
          slug: string
          token: string
          pin_hash?: string | null
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre?: string
          slug?: string
          token?: string
          pin_hash?: string | null
        }
        Relationships: []
      }

      pagos: {
        Row: {
          created_at: string
          id: string
          mesa_id: string
          metodo: string | null
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          mesa_id: string
          metodo?: string | null
          total: number
        }
        Update: {
          created_at?: string
          id?: string
          mesa_id?: string
          metodo?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagos_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }

      pedido_items: {
        Row: {
          cantidad: number
          id: string
          item_id: string
          nota: string | null
          pedido_id: string
          state: string
        }
        Insert: {
          cantidad?: number
          id?: string
          item_id: string
          nota?: string | null
          pedido_id: string
          state: string
        }
        Update: {
          cantidad?: number
          id?: string
          item_id?: string
          nota?: string | null
          pedido_id?: string
          state: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }

      pedidos: {
        Row: {
          created_at: string
          estado: string
          id: string
          liquidado: boolean
          mesa_id: string
          tipo: string
          total: number
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          liquidado?: boolean
          mesa_id: string
          tipo: string
          total?: number
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          liquidado?: boolean
          mesa_id?: string
          tipo?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }

      /** -------- NUEVA: app_users -------- */
      app_users: {
        Row: {
          id: string
          email: string | null
          role: 'admin' | 'empleado' | 'staff'
          name: string | null
          phone: string | null
          username: string
          created_at: string
          updated_at: string
          password_hash: string | null
        }
        Insert: {
          id?: string
          email?: string | null
          role: 'admin' | 'empleado' | 'staff'
          name?: string | null
          phone?: string | null
          username: string
          created_at?: string
          updated_at?: string
          password_hash?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          role?: 'admin' | 'empleado' | 'staff'
          name?: string | null
          phone?: string | null
          username?: string
          created_at?: string
          updated_at?: string
          password_hash?: string | null
        }
        Relationships: []
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      cierre_diario: {
        Args: { p_fecha: string; p_tz: string },
        Returns: {
          fecha: string
          timezone: string
          canciones: { total: number; listado: { id: string; nombre: string; cantidad: number }[] }
          ingresos: { por_metodo: { metodo: string; total: number }[]; total: number }
          pedidos: {
            id: string; mesa_id: string; mesa: string;
            tipo: 'productos'|'canciones'|'mixto';
            estado: 'pendiente'|'preparando'|'entregado'|'cancelado';
            total: number; created_at: string;
            items: { item_id: string; nombre: string; tipo: 'producto'|'cancion';
                    cantidad: number; precio: number|null; subtotal: number }[]
          }[]
        }
      },
      liquidar_mesa: {
        Args: { p_mesa_id: string; p_metodo: string },
        Returns: { pago_id: string|null; total: number; pedidos_liquidados: number }[]
      },

      admin_list_users: {
        Args: Record<string, never>,
        Returns: { id: string; username: string|null; name: string|null; role: 'admin'|'empleado'|'staff';
                  email: string|null; created_at: string; updated_at: string }[]
      },

      admin_create_user: {
        Args: { p_username: string; p_display_name: string; p_role: 'admin'|'empleado'|'staff';
                p_password: string; p_email?: string|null },
        Returns: { id: string }[]
      },

      admin_update_user: {
        Args: { p_id: string; p_username?: string|null; p_display_name?: string|null;
                p_role?: 'admin'|'empleado'|'staff'|null; p_email?: string|null },
        Returns: null
      },

      admin_update_user_password: {
        Args: { p_id: string; p_password: string },
        Returns: null
      },

      admin_delete_user: {
        Args: { p_id: string },
        Returns: null
      },
      admin_login: {
        Args: { p_username: string; p_password: string };
        Returns: { id: string; username: string; name: string | null; role: 'admin' | 'empleado' | 'staff' }[];
      }
    }

    Enums: {
      [_ in never]: never
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
             DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> =
  DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
       DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
      ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R } ? R : never
      : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> =
  DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I } ? I : never
      : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> =
  DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U } ? U : never
      : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> =
  DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> =
  PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
