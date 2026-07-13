export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      subtasks: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          title: string;
          progress: number;
          position: number;
          completed_at: string | null;
          deleted_at: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          task_id: string;
          title: string;
          progress?: number;
          position?: number;
          completed_at?: string | null;
          deleted_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subtasks"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          notes: string | null;
          category: string | null;
          priority: "Low" | "Normal" | "High" | "Urgent";
          estimate_minutes: number;
          progress: number;
          board_state: "todo" | "wip" | "done";
          start_date: string | null;
          due_at: string | null;
          reminder_at: string | null;
          repeat_rule: Json;
          archived_at: string | null;
          deleted_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title: string;
          notes?: string | null;
          category?: string | null;
          priority?: "Low" | "Normal" | "High" | "Urgent";
          estimate_minutes?: number;
          progress?: number;
          board_state?: "todo" | "wip" | "done";
          start_date?: string | null;
          due_at?: string | null;
          reminder_at?: string | null;
          repeat_rule?: Json;
          archived_at?: string | null;
          deleted_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          theme: "dark" | "light" | "system";
          deadline_threshold_days: number;
          categories: string[];
          notifications_enabled: boolean;
          default_reminder_mode: "none" | "due-time" | "30-min-before" | "day-start";
          daily_digest_enabled: boolean;
          daily_digest_time: string;
          daily_capacity_minutes: number;
          auto_backup_minutes: number;
          last_synced_at: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          theme?: "dark" | "light" | "system";
          deadline_threshold_days?: number;
          categories?: string[];
          notifications_enabled?: boolean;
          default_reminder_mode?: "none" | "due-time" | "30-min-before" | "day-start";
          daily_digest_enabled?: boolean;
          daily_digest_time?: string;
          daily_capacity_minutes?: number;
          auto_backup_minutes?: number;
          last_synced_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
