/**
 * Database schema types.
 *
 * Mirrors supabase/migrations. Regenerate against a running stack with:
 *
 *     npm run types:generate
 *
 * Keeping this file in the repo (rather than generating it during the build)
 * means `npm run typecheck` and CI work without a database, and that a schema
 * change shows up as a reviewable diff rather than silently altering types.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          role: Database['public']['Enums']['project_role'];
          created_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          role?: Database['public']['Enums']['project_role'];
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          role?: Database['public']['Enums']['project_role'];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_members_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          status: Database['public']['Enums']['task_status'];
          priority: Database['public']['Enums']['task_priority'];
          due_date: string | null;
          assignee_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          status?: Database['public']['Enums']['task_status'];
          priority?: Database['public']['Enums']['task_priority'];
          due_date?: string | null;
          assignee_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string | null;
          status?: Database['public']['Enums']['task_status'];
          priority?: Database['public']['Enums']['task_priority'];
          due_date?: string | null;
          assignee_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          task_id: string;
          author_id: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          author_id: string;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          author_id?: string;
          message?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      schema_migrations: {
        Row: { version: string; applied_at: string };
        Insert: { version: string; applied_at?: string };
        Update: { version?: string; applied_at?: string };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      add_project_member_by_email: {
        Args: { p_project_id: string; p_email: string };
        Returns: Database['public']['Tables']['project_members']['Row'];
      };
      is_project_member: { Args: { p_project_id: string }; Returns: boolean };
      is_project_owner: { Args: { p_project_id: string }; Returns: boolean };
      can_access_task: { Args: { p_task_id: string }; Returns: boolean };
      shares_project_with: { Args: { p_user_id: string }; Returns: boolean };
    };
    Enums: {
      task_status: 'todo' | 'in_progress' | 'done';
      task_priority: 'low' | 'medium' | 'high';
      project_role: 'owner' | 'member';
    };
    CompositeTypes: Record<never, never>;
  };
};

/* ---------------------------------------------------------------------------
 * Convenience aliases so feature code never repeats the deep index chain.
 * ------------------------------------------------------------------------ */

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

export type TaskStatus = Enums<'task_status'>;
export type TaskPriority = Enums<'task_priority'>;
export type ProjectRole = Enums<'project_role'>;

export type Profile = Tables<'profiles'>;
export type Project = Tables<'projects'>;
export type ProjectMember = Tables<'project_members'>;
export type Task = Tables<'tasks'>;
export type Comment = Tables<'comments'>;
