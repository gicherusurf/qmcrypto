import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maps display pair -> CoinGecko id, for the signal rotation's price ticker.
const COINS: Record<string, string> = {
  "BTC/USDT": "bitcoin",
  "ETH/USDT": "ethereum",
  "SOL/USDT": "solana",
  "XRP/USDT": "ripple",
  "BNB/USDT": "binancecoin",
  "DOGE/USDT": "dogecoin",
};

const FALLBACK_PRICES: Record<string, number> = {
  "BTC/USDT": 95000,
  "ETH/USDT": 3500,
  "SOL/USDT": 220,
  "XRP/USDT": 2.4,
  "BNB/USDT": 680,
  "DOGE/USDT": 0.4,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ids = Object.values(COINS).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { headers: { 'Accept': 'application/json' } },
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    const prices: Record<string, number> = {};
    for (const [pair, coinId] of Object.entries(COINS)) {
      const value = data?.[coinId]?.usd;
      prices[pair] = typeof value === "number" && value > 0 ? value : FALLBACK_PRICES[pair];
    }

    return new Response(JSON.stringify({ prices, timestamp: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Return fallback prices if the upstream API fails, so the UI ticker
    // never breaks — these are for display realism only.
    return new Response(JSON.stringify({
      prices: FALLBACK_PRICES,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
