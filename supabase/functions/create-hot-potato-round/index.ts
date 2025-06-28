import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  subreddit: string;
  permalink: string;
  created_utc: number;
  num_comments: number;
  ups: number;
  downs: number;
  upvote_ratio: number;
}

interface RedditResponse {
  data: {
    children: Array<{
      kind: string;
      data: RedditPost;
    }>;
  };
}

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

    console.log("Creating hot potato round...");

    // Check if we already have enough active rounds
    const { data: existingRounds, error: checkError } = await supabase
      .from("hot_potato_rounds")
      .select("id")
      .eq("status", "active");

    if (checkError) {
      console.error("Error checking existing rounds:", checkError);
    } else if (existingRounds && existingRounds.length >= 5) {
      console.log(`Already have ${existingRounds.length} active rounds, skipping creation`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Maximum active rounds reached",
          active_rounds: existingRounds.length,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

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

    // Subreddits known for controversial content
    const controversialSubreddits = [
      "unpopularopinion",
      "AmItheAsshole",
      "changemyview",
      "relationship_advice",
      "confession",
      "tifu",
      "mildlyinfuriating",
      "TrueOffMyChest",
      "offmychest",
      "rant",
    ];

    // Try multiple subreddits to find controversial content
    const shuffledSubreddits = controversialSubreddits.sort(() => 0.5 - Math.random());
    let allControversialPosts: any[] = [];

    // Fetch from multiple subreddits for better variety
    for (const subreddit of shuffledSubreddits.slice(0, 3)) {
      try {
        const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/controversial?t=day&limit=25`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
          },
        });

        if (response.ok) {
          const data: RedditResponse = await response.json();
          const posts = data.data.children
            .filter((item) => item.kind === "t3")
            .map((item) => ({ ...item.data, source_subreddit: subreddit }));
          allControversialPosts.push(...posts);
          console.log(`Found ${posts.length} posts from r/${subreddit}`);
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    if (allControversialPosts.length === 0) {
      throw new Error("No posts found from any subreddit");
    }

    // Filter for potentially controversial posts
    const controversialPosts = allControversialPosts
      .filter((post) => {
        // Look for signs of controversy:
        // - Low upvote ratio (lots of downvotes)
        // - High comment to upvote ratio (heated discussion)
        // - Recent posts (more likely to be deleted)
        const hoursOld = (Date.now() / 1000 - post.created_utc) / 3600;
        const commentToUpvoteRatio = post.num_comments / Math.max(post.score, 1);
        
        return (
          !post.title.includes("[deleted]") &&
          !post.title.includes("[removed]") &&
          post.title.length > 20 && // Substantial titles
          post.title.length < 300 && // Not too long
          post.upvote_ratio < 0.8 && // Controversial (lots of downvotes)
          post.num_comments > 15 && // Active discussion
          hoursOld < 24 && // Recent (within 24 hours)
          commentToUpvoteRatio > 0.5 && // High engagement relative to score
          post.score > 5 // Some minimum visibility
        );
      })
      .sort((a, b) => {
        // Sort by controversy score (lower upvote ratio + higher comment ratio = more controversial)
        const aControversy = (1 - a.upvote_ratio) + (a.num_comments / Math.max(a.score, 1));
        const bControversy = (1 - b.upvote_ratio) + (b.num_comments / Math.max(b.score, 1));
        return bControversy - aControversy;
      });

    if (controversialPosts.length === 0) {
      console.log("No suitable controversial posts found, trying with relaxed criteria...");
      
      // Try with more relaxed criteria
      const relaxedPosts = allControversialPosts
        .filter((post) => {
          const hoursOld = (Date.now() / 1000 - post.created_utc) / 3600;
          return (
            !post.title.includes("[deleted]") &&
            !post.title.includes("[removed]") &&
            post.title.length > 15 &&
            post.num_comments > 10 &&
            hoursOld < 48 &&
            post.score > 1
          );
        })
        .sort((a, b) => b.num_comments - a.num_comments); // Sort by comment count

      if (relaxedPosts.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No suitable posts found in any subreddit",
            searched_subreddits: shuffledSubreddits.slice(0, 3),
            total_posts_found: allControversialPosts.length,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          }
        );
      }
      
      controversialPosts.push(...relaxedPosts.slice(0, 5));
    }

    // Get previously used post IDs to avoid duplicates
    const { data: recentRounds } = await supabase
      .from("hot_potato_rounds")
      .select("post_id")
      .order("created_at", { ascending: false })
      .limit(20);

    const usedPostIds = new Set(recentRounds?.map(r => r.post_id) || []);
    
    // Filter out recently used posts
    const availablePosts = controversialPosts.filter(post => !usedPostIds.has(post.id));
    
    if (availablePosts.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No new controversial posts found (all recent posts already used)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    const selectedPost = availablePosts[0];

    // Calculate controversy score
    const controversyScore = Math.round(
      (1 - selectedPost.upvote_ratio) * 100 + 
      (selectedPost.num_comments / Math.max(selectedPost.score, 1)) * 10
    );

    // Create hot potato round
    const { data: newRound, error: createError } = await supabase
      .from("hot_potato_rounds")
      .insert({
        post_id: selectedPost.id,
        post_title: selectedPost.title,
        post_author: selectedPost.author,
        post_subreddit: selectedPost.subreddit,
        post_url: `https://reddit.com${selectedPost.permalink}`,
        controversy_score: controversyScore,
        initial_score: selectedPost.score,
        final_score: selectedPost.score,
        status: "active",
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create hot potato round: ${createError.message}`);
    }

    console.log("Hot potato round created successfully:", newRound.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Hot potato round created successfully",
        round: newRound,
        controversy_indicators: {
          upvote_ratio: selectedPost.upvote_ratio,
          subreddit: selectedPost.subreddit,
          comment_count: selectedPost.num_comments,
          controversy_score: controversyScore,
          posts_searched: allControversialPosts.length,
          posts_available: availablePosts.length,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating hot potato round:", error);
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