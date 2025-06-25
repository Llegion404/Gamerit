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

  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

    const { reddit_username, xp_amount, reason, metadata } = await req.json();

    if (!reddit_username || !xp_amount || !reason) {
      return new Response(JSON.stringify({ error: "Missing required fields: reddit_username, xp_amount, reason" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Award XP using the database function
    const { data: xpResult, error: xpError } = await supabaseClient.rpc("award_xp", {
      player_reddit_username: reddit_username,
      xp_amount: xp_amount,
      reason: reason,
      metadata_json: metadata || {},
    });

    if (xpError) {
      console.error("Error awarding XP:", xpError);
      return new Response(JSON.stringify({ error: "Failed to award XP", details: xpError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for new achievements
    const { data: achievementResults, error: achievementError } = await supabaseClient.rpc("check_achievements", {
      player_reddit_username: reddit_username,
    });

    if (achievementError) {
      console.error("Error checking achievements:", achievementError);
      // Don't fail the request if achievement checking fails
    }

    const levelUpOccurred = xpResult && xpResult.length > 0 && xpResult[0].level_up;
    const newAchievements = achievementResults?.filter((a) => a.newly_completed) || [];

    return new Response(
      JSON.stringify({
        success: true,
        xp_awarded: xp_amount,
        old_level: xpResult?.[0]?.old_level,
        new_level: xpResult?.[0]?.new_level,
        total_xp: xpResult?.[0]?.total_xp,
        level_up: levelUpOccurred,
        new_achievements: newAchievements.map((a) => a.achievement_name),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in award-xp function:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
