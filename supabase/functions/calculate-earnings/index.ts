import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting bi-weekly earnings calculation...');

    // Get all active investments that are due for earnings
    const now = new Date().toISOString();
    const { data: investments, error: fetchError } = await supabase
      .from('investments')
      .select(`
        id,
        user_id,
        amount,
        package_id,
        next_earning_at,
        investment_packages (
          return_percentage,
          return_period_days
        )
      `)
      .eq('status', 'active')
      .lte('next_earning_at', now);

    if (fetchError) {
      console.error('Error fetching investments:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${investments?.length || 0} investments due for earnings`);

    let processedCount = 0;
    let totalEarnings = 0;

    for (const investment of investments || []) {
      const pkgData = investment.investment_packages as unknown;
      const pkg = pkgData as { return_percentage: number; return_period_days: number } | null;
      if (!pkg) {
        console.log(`Skipping investment ${investment.id} - no package found`);
        continue;
      }

      const returnPercentage = pkg.return_percentage ?? 10;
      const returnPeriodDays = pkg.return_period_days ?? 14;
      const earningAmount = (investment.amount * returnPercentage) / 100;

      console.log(`Processing investment ${investment.id}: $${investment.amount} * ${returnPercentage}% = $${earningAmount}`);

      // Calculate next earning date
      const nextEarningAt = new Date();
      nextEarningAt.setDate(nextEarningAt.getDate() + returnPeriodDays);

      // Update investment with new earning dates
      const { error: updateInvestmentError } = await supabase
        .from('investments')
        .update({
          last_earning_at: now,
          next_earning_at: nextEarningAt.toISOString(),
        })
        .eq('id', investment.id);

      if (updateInvestmentError) {
        console.error(`Error updating investment ${investment.id}:`, updateInvestmentError);
        continue;
      }

      // Log the earning
      const { error: logError } = await supabase
        .from('earnings_log')
        .insert({
          user_id: investment.user_id,
          investment_id: investment.id,
          amount: earningAmount,
          earning_type: 'investment',
        });

      if (logError) {
        console.error(`Error logging earning for investment ${investment.id}:`, logError);
        continue;
      }

      // Update user's profile balance and earnings
      const { data: profile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('total_balance, total_earnings')
        .eq('id', investment.user_id)
        .maybeSingle();

      if (profileFetchError || !profile) {
        console.error(`Error fetching profile for user ${investment.user_id}:`, profileFetchError);
        continue;
      }

      const newBalance = (profile.total_balance || 0) + earningAmount;
      const newEarnings = (profile.total_earnings || 0) + earningAmount;

      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
          total_balance: newBalance,
          total_earnings: newEarnings,
        })
        .eq('id', investment.user_id);

      if (updateProfileError) {
        console.error(`Error updating profile for user ${investment.user_id}:`, updateProfileError);
        continue;
      }

      processedCount++;
      totalEarnings += earningAmount;
      console.log(`Successfully processed earning for investment ${investment.id}`);
    }

    const result = {
      success: true,
      processedInvestments: processedCount,
      totalEarningsDistributed: totalEarnings,
      timestamp: now,
    };

    console.log('Earnings calculation complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in calculate-earnings function:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
