import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useRealtimeProfile() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    console.log("Setting up realtime subscriptions for profile:", profile.id);

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          console.log("Profile updated:", payload);
          queryClient.invalidateQueries({ queryKey: ["profile"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'investments',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log("Investment updated:", payload);
          queryClient.invalidateQueries({ queryKey: ["user-investments"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'withdrawals',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log("Withdrawal updated:", payload);
          queryClient.invalidateQueries({ queryKey: ["user-withdrawals"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'earnings_log',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log("Earnings updated:", payload);
          queryClient.invalidateQueries({ queryKey: ["user-investments"] });
          queryClient.invalidateQueries({ queryKey: ["profile"] });
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return () => {
      console.log("Cleaning up realtime subscriptions");
      supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient]);
}
