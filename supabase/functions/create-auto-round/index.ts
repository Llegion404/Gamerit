const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  subreddit: string;
  permalink: string;
  created_utc: number;
}

Deno.serve(async (req) => {
  // Add CORS headers to all responses
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers,
        }
      );
    }

    // Get environment variables
    const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
    const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          error: "Missing required environment variables",
        }),
        {
          status: 500,
          headers,
        }
      );
    }

    console.log("Starting automatic round creation...");

    // Check how many active rounds we have (maximum 10)
    const checkActiveRoundResponse = await fetch(`${SUPABASE_URL}/rest/v1/game_rounds?status=eq.active&select=id`, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
    });

    const activeRounds = await checkActiveRoundResponse.json();
    if (activeRounds && activeRounds.length >= 10) {
      console.log(`Maximum rounds reached (${activeRounds.length}/10), skipping creation`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Maximum rounds reached (${activeRounds.length}/10)`,
          activeRounds: activeRounds.length,
        }),
        {
          status: 200,
          headers,
        }
      );
    }

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

    // List of popular subreddits for variety
    const subreddits = [
      "AskReddit",
      "funny",
      "todayilearned",
      "explainlikeimfive",
      "mildlyinteresting",
      "Showerthoughts",
      "LifeProTips",
      "unpopularopinion",
      "changemyview",
      "mildlyinfuriating",
      "coolguides",
      "dataisbeautiful",
    ];

    // Randomly select 2 different subreddits
    const shuffled = subreddits.sort(() => 0.5 - Math.random());
    const selectedSubreddits = shuffled.slice(0, 2);

    console.log(`Fetching posts from r/${selectedSubreddits[0]} and r/${selectedSubreddits[1]}`);

    // Fetch posts from both subreddits
    const posts: RedditPost[] = [];

    for (const subreddit of selectedSubreddits) {
      const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/hot?limit=25`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const subredditPosts = data.data.children
          .filter(
            (item: any) =>
              item.kind === "t3" &&
              item.data.title &&
              !item.data.over_18 &&
              !item.data.stickied &&
              item.data.score >= 10 &&
              item.data.title.length > 20 &&
              item.data.title.length < 300
          )
          .map((item: any) => ({
            id: item.data.id,
            title: item.data.title,
            author: item.data.author,
            score: item.data.score,
            subreddit: item.data.subreddit,
            permalink: item.data.permalink,
            created_utc: item.data.created_utc,
          }))
          .slice(0, 10); // Take top 10 from each subreddit

        posts.push(...subredditPosts);
      }
    }

    if (posts.length < 2) {
      throw new Error("Not enough posts found to create a round");
    }

    // Sort by score and pick two good posts
    posts.sort((a, b) => b.score - a.score);
    const postA = posts[0];
    const postB = posts[1];

    console.log(`Selected posts: ${postA.id} (${postA.score} score) vs ${postB.id} (${postB.score} score)`);

    // Create the round in Supabase
    const createRoundResponse = await fetch(`${SUPABASE_URL}/rest/v1/game_rounds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "active",
        post_a_id: postA.id,
        post_a_title: postA.title,
        post_a_author: postA.author,
        post_a_subreddit: postA.subreddit,
        post_a_initial_score: postA.score,
        post_a_final_score: postA.score,
        post_b_id: postB.id,
        post_b_title: postB.title,
        post_b_author: postB.author,
        post_b_subreddit: postB.subreddit,
        post_b_initial_score: postB.score,
        post_b_final_score: postB.score,
      }),
    });

    if (!createRoundResponse.ok) {
      const errorText = await createRoundResponse.text();
      console.error("Failed to create round - Status:", createRoundResponse.status);
      console.error("Failed to create round - Error:", errorText);
      console.error("Attempted to create with data:", {
        status: "active",
        post_a_id: postA.id,
        post_a_title: postA.title.substring(0, 100) + "...",
        post_a_author: postA.author,
        post_a_subreddit: postA.subreddit,
        post_a_initial_score: postA.score,
      });
      throw new Error(`Failed to create round in database: ${errorText}`);
    }

    const newRound = await createRoundResponse.json();
    console.log("Successfully created round:", newRound[0]?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Round created successfully",
        round: newRound[0],
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (error) {
    console.error("Error in create-auto-round function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers,
      }
    );
  }
});
