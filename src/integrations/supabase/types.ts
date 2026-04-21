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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          rarity: Database["public"]["Enums"]["badge_rarity"]
          requirement_type: string | null
          requirement_value: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          icon: string
          id?: string
          name: string
          rarity?: Database["public"]["Enums"]["badge_rarity"]
          requirement_type?: string | null
          requirement_value?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          rarity?: Database["public"]["Enums"]["badge_rarity"]
          requirement_type?: string | null
          requirement_value?: number | null
        }
        Relationships: []
      }
      battle_votes: {
        Row: {
          battle_id: string
          created_at: string
          id: string
          voted_for: string
          voter_id: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          id?: string
          voted_for: string
          voter_id: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          id?: string
          voted_for?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_votes_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          battle_type: string
          challenger_id: string
          challenger_proof_url: string | null
          challenger_score: number
          challenger_start_xp: number
          created_at: string
          duration_days: number
          ended_at: string | null
          id: string
          opponent_id: string
          opponent_proof_url: string | null
          opponent_score: number
          opponent_start_xp: number
          started_at: string | null
          status: Database["public"]["Enums"]["battle_status"]
          winner_id: string | null
        }
        Insert: {
          battle_type?: string
          challenger_id: string
          challenger_proof_url?: string | null
          challenger_score?: number
          challenger_start_xp?: number
          created_at?: string
          duration_days?: number
          ended_at?: string | null
          id?: string
          opponent_id: string
          opponent_proof_url?: string | null
          opponent_score?: number
          opponent_start_xp?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["battle_status"]
          winner_id?: string | null
        }
        Update: {
          battle_type?: string
          challenger_id?: string
          challenger_proof_url?: string | null
          challenger_score?: number
          challenger_start_xp?: number
          created_at?: string
          duration_days?: number
          ended_at?: string | null
          id?: string
          opponent_id?: string
          opponent_proof_url?: string | null
          opponent_score?: number
          opponent_start_xp?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["battle_status"]
          winner_id?: string | null
        }
        Relationships: []
      }
      coach_nudges: {
        Row: {
          content: string
          created_at: string
          headline: string | null
          id: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          headline?: string | null
          id?: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          headline?: string | null
          id?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_moderations: {
        Row: {
          action: string
          categories: string[]
          confidence: number
          content_id: string | null
          content_type: string
          created_at: string
          id: string
          image_url: string | null
          is_safe: boolean
          model: string
          reason: string | null
          text_content: string | null
        }
        Insert: {
          action: string
          categories?: string[]
          confidence?: number
          content_id?: string | null
          content_type: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_safe: boolean
          model?: string
          reason?: string | null
          text_content?: string | null
        }
        Update: {
          action?: string
          categories?: string[]
          confidence?: number
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_safe?: boolean
          model?: string
          reason?: string | null
          text_content?: string | null
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checked_in_at: string
          cold_shower: boolean
          created_at: string
          extra_workout: boolean
          healthy_food: boolean
          hydration_liters: number
          id: string
          journal_entry: string | null
          meditation_evening: boolean
          meditation_morning: boolean
          no_phone_evening: boolean
          no_phone_morning: boolean
          proof_photo_url: string | null
          protein_intake: boolean
          reading: boolean
          sleep_hours: number
          user_id: string
          workout: boolean
          xp_earned: number
        }
        Insert: {
          checked_in_at?: string
          cold_shower?: boolean
          created_at?: string
          extra_workout?: boolean
          healthy_food?: boolean
          hydration_liters?: number
          id?: string
          journal_entry?: string | null
          meditation_evening?: boolean
          meditation_morning?: boolean
          no_phone_evening?: boolean
          no_phone_morning?: boolean
          proof_photo_url?: string | null
          protein_intake?: boolean
          reading?: boolean
          sleep_hours?: number
          user_id: string
          workout?: boolean
          xp_earned?: number
        }
        Update: {
          checked_in_at?: string
          cold_shower?: boolean
          created_at?: string
          extra_workout?: boolean
          healthy_food?: boolean
          hydration_liters?: number
          id?: string
          journal_entry?: string | null
          meditation_evening?: boolean
          meditation_morning?: boolean
          no_phone_evening?: boolean
          no_phone_morning?: boolean
          proof_photo_url?: string | null
          protein_intake?: boolean
          reading?: boolean
          sleep_hours?: number
          user_id?: string
          workout?: boolean
          xp_earned?: number
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      feed_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          comments_count: number
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          kudos_count: number
          likes_count: number
          reported: boolean
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kudos_count?: number
          likes_count?: number
          reported?: boolean
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kudos_count?: number
          likes_count?: number
          reported?: boolean
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      feed_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: []
      }
      kudos: {
        Row: {
          created_at: string
          giver_id: string
          id: string
          post_id: string
          receiver_id: string
        }
        Insert: {
          created_at?: string
          giver_id: string
          id?: string
          post_id: string
          receiver_id: string
        }
        Update: {
          created_at?: string
          giver_id?: string
          id?: string
          post_id?: string
          receiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kudos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_champions: {
        Row: {
          created_at: string
          id: string
          reward_type: string
          season_id: string
          season_points: number
          user_id: string
          username_snapshot: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reward_type?: string
          season_id: string
          season_points?: number
          user_id: string
          username_snapshot?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reward_type?: string
          season_id?: string
          season_points?: number
          user_id?: string
          username_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_champions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_season_baselines: {
        Row: {
          baseline_xp: number
          created_at: string
          id: string
          season_id: string
          user_id: string
        }
        Insert: {
          baseline_xp?: number
          created_at?: string
          id?: string
          season_id: string
          user_id: string
        }
        Update: {
          baseline_xp?: number
          created_at?: string
          id?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_season_baselines_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          name: string
          starts_at: string
          status: Database["public"]["Enums"]["leaderboard_season_status"]
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          name: string
          starts_at: string
          status?: Database["public"]["Enums"]["leaderboard_season_status"]
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["leaderboard_season_status"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          featured_badge_id: string | null
          id: string
          is_elite: boolean
          level: number
          longest_streak: number
          rank_score: number
          rank_score_updated_at: string
          referral_code: string | null
          referral_count: number
          referred_by: string | null
          status_tier: Database["public"]["Enums"]["status_tier"]
          streak: number
          trial_started_at: string
          trust_multiplier: number
          updated_at: string
          user_id: string
          username: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          featured_badge_id?: string | null
          id?: string
          is_elite?: boolean
          level?: number
          longest_streak?: number
          rank_score?: number
          rank_score_updated_at?: string
          referral_code?: string | null
          referral_count?: number
          referred_by?: string | null
          status_tier?: Database["public"]["Enums"]["status_tier"]
          streak?: number
          trial_started_at?: string
          trust_multiplier?: number
          updated_at?: string
          user_id: string
          username: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          featured_badge_id?: string | null
          id?: string
          is_elite?: boolean
          level?: number
          longest_streak?: number
          rank_score?: number
          rank_score_updated_at?: string
          referral_code?: string | null
          referral_count?: number
          referred_by?: string | null
          status_tier?: Database["public"]["Enums"]["status_tier"]
          streak?: number
          trial_started_at?: string
          trust_multiplier?: number
          updated_at?: string
          user_id?: string
          username?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_featured_badge_id_fkey"
            columns: ["featured_badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          rewarded: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          rewarded?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          rewarded?: boolean
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          reason: string
          reporter_id: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason: string
          reporter_id: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string
          reporter_id?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_briefings: {
        Row: {
          generated_at: string
          headline: string
          id: string
          key_insights: Json
          next_week_protocol: Json
          stats_snapshot: Json
          summary_md: string
          user_id: string
          viewed_at: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          generated_at?: string
          headline: string
          id?: string
          key_insights?: Json
          next_week_protocol?: Json
          stats_snapshot?: Json
          summary_md: string
          user_id: string
          viewed_at?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          generated_at?: string
          headline?: string
          id?: string
          key_insights?: Json
          next_week_protocol?: Json
          stats_snapshot?: Json
          summary_md?: string
          user_id?: string
          viewed_at?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_badge_if_earned: {
        Args: { p_badge_id: string; p_user_id: string }
        Returns: boolean
      }
      calculate_rank_score: { Args: { p_user_id: string }; Returns: number }
      ensure_active_leaderboard_season: {
        Args: never
        Returns: {
          created_at: string
          ends_at: string
          id: string
          name: string
          starts_at: string
          status: Database["public"]["Enums"]["leaderboard_season_status"]
        }
        SetofOptions: {
          from: "*"
          to: "leaderboard_seasons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_expired_leaderboard_seasons: { Args: never; Returns: undefined }
      has_active_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      respond_to_battle: {
        Args: { accept: boolean; battle_id: string }
        Returns: undefined
      }
      set_elite_status: {
        Args: { elite: boolean; target_user_id: string }
        Returns: undefined
      }
      submit_battle_proof: {
        Args: { battle_id: string; proof_url: string }
        Returns: undefined
      }
      update_all_status_tiers: { Args: never; Returns: undefined }
      update_own_profile: {
        Args: {
          clear_featured_badge?: boolean
          new_avatar_url?: string
          new_display_name?: string
          new_featured_badge_id?: string
          new_username?: string
        }
        Returns: undefined
      }
      update_status_tier: {
        Args: { target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      badge_rarity: "common" | "rare" | "epic" | "legendary"
      battle_status: "pending" | "active" | "completed" | "declined" | "voting"
      friendship_status: "pending" | "accepted" | "declined"
      leaderboard_season_status: "active" | "completed"
      status_tier:
        | "normal"
        | "rising"
        | "high_performer"
        | "elite"
        | "recruit"
        | "operator"
        | "performer"
        | "apex"
        | "legend"
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
      app_role: ["admin", "moderator", "user"],
      badge_rarity: ["common", "rare", "epic", "legendary"],
      battle_status: ["pending", "active", "completed", "declined", "voting"],
      friendship_status: ["pending", "accepted", "declined"],
      leaderboard_season_status: ["active", "completed"],
      status_tier: [
        "normal",
        "rising",
        "high_performer",
        "elite",
        "recruit",
        "operator",
        "performer",
        "apex",
        "legend",
      ],
    },
  },
} as const
