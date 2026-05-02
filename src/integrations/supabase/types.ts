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
      coach_athlete_profile: {
        Row: {
          age: number | null
          body_fat_pct: number | null
          busy_blocks: Json
          created_at: string
          dietary: string[]
          equipment: string[]
          height_cm: number | null
          i_am: string | null
          injuries: string[]
          language_pref: string
          no_go_protocols: string[]
          onboarded: boolean
          preferred_session_length_min: number
          primary_goal: string | null
          secondary_goal: string | null
          sex: string | null
          sleep_time: string
          target_horizon_weeks: number | null
          timezone: string
          tone_pref: string
          training_days_pref: number[]
          updated_at: string
          user_id: string
          wake_time: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          body_fat_pct?: number | null
          busy_blocks?: Json
          created_at?: string
          dietary?: string[]
          equipment?: string[]
          height_cm?: number | null
          i_am?: string | null
          injuries?: string[]
          language_pref?: string
          no_go_protocols?: string[]
          onboarded?: boolean
          preferred_session_length_min?: number
          primary_goal?: string | null
          secondary_goal?: string | null
          sex?: string | null
          sleep_time?: string
          target_horizon_weeks?: number | null
          timezone?: string
          tone_pref?: string
          training_days_pref?: number[]
          updated_at?: string
          user_id: string
          wake_time?: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          body_fat_pct?: number | null
          busy_blocks?: Json
          created_at?: string
          dietary?: string[]
          equipment?: string[]
          height_cm?: number | null
          i_am?: string | null
          injuries?: string[]
          language_pref?: string
          no_go_protocols?: string[]
          onboarded?: boolean
          preferred_session_length_min?: number
          primary_goal?: string | null
          secondary_goal?: string | null
          sex?: string | null
          sleep_time?: string
          target_horizon_weeks?: number | null
          timezone?: string
          tone_pref?: string
          training_days_pref?: number[]
          updated_at?: string
          user_id?: string
          wake_time?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      coach_chat_memory: {
        Row: {
          confidence: number
          created_at: string
          fact: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          fact: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          fact?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_daily_plans: {
        Row: {
          adjustment: string
          created_at: string
          framework_version: string
          generated_at: string
          generated_with: string
          headline: string | null
          id: string
          missions: Json
          plan_date: string
          rationale: string | null
          readiness_breakdown: Json
          readiness_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment?: string
          created_at?: string
          framework_version?: string
          generated_at?: string
          generated_with?: string
          headline?: string | null
          id?: string
          missions?: Json
          plan_date: string
          rationale?: string | null
          readiness_breakdown?: Json
          readiness_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment?: string
          created_at?: string
          framework_version?: string
          generated_at?: string
          generated_with?: string
          headline?: string | null
          id?: string
          missions?: Json
          plan_date?: string
          rationale?: string | null
          readiness_breakdown?: Json
          readiness_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_goals: {
        Row: {
          baseline_value: number | null
          created_at: string
          current_value: number | null
          deadline: string | null
          id: string
          metric: string
          status: string
          target_value: number
          title: string
          unit: string
          updated_at: string
          user_id: string
          weekly_milestone: number | null
        }
        Insert: {
          baseline_value?: number | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          id?: string
          metric: string
          status?: string
          target_value: number
          title: string
          unit?: string
          updated_at?: string
          user_id: string
          weekly_milestone?: number | null
        }
        Update: {
          baseline_value?: number | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          id?: string
          metric?: string
          status?: string
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string
          user_id?: string
          weekly_milestone?: number | null
        }
        Relationships: []
      }
      coach_mission_logs: {
        Row: {
          completed_at: string
          daily_plan_id: string
          id: string
          mission_id: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          completed_at?: string
          daily_plan_id: string
          id?: string
          mission_id: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          completed_at?: string
          daily_plan_id?: string
          id?: string
          mission_id?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_mission_logs_daily_plan_id_fkey"
            columns: ["daily_plan_id"]
            isOneToOne: false
            referencedRelation: "coach_daily_plans"
            referencedColumns: ["id"]
          },
        ]
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
      coach_preference_signals: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          protocol_id: string | null
          signal_type: string
          user_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          protocol_id?: string | null
          signal_type: string
          user_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          protocol_id?: string | null
          signal_type?: string
          user_id?: string
          value?: string | null
        }
        Relationships: []
      }
      coach_program_logs: {
        Row: {
          completed: boolean
          day_index: number
          id: string
          logged_at: string
          notes: string | null
          perceived_rpe: number | null
          program_id: string
          user_id: string
          week: number
        }
        Insert: {
          completed?: boolean
          day_index: number
          id?: string
          logged_at?: string
          notes?: string | null
          perceived_rpe?: number | null
          program_id: string
          user_id: string
          week: number
        }
        Update: {
          completed?: boolean
          day_index?: number
          id?: string
          logged_at?: string
          notes?: string | null
          perceived_rpe?: number | null
          program_id?: string
          user_id?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_program_logs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "coach_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_programs: {
        Row: {
          ai_summary: string | null
          body_focus: string[]
          constraints: string | null
          created_at: string
          days_per_week: number
          equipment: string | null
          experience: string
          generated_with: string
          goal: string
          id: string
          plan_json: Json
          started_on: string
          status: string
          updated_at: string
          user_id: string
          weeks: number
        }
        Insert: {
          ai_summary?: string | null
          body_focus?: string[]
          constraints?: string | null
          created_at?: string
          days_per_week?: number
          equipment?: string | null
          experience: string
          generated_with?: string
          goal: string
          id?: string
          plan_json: Json
          started_on?: string
          status?: string
          updated_at?: string
          user_id: string
          weeks?: number
        }
        Update: {
          ai_summary?: string | null
          body_focus?: string[]
          constraints?: string | null
          created_at?: string
          days_per_week?: number
          equipment?: string | null
          experience?: string
          generated_with?: string
          goal?: string
          id?: string
          plan_json?: Json
          started_on?: string
          status?: string
          updated_at?: string
          user_id?: string
          weeks?: number
        }
        Relationships: []
      }
      content_moderations: {
        Row: {
          action: string
          cache_hit: boolean
          categories: string[]
          confidence: number
          content_id: string | null
          content_type: string
          created_at: string
          id: string
          image_url: string | null
          is_safe: boolean
          latency_ms: number | null
          model: string
          reason: string | null
          severity: string | null
          text_content: string | null
        }
        Insert: {
          action: string
          cache_hit?: boolean
          categories?: string[]
          confidence?: number
          content_id?: string | null
          content_type: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_safe: boolean
          latency_ms?: number | null
          model?: string
          reason?: string | null
          severity?: string | null
          text_content?: string | null
        }
        Update: {
          action?: string
          cache_hit?: boolean
          categories?: string[]
          confidence?: number
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_safe?: boolean
          latency_ms?: number | null
          model?: string
          reason?: string | null
          severity?: string | null
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
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "feed_comments"
            referencedColumns: ["id"]
          },
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
      legend_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          note: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          note?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      moderation_cache: {
        Row: {
          action: string
          categories: string[]
          confidence: number
          created_at: string
          image_hash: string
          reason: string | null
          severity: string | null
        }
        Insert: {
          action: string
          categories?: string[]
          confidence?: number
          created_at?: string
          image_hash: string
          reason?: string | null
          severity?: string | null
        }
        Update: {
          action?: string
          categories?: string[]
          confidence?: number
          created_at?: string
          image_hash?: string
          reason?: string | null
          severity?: string | null
        }
        Relationships: []
      }
      moderation_queue: {
        Row: {
          ai_action: string
          ai_categories: string[]
          ai_confidence: number
          ai_reason: string | null
          content_id: string | null
          content_type: string
          created_at: string
          id: string
          image_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          status: string
          text_content: string | null
          user_id: string
        }
        Insert: {
          ai_action: string
          ai_categories?: string[]
          ai_confidence?: number
          ai_reason?: string | null
          content_id?: string | null
          content_type: string
          created_at?: string
          id?: string
          image_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string
          text_content?: string | null
          user_id: string
        }
        Update: {
          ai_action?: string
          ai_categories?: string[]
          ai_confidence?: number
          ai_reason?: string | null
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          image_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string
          text_content?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apex_credits_until: string | null
          apex_subscription_started_at: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          featured_badge_id: string | null
          id: string
          is_apex_subscriber: boolean
          is_elite: boolean
          is_premium: boolean
          last_rank_snapshot: Json | null
          legend_pinned: boolean
          level: number
          longest_streak: number
          membership_credits_until: string | null
          rank_score: number
          rank_score_updated_at: string
          referral_code: string | null
          referral_count: number
          referral_milestones_hit: Json
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
          apex_credits_until?: string | null
          apex_subscription_started_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          featured_badge_id?: string | null
          id?: string
          is_apex_subscriber?: boolean
          is_elite?: boolean
          is_premium?: boolean
          last_rank_snapshot?: Json | null
          legend_pinned?: boolean
          level?: number
          longest_streak?: number
          membership_credits_until?: string | null
          rank_score?: number
          rank_score_updated_at?: string
          referral_code?: string | null
          referral_count?: number
          referral_milestones_hit?: Json
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
          apex_credits_until?: string | null
          apex_subscription_started_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          featured_badge_id?: string | null
          id?: string
          is_apex_subscriber?: boolean
          is_elite?: boolean
          is_premium?: boolean
          last_rank_snapshot?: Json | null
          legend_pinned?: boolean
          level?: number
          longest_streak?: number
          membership_credits_until?: string | null
          rank_score?: number
          rank_score_updated_at?: string
          referral_code?: string | null
          referral_count?: number
          referral_milestones_hit?: Json
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
          converted: boolean
          converted_at: string | null
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          rewarded: boolean
        }
        Insert: {
          converted?: boolean
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          rewarded?: boolean
        }
        Update: {
          converted?: boolean
          converted_at?: string | null
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
      tribe_battles: {
        Row: {
          challenger_owner_id: string
          challenger_score: number
          challenger_tribe_id: string
          created_at: string
          duration_days: number
          ended_at: string | null
          id: string
          opponent_owner_id: string
          opponent_score: number
          opponent_tribe_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["tribe_battle_status"]
          winner_tribe_id: string | null
        }
        Insert: {
          challenger_owner_id: string
          challenger_score?: number
          challenger_tribe_id: string
          created_at?: string
          duration_days?: number
          ended_at?: string | null
          id?: string
          opponent_owner_id: string
          opponent_score?: number
          opponent_tribe_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["tribe_battle_status"]
          winner_tribe_id?: string | null
        }
        Update: {
          challenger_owner_id?: string
          challenger_score?: number
          challenger_tribe_id?: string
          created_at?: string
          duration_days?: number
          ended_at?: string | null
          id?: string
          opponent_owner_id?: string
          opponent_score?: number
          opponent_tribe_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["tribe_battle_status"]
          winner_tribe_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tribe_battles_challenger_tribe_id_fkey"
            columns: ["challenger_tribe_id"]
            isOneToOne: false
            referencedRelation: "tribes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tribe_battles_opponent_tribe_id_fkey"
            columns: ["opponent_tribe_id"]
            isOneToOne: false
            referencedRelation: "tribes"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_invites: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string
          tribe_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
          tribe_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
          tribe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tribe_invites_tribe_id_fkey"
            columns: ["tribe_id"]
            isOneToOne: false
            referencedRelation: "tribes"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          status: string
          tribe_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          status?: string
          tribe_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          status?: string
          tribe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tribe_members_tribe_id_fkey"
            columns: ["tribe_id"]
            isOneToOne: false
            referencedRelation: "tribes"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tribe_post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tribe_post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tribe_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tribe_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_post_kudos: {
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
            foreignKeyName: "tribe_post_kudos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tribe_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tribe_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tribe_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_post_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reporter_id: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          reporter_id: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tribe_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tribe_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_posts: {
        Row: {
          comments_count: number
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          kudos_count: number
          likes_count: number
          reported: boolean
          tribe_id: string
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
          tribe_id: string
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
          tribe_id?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tribe_posts_tribe_id_fkey"
            columns: ["tribe_id"]
            isOneToOne: false
            referencedRelation: "tribes"
            referencedColumns: ["id"]
          },
        ]
      }
      tribes: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_paused: boolean
          member_count: number
          name: string
          owner_id: string
          paused_at: string | null
          paused_reason: string | null
          slug: string
          updated_at: string
          visibility: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_paused?: boolean
          member_count?: number
          name: string
          owner_id: string
          paused_at?: string | null
          paused_reason?: string | null
          slug: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_paused?: boolean
          member_count?: number
          name?: string
          owner_id?: string
          paused_at?: string | null
          paused_reason?: string | null
          slug?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
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
      user_habit_logs: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          logged_on: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          logged_on: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          logged_on?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "user_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      user_habits: {
        Row: {
          added_at: string
          archived_at: string | null
          best_streak: number
          created_at: string
          current_streak: number
          id: string
          last_logged_on: string | null
          level: number
          protocol_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          archived_at?: string | null
          best_streak?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_logged_on?: string | null
          level?: number
          protocol_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          archived_at?: string | null
          best_streak?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_logged_on?: string | null
          level?: number
          protocol_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      add_chat_memory: {
        Args: { _confidence?: number; _fact: string; _source?: string }
        Returns: string
      }
      add_user_habit: { Args: { _protocol_id: string }; Returns: Json }
      approve_tribe_member: {
        Args: { p_accept: boolean; p_tribe_id: string; p_user_id: string }
        Returns: undefined
      }
      auto_resolve_expired_tribe_battles: { Args: never; Returns: undefined }
      award_badge_if_earned: {
        Args: { p_badge_id: string; p_user_id: string }
        Returns: boolean
      }
      calculate_rank_score: { Args: { p_user_id: string }; Returns: number }
      can_create_tribe: { Args: { _user_id: string }; Returns: boolean }
      claim_paused_tribe: { Args: { p_tribe_id: string }; Returns: undefined }
      claim_referral: { Args: { p_referrer_code: string }; Returns: Json }
      complete_coach_mission: {
        Args: { _mission_id: string; _plan_id: string }
        Returns: Json
      }
      create_legend_invite: {
        Args: { p_code?: string; p_expires_at?: string; p_note?: string }
        Returns: Json
      }
      create_tribe: {
        Args: {
          p_cover_url?: string
          p_description?: string
          p_name: string
          p_visibility?: string
        }
        Returns: string
      }
      create_tribe_battle: {
        Args: {
          p_challenger_tribe_id: string
          p_duration_days?: number
          p_opponent_tribe_id: string
        }
        Returns: string
      }
      delete_chat_memory: { Args: { _id: string }; Returns: boolean }
      delete_tribe: { Args: { p_tribe_id: string }; Returns: undefined }
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
      get_active_coach_program: {
        Args: { _user_id: string }
        Returns: {
          ai_summary: string | null
          body_focus: string[]
          constraints: string | null
          created_at: string
          days_per_week: number
          equipment: string | null
          experience: string
          generated_with: string
          goal: string
          id: string
          plan_json: Json
          started_on: string
          status: string
          updated_at: string
          user_id: string
          weeks: number
        }[]
        SetofOptions: {
          from: "*"
          to: "coach_programs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_top_inviters: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          converted_count: number
          signup_count: number
          status_tier: Database["public"]["Enums"]["status_tier"]
          user_id: string
          username: string
        }[]
      }
      get_tribe_leaderboard: {
        Args: { p_limit?: number; p_period?: string }
        Returns: {
          cover_url: string
          member_count: number
          name: string
          rank: number
          score: number
          slug: string
          tribe_id: string
          visibility: string
        }[]
      }
      get_user_rank: {
        Args: { p_user_id: string }
        Returns: {
          has_rank: boolean
          percentile: number
          rank: number
          total_users: number
        }[]
      }
      has_active_access: { Args: { _user_id: string }; Returns: boolean }
      has_premium: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_to_tribe: {
        Args: { p_invitee_id: string; p_tribe_id: string }
        Returns: string
      }
      is_tribe_admin: {
        Args: { _tribe_id: string; _user_id: string }
        Returns: boolean
      }
      is_tribe_member: {
        Args: { _tribe_id: string; _user_id: string }
        Returns: boolean
      }
      is_tribe_owner: {
        Args: { _tribe_id: string; _user_id: string }
        Returns: boolean
      }
      is_valid_tribe_owner: { Args: { _user_id: string }; Returns: boolean }
      join_tribe: { Args: { p_tribe_id: string }; Returns: string }
      leave_tribe: { Args: { p_tribe_id: string }; Returns: undefined }
      log_habit: { Args: { _date?: string; _habit_id: string }; Returns: Json }
      log_preference_signal: {
        Args: {
          _metadata?: Json
          _protocol_id?: string
          _signal_type: string
          _value?: string
        }
        Returns: string
      }
      redeem_legend_invite: { Args: { p_code: string }; Returns: Json }
      remove_tribe_member: {
        Args: { p_tribe_id: string; p_user_id: string }
        Returns: undefined
      }
      resolve_tribe_battle: {
        Args: { p_battle_id: string }
        Returns: undefined
      }
      respond_to_battle: {
        Args: { accept: boolean; battle_id: string }
        Returns: undefined
      }
      respond_to_tribe_battle: {
        Args: { p_accept: boolean; p_battle_id: string }
        Returns: undefined
      }
      respond_to_tribe_invite: {
        Args: { p_accept: boolean; p_invite_id: string }
        Returns: undefined
      }
      revoke_tribe_invite: { Args: { p_invite_id: string }; Returns: undefined }
      reward_referral_conversion: { Args: { p_user: string }; Returns: Json }
      search_tribes: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          cover_url: string
          description: string
          id: string
          member_count: number
          name: string
          owner_id: string
          slug: string
          viewer_status: string
          visibility: string
        }[]
      }
      set_elite_status: {
        Args: { elite: boolean; target_user_id: string }
        Returns: undefined
      }
      set_tribe_member_role: {
        Args: { p_role: string; p_tribe_id: string; p_user_id: string }
        Returns: undefined
      }
      submit_battle_proof: {
        Args: { battle_id: string; proof_url: string }
        Returns: undefined
      }
      sync_tribe_pause_state: { Args: never; Returns: undefined }
      update_all_status_tiers: { Args: never; Returns: undefined }
      update_goal_progress: {
        Args: { _goal_id: string; _new_value: number }
        Returns: {
          baseline_value: number | null
          created_at: string
          current_value: number | null
          deadline: string | null
          id: string
          metric: string
          status: string
          target_value: number
          title: string
          unit: string
          updated_at: string
          user_id: string
          weekly_milestone: number | null
        }
        SetofOptions: {
          from: "*"
          to: "coach_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      update_tribe: {
        Args: {
          p_clear_cover?: boolean
          p_cover_url?: string
          p_description?: string
          p_name?: string
          p_tribe_id: string
          p_visibility?: string
        }
        Returns: undefined
      }
      upsert_athlete_profile: {
        Args: { _patch: Json }
        Returns: {
          age: number | null
          body_fat_pct: number | null
          busy_blocks: Json
          created_at: string
          dietary: string[]
          equipment: string[]
          height_cm: number | null
          i_am: string | null
          injuries: string[]
          language_pref: string
          no_go_protocols: string[]
          onboarded: boolean
          preferred_session_length_min: number
          primary_goal: string | null
          secondary_goal: string | null
          sex: string | null
          sleep_time: string
          target_horizon_weeks: number | null
          timezone: string
          tone_pref: string
          training_days_pref: number[]
          updated_at: string
          user_id: string
          wake_time: string
          weight_kg: number | null
        }
        SetofOptions: {
          from: "*"
          to: "coach_athlete_profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_daily_plan:
        | {
            Args: {
              _adjustment: string
              _generated_with: string
              _headline: string
              _missions: Json
              _plan_date: string
              _readiness_breakdown: Json
              _readiness_score: number
            }
            Returns: string
          }
        | {
            Args: {
              _adjustment: string
              _framework_version?: string
              _generated_with: string
              _headline: string
              _missions: Json
              _plan_date: string
              _rationale?: string
              _readiness_breakdown: Json
              _readiness_score: number
            }
            Returns: string
          }
      upsert_goal: {
        Args: { _patch: Json }
        Returns: {
          baseline_value: number | null
          created_at: string
          current_value: number | null
          deadline: string | null
          id: string
          metric: string
          status: string
          target_value: number
          title: string
          unit: string
          updated_at: string
          user_id: string
          weekly_milestone: number | null
        }
        SetofOptions: {
          from: "*"
          to: "coach_goals"
          isOneToOne: true
          isSetofReturn: false
        }
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
      tribe_battle_status:
        | "pending"
        | "active"
        | "completed"
        | "declined"
        | "expired"
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
      tribe_battle_status: [
        "pending",
        "active",
        "completed",
        "declined",
        "expired",
      ],
    },
  },
} as const
