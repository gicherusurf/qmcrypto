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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      kyc_verifications: {
        Row: {
          id: string
          user_id: string
          document_url: string
          status: string
          admin_notes: string | null
          submitted_at: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          document_url: string
          status?: string
          admin_notes?: string | null
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          document_url?: string
          status?: string
          admin_notes?: string | null
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          admin_notes: string | null
          amount_usd: number
          created_at: string
          crypto_amount: number | null
          crypto_currency: string
          id: string
          processed_at: string | null
          proof_url: string | null
          status: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount_usd: number
          created_at?: string
          crypto_amount?: number | null
          crypto_currency: string
          id?: string
          processed_at?: string | null
          proof_url?: string | null
          status?: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount_usd?: number
          created_at?: string
          crypto_amount?: number | null
          crypto_currency?: string
          id?: string
          processed_at?: string | null
          proof_url?: string | null
          status?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          phone_number: string | null
          id: string
          referral_code: string | null
          referred_by: string | null
          total_balance: number | null
          total_earnings: number | null
          total_withdrawn: number | null
          updated_at: string | null
          user_id: string
          withdrawable_balance: number
          team_volume: number
          current_rank: string
          banned: boolean
          ban_reason: string | null
          banned_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          phone_number?: string | null
          id?: string
          referral_code?: string | null
          referred_by?: string | null
          total_balance?: number | null
          total_earnings?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id: string
          withdrawable_balance?: number
          team_volume?: number
          current_rank?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          phone_number?: string | null
          id?: string
          referral_code?: string | null
          referred_by?: string | null
          total_balance?: number | null
          total_earnings?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id?: string
          withdrawable_balance?: number
          team_volume?: number
          current_rank?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          id: string
          referrer_id: string
          referee_id: string
          deposit_id: string
          level: number
          deposit_amount: number
          commission_rate: number
          commission_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          referrer_id: string
          referee_id: string
          deposit_id: string
          level: number
          deposit_amount: number
          commission_rate: number
          commission_amount: number
          created_at?: string
        }
        Update: {
          id?: string
          referrer_id?: string
          referee_id?: string
          deposit_id?: string
          level?: number
          deposit_amount?: number
          commission_rate?: number
          commission_amount?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_share_commissions: {
        Row: {
          id: string
          referrer_id: string
          referee_id: string
          signal_take_id: string
          level: number
          profit_amount: number
          commission_rate: number
          commission_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          referrer_id: string
          referee_id: string
          signal_take_id: string
          level: number
          profit_amount: number
          commission_rate: number
          commission_amount: number
          created_at?: string
        }
        Update: {
          id?: string
          referrer_id?: string
          referee_id?: string
          signal_take_id?: string
          level?: number
          profit_amount?: number
          commission_rate?: number
          commission_amount?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profit_share_commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_share_commissions_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commissions: {
        Row: {
          commission_amount: number
          created_at: string
          id: string
          referee_id: string
          referrer_id: string
          signal_take_id: string | null
          stake_amount: number
        }
        Insert: {
          commission_amount: number
          created_at?: string
          id?: string
          referee_id: string
          referrer_id: string
          signal_take_id?: string | null
          stake_amount: number
        }
        Update: {
          commission_amount?: number
          created_at?: string
          id?: string
          referee_id?: string
          referrer_id?: string
          signal_take_id?: string | null
          stake_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_signal_take_id_fkey"
            columns: ["signal_take_id"]
            isOneToOne: false
            referencedRelation: "signal_takes"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      signal_takes: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          profit_amount: number
          signal_id: string
          stake_amount: number
          status: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          profit_amount?: number
          signal_id: string
          stake_amount: number
          status?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          profit_amount?: number
          signal_id?: string
          stake_amount?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_takes_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_takes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          closed_at: string | null
          closes_at: string
          created_at: string
          direction: string
          entry_price: number
          id: string
          message: string | null
          opens_at: string
          pair: string
          profit_percentage: number
          status: string
          stop_loss: number | null
          target_price: number
        }
        Insert: {
          closed_at?: string | null
          closes_at: string
          created_at?: string
          direction: string
          entry_price: number
          id?: string
          message?: string | null
          opens_at?: string
          pair: string
          profit_percentage?: number
          status?: string
          stop_loss?: number | null
          target_price: number
        }
        Update: {
          closed_at?: string | null
          closes_at?: string
          created_at?: string
          direction?: string
          entry_price?: number
          id?: string
          message?: string | null
          opens_at?: string
          pair?: string
          profit_percentage?: number
          status?: string
          stop_loss?: number | null
          target_price?: number
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          fee_amount: number
          id: string
          net_amount: number
          processed_at: string | null
          requested_at: string | null
          status: string | null
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          fee_amount?: number
          id?: string
          net_amount?: number
          processed_at?: string | null
          requested_at?: string | null
          status?: string | null
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          fee_amount?: number
          id?: string
          net_amount?: number
          processed_at?: string | null
          requested_at?: string | null
          status?: string | null
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_deposit: { Args: { _deposit_id: string }; Returns: undefined }
      approve_withdrawal: {
        Args: { _id: string; _notes?: string }
        Returns: undefined
      }
      complete_withdrawal: { Args: { _id: string }; Returns: undefined }
      get_user_profile_id: { Args: never; Returns: string }
      set_user_role: {
        Args: { _target_user_id: string; _role: string }
        Returns: undefined
      }
      set_user_banned: {
        Args: { _target_profile_id: string; _banned: boolean; _reason?: string }
        Returns: undefined
      }
      admin_delete_user: {
        Args: { _target_profile_id: string }
        Returns: string
      }
      franchise_get_members: {
        Args: Record<string, never>
        Returns: { id: string; full_name: string; current_rank: string; total_balance: number; total_earnings: number; total_withdrawn: number; team_volume: number; banned: boolean; created_at: string }[]
      }
      franchise_get_deposits: {
        Args: Record<string, never>
        Returns: { id: string; member_name: string; amount_usd: number; method: string; status: string; created_at: string; processed_at: string }[]
      }
      franchise_get_withdrawals: {
        Args: Record<string, never>
        Returns: { id: string; member_name: string; amount: number; net_amount: number; method: string; status: string; requested_at: string; processed_at: string }[]
      }
      franchise_get_stats: {
        Args: Record<string, never>
        Returns: { total_members: number; total_deposits: number; total_withdrawals: number; total_commissions: number; total_team_balance: number; cash_at_bank: number }[]
      }
      admin_list_franchises: {
        Args: Record<string, never>
        Returns: { profile_id: string; full_name: string; email: string }[]
      }
      admin_franchise_members: {
        Args: { _franchise_id: string }
        Returns: { id: string; full_name: string; current_rank: string; total_balance: number; total_earnings: number; total_withdrawn: number; team_volume: number; banned: boolean; created_at: string }[]
      }
      admin_franchise_deposits: {
        Args: { _franchise_id: string }
        Returns: { id: string; member_name: string; amount_usd: number; method: string; status: string; created_at: string; processed_at: string }[]
      }
      admin_franchise_withdrawals: {
        Args: { _franchise_id: string }
        Returns: { id: string; member_name: string; amount: number; net_amount: number; method: string; status: string; requested_at: string; processed_at: string }[]
      }
      admin_franchise_stats: {
        Args: { _franchise_id: string }
        Returns: { total_members: number; total_deposits: number; total_withdrawals: number; total_commissions: number; total_team_balance: number; cash_at_bank: number }[]
      }
      set_partner_float: {
        Args: { _partner_id: string; _opening_float: number }
        Returns: undefined
      }
      get_my_referral_stats: {
        Args: never
        Returns: {
          total_referrals: number
          deposited_referrals: number
          daily_signal_limit: number
          signup_bonus_earned: number
          signal_commission_earned: number
          total_referral_earnings: number
        }[]
      }
      get_my_signal_quota: {
        Args: never
        Returns: {
          daily_limit: number
          taken_today: number
          referral_count: number
          subscription_status: string
        }[]
      }
      get_my_subscription: {
        Args: never
        Returns: {
          status: string
          started_at: string
          current_period_end: string
          auto_renew: boolean
          withdrawable_balance: number
        }[]
      }
      renew_my_subscription: { Args: never; Returns: string }
      set_my_auto_renew: { Args: { _enabled: boolean }; Returns: undefined }
      get_my_kyc_status: {
        Args: never
        Returns: { status: string; admin_notes: string | null; submitted_at: string }[]
      }
      get_my_affiliate_dashboard: {
        Args: never
        Returns: {
          current_rank: string
          personal_referrals: number
          active_team_size: number
          team_volume: number
          deposit_commissions_earned: number
          profit_share_earned: number
          leadership_bonuses_earned: number
          matching_bonuses_earned: number
          total_affiliate_earnings: number
          available_balance: number
          daily_signal_limit: number
          taken_today: number
          subscription_status: string
          next_billing_date: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reject_withdrawal: {
        Args: { _id: string; _notes?: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: { _amount: number; _wallet: string }
        Returns: string
      }
      request_mpesa_deposit: {
        Args: { _amount_usd: number; _phone: string }
        Returns: string
      }
      request_mpesa_withdrawal: {
        Args: { _amount_usd: number; _phone: string }
        Returns: string
      }
      take_signal: {
        Args: { _signal_id: string; _stake: number }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator" | "franchise"
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
      app_role: ["admin", "user", "moderator", "franchise"],
    },
  },
} as const
