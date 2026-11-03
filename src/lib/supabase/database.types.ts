/**
 * Database types in the exact shape produced by `supabase gen types typescript`.
 *
 * Until a Supabase project is linked this file is maintained by hand to match
 * `supabase/migrations/`. Once linked, regenerate with `npm run db:types`
 * (which overwrites this file) and review the diff.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      consents: {
        Row: {
          created_at: string;
          granted_at: string | null;
          id: string;
          parent_email: string;
          parent_id: string | null;
          policy_version: string | null;
          status: Database["public"]["Enums"]["consent_status"];
          student_id: string;
          token_expires_at: string | null;
          token_hash: string | null;
          updated_at: string;
          withdrawn_at: string | null;
        };
        Insert: {
          created_at?: string;
          granted_at?: string | null;
          id?: string;
          parent_email: string;
          parent_id?: string | null;
          policy_version?: string | null;
          status?: Database["public"]["Enums"]["consent_status"];
          student_id: string;
          token_expires_at?: string | null;
          token_hash?: string | null;
          updated_at?: string;
          withdrawn_at?: string | null;
        };
        Update: {
          created_at?: string;
          granted_at?: string | null;
          id?: string;
          parent_email?: string;
          parent_id?: string | null;
          policy_version?: string | null;
          status?: Database["public"]["Enums"]["consent_status"];
          student_id?: string;
          token_expires_at?: string | null;
          token_hash?: string | null;
          updated_at?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consents_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consents_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      parent_student_links: {
        Row: {
          created_at: string;
          id: string;
          parent_id: string;
          status: Database["public"]["Enums"]["link_status"];
          student_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          parent_id: string;
          status?: Database["public"]["Enums"]["link_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          parent_id?: string;
          status?: Database["public"]["Enums"]["link_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"];
          class_level: number | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          locale: string;
          parent_email: string | null;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"];
          class_level?: number | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          locale?: string;
          parent_email?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"];
          class_level?: number | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          locale?: string;
          parent_email?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          created_at: string;
          hits: number;
          id: string;
          key: string;
          updated_at: string;
          window_start: string;
        };
        Insert: {
          created_at?: string;
          hits?: number;
          id?: string;
          key: string;
          updated_at?: string;
          window_start?: string;
        };
        Update: {
          created_at?: string;
          hits?: number;
          id?: string;
          key?: string;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_set_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"]; p_user_id: string };
        Returns: undefined;
      };
      complete_parent_profile: {
        Args: { p_full_name: string };
        Returns: undefined;
      };
      complete_student_profile: {
        Args: { p_class_level: number; p_full_name: string; p_parent_email: string };
        Returns: undefined;
      };
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: {
      account_status: "pending_profile" | "pending_consent" | "active" | "suspended";
      app_role: "student" | "parent" | "content_editor" | "admin";
      consent_status: "pending" | "granted" | "withdrawn" | "expired";
      link_status: "pending" | "active" | "revoked";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      account_status: ["pending_profile", "pending_consent", "active", "suspended"],
      app_role: ["student", "parent", "content_editor", "admin"],
      consent_status: ["pending", "granted", "withdrawn", "expired"],
      link_status: ["pending", "active", "revoked"],
    },
  },
} as const;
