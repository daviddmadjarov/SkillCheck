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
          avatar_url: string | null;
          created_at: string;
          id: string;
          skill_level: string;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          id: string;
          skill_level?: string;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          skill_level?: string;
          username?: string;
        };
        Relationships: [];
      };
      score_submissions: {
        Row: {
          attempts: number;
          category: string;
          created_at: string;
          id: number;
          percentile: number | null;
          score: number;
          test_slug: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          category: string;
          created_at?: string;
          id?: never;
          percentile?: number | null;
          score: number;
          test_slug: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          category?: string;
          created_at?: string;
          id?: never;
          percentile?: number | null;
          score?: number;
          test_slug?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'score_submissions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      multiplayer_lobbies: {
        Row: {
          code: string;
          created_at: string;
          current_game_index: number;
          game_order: string[];
          host_id: string;
          id: string;
          max_players: number;
          mode: 'duel' | 'party';
          selected_games: string[];
          status: 'lobby' | 'live' | 'finished';
          updated_at: string;
          winner_user_id: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          current_game_index?: number;
          game_order?: string[];
          host_id: string;
          id?: string;
          max_players?: number;
          mode: 'duel' | 'party';
          selected_games?: string[];
          status?: 'lobby' | 'live' | 'finished';
          updated_at?: string;
          winner_user_id?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          current_game_index?: number;
          game_order?: string[];
          host_id?: string;
          id?: string;
          max_players?: number;
          mode?: 'duel' | 'party';
          selected_games?: string[];
          status?: 'lobby' | 'live' | 'finished';
          updated_at?: string;
          winner_user_id?: string | null;
        };
        Relationships: [];
      };
      multiplayer_lobby_players: {
        Row: {
          display_name: string;
          id: string;
          is_ready: boolean;
          joined_at: string;
          last_seen_at: string;
          lobby_id: string;
          score_total: number;
          seat_index: number | null;
          user_id: string;
        };
        Insert: {
          display_name: string;
          id?: string;
          is_ready?: boolean;
          joined_at?: string;
          last_seen_at?: string;
          lobby_id: string;
          score_total?: number;
          seat_index?: number | null;
          user_id: string;
        };
        Update: {
          display_name?: string;
          id?: string;
          is_ready?: boolean;
          joined_at?: string;
          last_seen_at?: string;
          lobby_id?: string;
          score_total?: number;
          seat_index?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'multiplayer_lobby_players_lobby_id_fkey';
            columns: ['lobby_id'];
            isOneToOne: false;
            referencedRelation: 'multiplayer_lobbies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'multiplayer_lobby_players_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      multiplayer_queue: {
        Row: {
          id: string;
          matched_code: string | null;
          queue_type: 'duel';
          requested_at: string;
          status: 'waiting' | 'matched' | 'cancelled';
          user_id: string;
        };
        Insert: {
          id?: string;
          matched_code?: string | null;
          queue_type?: 'duel';
          requested_at?: string;
          status?: 'waiting' | 'matched' | 'cancelled';
          user_id: string;
        };
        Update: {
          id?: string;
          matched_code?: string | null;
          queue_type?: 'duel';
          requested_at?: string;
          status?: 'waiting' | 'matched' | 'cancelled';
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'multiplayer_queue_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      multiplayer_game_results: {
        Row: {
          game_slug: string;
          id: string;
          lobby_code: string;
          player_id: string | null;
          position: number | null;
          score: number;
          submitted_at: string;
          user_id: string;
        };
        Insert: {
          game_slug: string;
          id?: string;
          lobby_code: string;
          player_id?: string | null;
          position?: number | null;
          score: number;
          submitted_at?: string;
          user_id: string;
        };
        Update: {
          game_slug?: string;
          id?: string;
          lobby_code?: string;
          player_id?: string | null;
          position?: number | null;
          score?: number;
          submitted_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'multiplayer_game_results_lobby_code_fkey';
            columns: ['lobby_code'];
            isOneToOne: false;
            referencedRelation: 'multiplayer_lobbies';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'multiplayer_game_results_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      leaderboard_profiles: {
        Row: {
          avatar_url: string | null;
          overall_score: number | null;
          rank: number | null;
          tests_completed: number | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};