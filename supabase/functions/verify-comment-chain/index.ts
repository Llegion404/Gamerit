import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper to extract comment ID from Reddit URL
function extractCommentId(url: string): string | null {
  const match = url.match(/comments\/[^/]+\/[^/]+\/([^/?#]+)/);
  return match ? match[1] : null;
}

// Reddit comment type
interface RedditComment {
  parent_id: string;
}

// Fetch Reddit comment data
async function fetchRedditComment(commentId: string): Promise<RedditComment> {
  const res = await fetch(`https://api.reddit.com/api/info/?id=t1_${commentId}`);
  if (!res.ok) throw new Error("Failed to fetch Reddit comment");
  const data = await res.json();
  const comment = data.data.children[0]?.data;
  if (!comment) throw new Error("Comment not found");
  return { parent_id: comment.parent_id };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { player_id, challenge_id, comment_url } = await req.json();
    
    if (!player_id || !challenge_id || !comment_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }), 
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const commentId = extractCommentId(comment_url);
    if (!commentId) {
      return new Response(
        JSON.stringify({ error: "Invalid Reddit comment URL" }), 
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    let chain_length = 1;
    let currentId = commentId;
    let parentId: string | null = null;

    try {
      while (true) {
        const comment = await fetchRedditComment(currentId);
        parentId = comment.parent_id;
        if (!parentId || !parentId.startsWith("t1_")) break;
        currentId = parentId.replace("t1_", "");
        chain_length++;
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Reddit API error", details: e.message }), 
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Award points
    const prize = chain_length * 100;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Update player balance
    await supabase.rpc("add_karma_chips", { player_id, amount: prize });

    // Upsert submission
    const { data: existing } = await supabase
      .from("archaeology_submissions")
      .select("id, chain_length")
      .eq("challenge_id", challenge_id)
      .eq("player_id", player_id)
      .single();

    if (existing) {
      if (chain_length > existing.chain_length) {
        await supabase
          .from("archaeology_submissions")
          .update({ chain_length, submitted_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    } else {
      await supabase.from("archaeology_submissions").insert({ challenge_id, player_id, chain_length });
    }

    return new Response(
      JSON.stringify({ chain_length, prize }), 
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in verify-comment-chain:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }), 
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});