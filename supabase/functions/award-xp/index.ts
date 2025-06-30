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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "", 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { reddit_username, xp_amount, reason, metadata } = await req.json();

    if (!reddit_username || !xp_amount || !reason) {
      return new Response(JSON.stringify({ error: "Missing required fields: reddit_username, xp_amount, reason" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Awarding ${xp_amount} XP to ${reddit_username} for: ${reason}`);

    // First, get the player to ensure they exist
    const { data: player, error: playerError } = await supabaseClient
      .from("players")
      .select("id, xp, level, reddit_username")
      .eq("reddit_username", reddit_username)
      .single();

    if (playerError || !player) {
      console.error("Player not found:", playerError);
      return new Response(JSON.stringify({ error: "Player not found", details: playerError?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found player: ${player.reddit_username}, current XP: ${player.xp}, level: ${player.level}`);

    // Calculate new XP and level
    const oldXP = player.xp || 0;
    const newXP = oldXP + xp_amount;
    const oldLevel = player.level || 1;
    
    // Level calculation: Level 2 = 100 XP, Level 3 = 300 XP, Level 4 = 600 XP, etc.
    let newLevel = 1;
    let totalXPNeeded = 0;
    
    while (totalXPNeeded <= newXP) {
      newLevel++;
      totalXPNeeded += (newLevel - 1) * 100;
    }
    newLevel--; // Adjust back to the correct level
    
    const levelUp = newLevel > oldLevel;

    console.log(`XP calculation: ${oldXP} + ${xp_amount} = ${newXP}, level: ${oldLevel} -> ${newLevel}, levelUp: ${levelUp}`);

    // Update player XP and level in a transaction
    const { data: updatedPlayer, error: updateError } = await supabaseClient
      .from("players")
      .update({
        xp: newXP,
        level: newLevel,
      })
      .eq("id", player.id)
      .select("xp, level")
      .single();

    if (updateError) {
      console.error("Error updating player XP:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update player XP", details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Player updated successfully: XP=${updatedPlayer.xp}, Level=${updatedPlayer.level}`);

    // Record the XP transaction
    const { error: transactionError } = await supabaseClient
      .from("xp_transactions")
      .insert({
        player_id: player.id,
        amount: xp_amount,
        reason: reason,
        metadata: metadata || {},
      });

    if (transactionError) {
      console.error("Error recording XP transaction:", transactionError);
      // Don't fail the request if transaction recording fails, but log it
    }

    // Check for new achievements if level up occurred
    let newAchievements: string[] = [];
    if (levelUp) {
      try {
        const { data: achievementResults, error: achievementError } = await supabaseClient.rpc("check_achievements", {
          player_reddit_username: reddit_username,
        });

        if (achievementError) {
          console.error("Error checking achievements:", achievementError);
        } else if (achievementResults) {
          newAchievements = achievementResults
            .filter((a: any) => a.newly_completed)
            .map((a: any) => a.achievement_name);
        }
      } catch (error) {
        console.error("Achievement check failed:", error);
        // Don't fail the XP award if achievement checking fails
      }
    }

    const response = {
      success: true,
      xp_awarded: xp_amount,
      old_xp: oldXP,
      new_xp: newXP,
      old_level: oldLevel,
      new_level: newLevel,
      total_xp: newXP,
      level_up: levelUp,
      new_achievements: newAchievements,
      player_id: player.id,
    };

    console.log("XP award response:", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in award-xp function:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      details: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});