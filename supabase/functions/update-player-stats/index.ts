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

    const { reddit_username, current_points } = await req.json();

    if (!reddit_username || current_points === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields: reddit_username, current_points" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update player tracking fields
    const { error: updateError } = await supabaseClient
      .from("players")
      .update({
        lowest_karma_chips: supabaseClient.sql`LEAST(lowest_karma_chips, ${current_points})`,
        highest_karma_chips: supabaseClient.sql`GREATEST(highest_karma_chips, ${current_points})`,
      })
      .eq("reddit_username", reddit_username);

    if (updateError) {
      console.error("Error updating player stats:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update player stats", details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Player stats updated successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-player-stats function:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
