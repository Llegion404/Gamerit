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

    const { reddit_username } = await req.json();

    if (!reddit_username) {
      return new Response(JSON.stringify({ error: "Missing required field: reddit_username" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check achievements using the database function
    const { data: achievementResults, error: achievementError } = await supabaseClient.rpc("check_achievements", {
      player_reddit_username: reddit_username,
    });

    if (achievementError) {
      console.error("Error checking achievements:", achievementError);
      return new Response(
        JSON.stringify({ error: "Failed to check achievements", details: achievementError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newAchievements = achievementResults?.filter((a) => a.newly_completed) || [];

    return new Response(
      JSON.stringify({
        success: true,
        new_achievements: newAchievements.map((a) => a.achievement_name),
        checked_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-achievements function:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
