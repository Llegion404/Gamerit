import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SellRequest {
  player_id: string;
  stock_id: string;
  shares_to_sell: number;
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
    const { player_id, stock_id, shares_to_sell }: SellRequest = await req.json();

    // Validate input
    if (!player_id || !stock_id || !shares_to_sell || shares_to_sell <= 0) {
      return new Response(JSON.stringify({ error: "Invalid input parameters" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch the stock's current value
    const { data: stock, error: stockError } = await supabase
      .from("meme_stocks")
      .select("id, meme_keyword, current_value, is_active")
      .eq("id", stock_id)
      .single();

    if (stockError || !stock) {
      return new Response(JSON.stringify({ error: "Stock not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Fetch player's portfolio for this stock
    const { data: portfolio, error: portfolioError } = await supabase
      .from("player_portfolios")
      .select("*")
      .eq("player_id", player_id)
      .eq("stock_id", stock_id)
      .single();

    if (portfolioError || !portfolio) {
      return new Response(JSON.stringify({ error: "No shares found for this stock" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Check if player has enough shares
    if (portfolio.shares_owned < shares_to_sell) {
      return new Response(
        JSON.stringify({
          error: "Insufficient shares",
          requested: shares_to_sell,
          available: portfolio.shares_owned,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Calculate payout
    const payout = shares_to_sell * stock.current_value;
    const remaining_shares = portfolio.shares_owned - shares_to_sell;

    // Get player's current points
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

    // Update player's chips
    const { error: updatePlayerError } = await supabase
      .from("players")
      .update({ points: player.points + payout })
      .eq("id", player_id);

    if (updatePlayerError) {
      throw new Error(`Failed to update player balance: ${updatePlayerError.message}`);
    }

    // Update or delete portfolio entry
    if (remaining_shares > 0) {
      // Update portfolio with remaining shares
      const { error: updatePortfolioError } = await supabase
        .from("player_portfolios")
        .update({ shares_owned: remaining_shares })
        .eq("player_id", player_id)
        .eq("stock_id", stock_id);

      if (updatePortfolioError) {
        // Rollback player points
        await supabase.from("players").update({ points: player.points }).eq("id", player_id);

        throw new Error(`Failed to update portfolio: ${updatePortfolioError.message}`);
      }
    } else {
      // Delete portfolio entry if no shares remain
      const { error: deletePortfolioError } = await supabase
        .from("player_portfolios")
        .delete()
        .eq("player_id", player_id)
        .eq("stock_id", stock_id);

      if (deletePortfolioError) {
        // Rollback player points
        await supabase.from("players").update({ points: player.points }).eq("id", player_id);

        throw new Error(`Failed to delete portfolio entry: ${deletePortfolioError.message}`);
      }
    }

    // Calculate profit/loss
    const total_bought_price = shares_to_sell * portfolio.average_buy_price;
    const profit_loss = payout - total_bought_price;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Stock sold successfully",
        transaction: {
          stock_keyword: stock.meme_keyword,
          shares_sold: shares_to_sell,
          price_per_share: stock.current_value,
          total_payout: payout,
          profit_loss: profit_loss,
          remaining_shares: remaining_shares,
          new_chip_balance: player.points + payout,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error selling meme stock:", error);
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
