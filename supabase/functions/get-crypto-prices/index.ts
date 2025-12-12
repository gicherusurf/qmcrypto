import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Fetching crypto prices from CoinGecko...");
    
    // Fetch prices from CoinGecko (free, no API key required)
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether&vs_currencies=usd",
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("CoinGecko response:", data);

    const prices = {
      BTC: data.bitcoin?.usd || 0,
      USDT: data.tether?.usd || 1, // USDT should always be ~1
      timestamp: new Date().toISOString(),
    };

    console.log("Returning prices:", prices);

    return new Response(JSON.stringify(prices), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error("Error fetching crypto prices:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Return fallback prices if API fails
    return new Response(JSON.stringify({
      BTC: 0,
      USDT: 1,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Still return 200 with fallback
    });
  }
});
