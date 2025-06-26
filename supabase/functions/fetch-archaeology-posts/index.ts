import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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
  url: string;
  over_18: boolean;
  stickied: boolean;
}

interface RedditResponse {
  data: {
    children: Array<{
      kind: string;
      data: RedditPost;
    }>;
  };
}

interface ArchaeologyChallenge {
  reddit_thread_id: string;
  subreddit: string;
  thread_title: string;
  thread_url: string;
  comment_count: number;
  score: number;
  author: string;
  created_at: string;
  is_active: boolean;
}

serve(async (req) => {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers,
      });
    }

    // Environment variables
    const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
    const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing required environment variables" }), {
        status: 500,
        headers,
      });
    }

    console.log("Fetching high-engagement posts for archaeology challenges...");

    // Get Reddit access token using client credentials
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
      const errorText = await tokenResponse.text();
      console.error("Failed to get Reddit access token:", errorText);
      throw new Error("Failed to authenticate with Reddit");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Subreddits known for high-engagement discussion posts
    const discussionSubreddits = [
      "AskReddit",
      "explainlikeimfive",
      "changemyview",
      "unpopularopinion",
      "todayilearned",
      "LifeProTips",
      "YouShouldKnow",
      "NoStupidQuestions",
      "OutOfTheLoop",
      "relationship_advice",
      "AmItheAsshole",
      "confession",
      "tifu",
      "legaladvice",
    ];

    // Randomly select 3-4 subreddits for variety
    const shuffled = discussionSubreddits.sort(() => 0.5 - Math.random());
    const selectedSubreddits = shuffled.slice(0, 4);

    console.log(`Fetching posts from: ${selectedSubreddits.join(", ")}`);

    // Fetch posts with high comment counts
    const allCandidatePosts: RedditPost[] = [];

    for (const subreddit of selectedSubreddits) {
      try {
        // Fetch from hot and top to get high-engagement posts
        const endpoints = [`hot`, `top?t=week`];

        for (const endpoint of endpoints) {
          const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/${endpoint}?limit=100`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
            },
          });

          if (response.ok) {
            const data: RedditResponse = await response.json();
            const posts = data.data.children
              .filter((item) => item.kind === "t3") // Only posts, not comments
              .map((item) => item.data)
              .filter(
                (post) =>
                  post.num_comments >= 100 && // At least 100 comments
                  !post.over_18 && // Not NSFW
                  !post.stickied && // Not pinned
                  post.score >= 50 && // Decent upvotes
                  post.title.length > 30 && // Substantial title
                  post.title.length < 300 && // Not too long
                  !post.title.toLowerCase().includes("[deleted]") &&
                  !post.title.toLowerCase().includes("[removed]")
              );

            allCandidatePosts.push(...posts);
            console.log(`Found ${posts.length} high-comment posts from r/${subreddit}/${endpoint}`);
          }
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    // Remove duplicates and sort by comment count
    const uniquePosts = Array.from(new Map(allCandidatePosts.map((post) => [post.id, post])).values());

    // Sort by comment count descending, then by score
    uniquePosts.sort((a, b) => {
      if (b.num_comments !== a.num_comments) {
        return b.num_comments - a.num_comments;
      }
      return b.score - a.score;
    });

    console.log(`Total unique posts with 100+ comments: ${uniquePosts.length}`);

    // Take the top posts for archaeology challenges
    const selectedPosts = uniquePosts.slice(0, 10);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store/update archaeology challenges in database
    const challengesToUpdate: ArchaeologyChallenge[] = [];

    for (const post of selectedPosts) {
      challengesToUpdate.push({
        reddit_thread_id: post.id,
        subreddit: post.subreddit,
        thread_title: post.title,
        thread_url: `https://reddit.com${post.permalink}`,
        comment_count: post.num_comments,
        score: post.score,
        author: post.author,
        created_at: new Date(post.created_utc * 1000).toISOString(),
        is_active: true,
      });
    }

    // Insert or update challenges (upsert on reddit_thread_id)
    let insertedCount = 0;
    let updatedCount = 0;

    for (const challenge of challengesToUpdate) {
      // Check if challenge already exists
      const { data: existing } = await supabase
        .from("archaeology_challenges")
        .select("id, comment_count")
        .eq("reddit_thread_id", challenge.reddit_thread_id)
        .single();

      if (existing) {
        // Update existing challenge with new comment count
        const { error } = await supabase
          .from("archaeology_challenges")
          .update({
            comment_count: challenge.comment_count,
            score: challenge.score,
            is_active: true,
          })
          .eq("id", existing.id);

        if (!error) {
          updatedCount++;
          console.log(
            `Updated challenge ${challenge.reddit_thread_id}: ${existing.comment_count} -> ${challenge.comment_count} comments`
          );
        }
      } else {
        // Insert new challenge
        const { error } = await supabase.from("archaeology_challenges").insert(challenge);

        if (!error) {
          insertedCount++;
          console.log(`Added new challenge ${challenge.reddit_thread_id}: ${challenge.comment_count} comments`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Archaeology posts fetched and updated successfully",
        posts_found: uniquePosts.length,
        posts_with_100_plus_comments: selectedPosts.length,
        challenges_inserted: insertedCount,
        challenges_updated: updatedCount,
        selected_subreddits: selectedSubreddits,
      }),
      {
        headers,
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in fetch-archaeology-posts:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers,
        status: 500,
      }
    );
  }
});
