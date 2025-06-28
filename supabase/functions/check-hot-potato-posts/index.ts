import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
    const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");

    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Reddit credentials not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking hot potato posts for deletion...");

    // Get Reddit access token
    const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`)}`,
        "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get Reddit access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get active hot potato rounds
    const { data: activeRounds, error: fetchError } = await supabase
      .from("hot_potato_rounds")
      .select("*")
      .eq("status", "active");

    if (fetchError) {
      throw new Error(`Failed to fetch active rounds: ${fetchError.message}`);
    }

    if (!activeRounds || activeRounds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active hot potato rounds to check",
          checked_rounds: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    let deletedCount = 0;
    let updatedCount = 0;

    for (const round of activeRounds) {
      try {
        // Check if post still exists
        const response = await fetch(`https://oauth.reddit.com/api/info.json?id=t3_${round.post_id}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          if (!data.data?.children || data.data.children.length === 0) {
            // Post was deleted
            await handleDeletedPost(supabase, round);
            deletedCount++;
          } else {
            // Post still exists, update score
            const postData = data.data.children[0].data;
            await supabase
              .from("hot_potato_rounds")
              .update({ final_score: postData.score })
              .eq("id", round.id);
            updatedCount++;
          }
        } else {
          // API error, assume post might be deleted
          await handleDeletedPost(supabase, round);
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error checking post ${round.post_id}:`, error);
      }
    }

    // Also resolve any expired rounds
    const { data: resolveResult } = await supabase.rpc("resolve_hot_potato_rounds");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Hot potato posts checked successfully",
        checked_rounds: activeRounds.length,
        deleted_posts: deletedCount,
        updated_posts: updatedCount,
        resolved_expired: resolveResult?.resolved_rounds || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error checking hot potato posts:", error);
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

async function handleDeletedPost(supabase: any, round: any) {
  const deletionTime = new Date();
  const hoursUntilDeletion = (deletionTime.getTime() - new Date(round.created_at).getTime()) / (1000 * 60 * 60);

  // Mark round as deleted
  await supabase
    .from("hot_potato_rounds")
    .update({
      status: "deleted",
      actual_deletion_time: deletionTime.toISOString(),
    })
    .eq("id", round.id);

  // Find winners (closest predictions to actual deletion time)
  const { data: bets } = await supabase
    .from("hot_potato_bets")
    .select("*")
    .eq("round_id", round.id);

  if (bets && bets.length > 0) {
    // Find the bet(s) closest to the actual deletion time
    let closestDifference = Infinity;
    let winnerBets: any[] = [];

    for (const bet of bets) {
      const difference = Math.abs(bet.predicted_hours - hoursUntilDeletion);
      if (difference < closestDifference) {
        closestDifference = difference;
        winnerBets = [bet];
      } else if (difference === closestDifference) {
        winnerBets.push(bet);
      }
    }

    // Calculate total pot and payout
    const totalPot = bets.reduce((sum, bet) => sum + bet.bet_amount, 0);
    const payoutPerWinner = Math.floor(totalPot / winnerBets.length);

    // Award winnings to winners
    for (const winnerBet of winnerBets) {
      await supabase
        .from("players")
        .update({
          points: supabase.sql`points + ${payoutPerWinner}`,
        })
        .eq("id", winnerBet.player_id);
    }

    console.log(`Post ${round.post_id} deleted after ${hoursUntilDeletion.toFixed(1)} hours. ${winnerBets.length} winner(s) awarded ${payoutPerWinner} chips each.`);
  }
}