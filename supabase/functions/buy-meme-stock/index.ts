import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BuyRequest {
  player_id: string;
  stock_id: string;
  amount_in_chips: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { player_id, stock_id, amount_in_chips }: BuyRequest = await req.json();

    // Validate input
    if (!player_id || !stock_id || !amount_in_chips || amount_in_chips <= 0) {
      return new Response(JSON.stringify({ error: "Invalid input parameters" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Start a transaction-like operation
    // First, fetch the stock's current value
    const { data: stock, error: stockError } = await supabase
      .from("meme_stocks")
      .select("id, meme_keyword, current_value, is_active")
      .eq("id", stock_id)
      .eq("is_active", true)
      .single();

    if (stockError || !stock) {
      return new Response(JSON.stringify({ error: "Stock not found or inactive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Calculate shares to buy
    const shares_to_buy = Math.floor(amount_in_chips / stock.current_value);

    if (shares_to_buy <= 0) {
      return new Response(JSON.stringify({ error: "Insufficient chips to buy even one share" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const actual_cost = shares_to_buy * stock.current_value;

    // Check if player has enough chips
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, points, reddit_username")
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      return new Response(JSON.stringify({ error: "Player not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (player.points < actual_cost) {
      return new Response(
        JSON.stringify({
          error: "Insufficient chips",
          required: actual_cost,
          available: player.points,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Deduct chips from player
    const { error: updatePlayerError } = await supabase
      .from("players")
      .update({ points: player.points - actual_cost })
      .eq("id", player_id);

    if (updatePlayerError) {
      throw new Error(`Failed to update player balance: ${updatePlayerError.message}`);
    }

    // Check if player already has a portfolio entry for this stock
    const { data: existingPortfolio, error: portfolioFetchError } = await supabase
      .from("player_portfolios")
      .select("*")
      .eq("player_id", player_id)
      .eq("stock_id", stock_id)
      .single();

    if (portfolioFetchError && portfolioFetchError.code !== "PGRST116") {
      // PGRST116 is "not found"
      throw new Error(`Failed to fetch portfolio: ${portfolioFetchError.message}`);
    }

    if (existingPortfolio) {
      // Update existing portfolio entry
      const total_shares = existingPortfolio.shares_owned + shares_to_buy;
      const total_investment = existingPortfolio.shares_owned * existingPortfolio.average_buy_price + actual_cost;
      const new_average_price = total_investment / total_shares;

      const { error: updatePortfolioError } = await supabase
        .from("player_portfolios")
        .update({
          shares_owned: total_shares,
          average_buy_price: new_average_price,
        })
        .eq("player_id", player_id)
        .eq("stock_id", stock_id);

      if (updatePortfolioError) {
        // Rollback player points
        await supabase.from("players").update({ points: player.points }).eq("id", player_id);

        throw new Error(`Failed to update portfolio: ${updatePortfolioError.message}`);
      }
    } else {
      // Create new portfolio entry
      const { error: insertPortfolioError } = await supabase.from("player_portfolios").insert({
        player_id,
        stock_id,
        shares_owned: shares_to_buy,
        average_buy_price: stock.current_value,
      });

      if (insertPortfolioError) {
        // Rollback player points
        await supabase.from("players").update({ points: player.points }).eq("id", player_id);

        throw new Error(`Failed to create portfolio entry: ${insertPortfolioError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Stock purchased successfully",
        transaction: {
          stock_keyword: stock.meme_keyword,
          shares_bought: shares_to_buy,
          price_per_share: stock.current_value,
          total_cost: actual_cost,
          remaining_chips: player.points - actual_cost,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error buying meme stock:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
