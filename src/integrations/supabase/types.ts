export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          business_address: string | null
          business_email: string | null
          business_kra_pin: string | null
          business_name: string | null
          business_phone: string | null
          default_due_day: number
          id: boolean
          overdue_grace_days: number
          updated_at: string
        }
        Insert: {
          business_address?: string | null
          business_email?: string | null
          business_kra_pin?: string | null
          business_name?: string | null
          business_phone?: string | null
          default_due_day?: number
          id?: boolean
          overdue_grace_days?: number
          updated_at?: string
        }
        Update: {
          business_address?: string | null
          business_email?: string | null
          business_kra_pin?: string | null
          business_name?: string | null
          business_phone?: string | null
          default_due_day?: number
          id?: boolean
          overdue_grace_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          created_at: string
          floors: number
          id: string
          name: string
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          floors?: number
          id?: string
          name: string
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          floors?: number
          id?: string
          name?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      caretaker_properties: {
        Row: {
          assigned_by: string | null
          created_at: string
          property_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          property_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caretaker_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance: number | null
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          invoice_number: string
          lease_id: string
          notes: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          balance?: number | null
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          invoice_number: string
          lease_id: string
          notes?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          balance?: number | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          lease_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          billing_day: number
          created_at: string
          created_by: string | null
          deposit: number
          end_date: string | null
          garbage_charge: number
          id: string
          monthly_rent: number
          notes: string | null
          parking_charge: number
          qr_token: string
          service_charge: number
          start_date: string
          status: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          unit_id: string
          updated_at: string
          water_charge: number
        }
        Insert: {
          billing_day?: number
          created_at?: string
          created_by?: string | null
          deposit?: number
          end_date?: string | null
          garbage_charge?: number
          id?: string
          monthly_rent: number
          notes?: string | null
          parking_charge?: number
          qr_token?: string
          service_charge?: number
          start_date: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          unit_id: string
          updated_at?: string
          water_charge?: number
        }
        Update: {
          billing_day?: number
          created_at?: string
          created_by?: string | null
          deposit?: number
          end_date?: string | null
          garbage_charge?: number
          id?: string
          monthly_rent?: number
          notes?: string | null
          parking_charge?: number
          qr_token?: string
          service_charge?: number
          start_date?: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id?: string
          unit_id?: string
          updated_at?: string
          water_charge?: number
        }
        Relationships: [
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          completion_date: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          id: string
          notes: string | null
          priority: string
          property_id: string
          reported_by: string | null
          reported_date: string
          status: string
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          completion_date?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          priority?: string
          property_id: string
          reported_by?: string | null
          reported_date?: string
          status?: string
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          completion_date?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          priority?: string
          property_id?: string
          reported_by?: string | null
          reported_date?: string
          status?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          lease_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string
          reason: string | null
          receipt_number: string
          recorded_by: string | null
          reference: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          lease_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          reason?: string | null
          receipt_number: string
          recorded_by?: string | null
          reference?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          lease_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          reason?: string | null
          receipt_number?: string
          recorded_by?: string | null
          reference?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          city: string | null
          county: string | null
          created_at: string
          gps_lat: number | null
          gps_lng: number | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          photo_url: string | null
          theme: Database["public"]["Enums"]["property_theme"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          photo_url?: string | null
          theme?: Database["public"]["Enums"]["property_theme"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          photo_url?: string | null
          theme?: Database["public"]["Enums"]["property_theme"]
          updated_at?: string
        }
        Relationships: []
      }
      tenant_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["tenant_doc_type"]
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["tenant_doc_type"]
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["tenant_doc_type"]
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          alt_phone: string | null
          created_at: string
          created_by: string | null
          email: string | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relation: string | null
          full_name: string
          id: string
          national_id: string | null
          occupation: string | null
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alt_phone?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          full_name: string
          id?: string
          national_id?: string | null
          occupation?: string | null
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alt_phone?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          full_name?: string
          id?: string
          national_id?: string | null
          occupation?: string | null
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          block_id: string | null
          created_at: string
          deposit: number
          floor: number | null
          floor_level: Database["public"]["Enums"]["floor_level"]
          garbage_charge: number
          house_number: string
          id: string
          internal_code: string | null
          meter_electricity: string | null
          meter_water: string | null
          notes: string | null
          parking_charge: number
          property_id: string
          rent: number
          service_charge: number
          status: Database["public"]["Enums"]["unit_status"]
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
          water_charge: number
        }
        Insert: {
          block_id?: string | null
          created_at?: string
          deposit?: number
          floor?: number | null
          floor_level?: Database["public"]["Enums"]["floor_level"]
          garbage_charge?: number
          house_number: string
          id?: string
          internal_code?: string | null
          meter_electricity?: string | null
          meter_water?: string | null
          notes?: string | null
          parking_charge?: number
          property_id: string
          rent?: number
          service_charge?: number
          status?: Database["public"]["Enums"]["unit_status"]
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          water_charge?: number
        }
        Update: {
          block_id?: string | null
          created_at?: string
          deposit?: number
          floor?: number | null
          floor_level?: Database["public"]["Enums"]["floor_level"]
          garbage_charge?: number
          house_number?: string
          id?: string
          internal_code?: string | null
          meter_electricity?: string | null
          meter_water?: string | null
          notes?: string | null
          parking_charge?: number
          property_id?: string
          rent?: number
          service_charge?: number
          status?: Database["public"]["Enums"]["unit_status"]
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          water_charge?: number
        }
        Relationships: [
          {
            foreignKeyName: "units_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_property: { Args: { _pid: string }; Returns: boolean }
      current_user_has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      dedupe_current_month_invoices: { Args: never; Returns: number }
      generate_current_month_invoices: { Args: never; Returns: number }
      generate_due_invoices: { Args: never; Returns: number }
      generate_monthly_invoices: {
        Args: never
        Returns: {
          invoice_id: string
          invoice_number: string
          lease_id: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_invoice_number: { Args: never; Returns: string }
      next_receipt_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "landlord"
        | "caretaker"
        | "accountant"
        | "technician"
        | "security"
        | "tenant"
      floor_level: "ground" | "first" | "second" | "third" | "fourth" | "fifth"
      invoice_status: "unpaid" | "partial" | "paid" | "overdue" | "void"
      lease_status: "active" | "pending" | "ended" | "terminated"
      payment_method: "cash" | "cheque" | "bank_transfer" | "mpesa" | "other"
      property_theme: "default" | "orange" | "green" | "blue" | "purple"
      tenant_doc_type:
        | "national_id"
        | "kra_pin"
        | "passport"
        | "lease_contract"
        | "other"
      unit_status:
        | "vacant"
        | "occupied"
        | "reserved"
        | "maintenance"
        | "unavailable"
      unit_type:
        | "single_room"
        | "bedsitter"
        | "double_room"
        | "store"
        | "caretaker_unit"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "landlord",
        "caretaker",
        "accountant",
        "technician",
        "security",
        "tenant",
      ],
      floor_level: ["ground", "first", "second", "third", "fourth", "fifth"],
      invoice_status: ["unpaid", "partial", "paid", "overdue", "void"],
      lease_status: ["active", "pending", "ended", "terminated"],
      payment_method: ["cash", "cheque", "bank_transfer", "mpesa", "other"],
      property_theme: ["default", "orange", "green", "blue", "purple"],
      tenant_doc_type: [
        "national_id",
        "kra_pin",
        "passport",
        "lease_contract",
        "other",
      ],
      unit_status: [
        "vacant",
        "occupied",
        "reserved",
        "maintenance",
        "unavailable",
      ],
      unit_type: [
        "single_room",
        "bedsitter",
        "double_room",
        "store",
        "caretaker_unit",
      ],
    },
  },
} as const
