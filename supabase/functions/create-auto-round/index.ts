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

    // Get previously used post IDs from recent rounds (last 50 rounds to avoid reusing recent posts)
    const recentRoundsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/game_rounds?select=post_a_id,post_b_id,post_a_subreddit,post_b_subreddit&order=created_at.desc&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const recentRounds = await recentRoundsResponse.json();
    const usedPostIds = new Set<string>();
    const usedSubredditPairs = new Set<string>();
    
    if (recentRounds && Array.isArray(recentRounds)) {
      recentRounds.forEach((round: any) => {
        if (round.post_a_id) usedPostIds.add(round.post_a_id);
        if (round.post_b_id) usedPostIds.add(round.post_b_id);
        
        // Track subreddit pairs to avoid repeating the same subreddit matchups
        if (round.post_a_subreddit && round.post_b_subreddit) {
          // Store both combinations to ensure uniqueness regardless of order
          usedSubredditPairs.add(`${round.post_a_subreddit}-${round.post_b_subreddit}`);
          usedSubredditPairs.add(`${round.post_b_subreddit}-${round.post_a_subreddit}`);
        }
      });
    }

    console.log(`Found ${usedPostIds.size} previously used post IDs and ${usedSubredditPairs.size/2} subreddit pairs to avoid`);

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
      "nextfuckinglevel",
      "interestingasfuck",
      "oddlysatisfying",
    ];

    // Randomly select subreddits and fetch more posts to increase variety
    const shuffled = subreddits.sort(() => 0.5 - Math.random());
    const selectedSubreddits = shuffled.slice(0, 8); // Use more subreddits for better variety

    console.log(`Fetching posts from: ${selectedSubreddits.join(", ")}`);

    // Fetch posts from multiple subreddits and endpoints for maximum variety
    const allPosts: RedditPost[] = [];

    // Track how many posts we've fetched from each subreddit to ensure balance
    const subredditPostCounts: Record<string, number> = {};
    
    for (const subreddit of selectedSubreddits) {
      // Fetch from multiple endpoints to get more variety
      const endpoints = ["hot", "top?t=day", "top?t=week"];
      let postsFromThisSubreddit = 0;
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/${endpoint}?limit=50`, {
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
                  item.data.title.length < 300 &&
                  !usedPostIds.has(item.data.id) // Filter out previously used posts
              )
              .map((item: any) => ({
                id: item.data.id,
                title: item.data.title,
                author: item.data.author,
                score: item.data.score,
                subreddit: item.data.subreddit,
                permalink: item.data.permalink,
                created_utc: item.data.created_utc,
              }));

            allPosts.push(...subredditPosts);
            postsFromThisSubreddit += subredditPosts.length;
            subredditPostCounts[subreddit] = (subredditPostCounts[subreddit] || 0) + subredditPosts.length;
            console.log(`Found ${subredditPosts.length} unused posts from r/${subreddit}/${endpoint}, total: ${postsFromThisSubreddit}`);
            
            // Limit posts per subreddit to ensure variety
            if (postsFromThisSubreddit >= 15) {
              console.log(`Reached limit of 15 posts for r/${subreddit}, moving to next subreddit`);
              break;
            }
          }
        } catch (error) {
          console.error(`Error fetching from r/${subreddit}/${endpoint}:`, error);
        }
      }
    }

    // Remove duplicates by post ID
    const uniquePosts = Array.from(new Map(allPosts.map(post => [post.id, post])).values());
    
    // Log subreddit distribution
    console.log("Posts per subreddit:", Object.entries(subredditPostCounts)
      .map(([sub, count]) => `r/${sub}: ${count}`)
      .join(", "));
    
    console.log(`Total unique unused posts collected: ${uniquePosts.length} from ${Object.keys(subredditPostCounts).length} subreddits`);

    if (uniquePosts.length < 2) {
      throw new Error("Not enough unique unused posts found to create a round");
    }

    // Sort by score and select two posts from different subreddits if possible
    uniquePosts.sort((a, b) => b.score - a.score);
    
    // Create a more sophisticated selection algorithm to ensure variety
    // First, try to find posts from subreddits that haven't been paired recently
    let validPairs: [RedditPost, RedditPost][] = [];
    
    for (let i = 0; i < uniquePosts.length; i++) {
      for (let j = i + 1; j < uniquePosts.length; j++) {
        const postA = uniquePosts[i];
        const postB = uniquePosts[j];
        
        // Skip if posts are from the same subreddit
        if (postA.subreddit === postB.subreddit) continue;
        
        // Skip if this subreddit pair was recently used
        const pairKey = `${postA.subreddit}-${postB.subreddit}`;
        const reversePairKey = `${postB.subreddit}-${postA.subreddit}`;
        
        if (usedSubredditPairs.has(pairKey) || usedSubredditPairs.has(reversePairKey)) continue;
        
        // This is a valid pair
        validPairs.push([postA, postB]);
      }
    }
    
    // If we found valid pairs that haven't been used recently, use one of those
    let postA, postB;
    
    if (validPairs.length > 0) {
      // Pick a random pair from the valid ones
      const randomPair = validPairs[Math.floor(Math.random() * validPairs.length)];
      [postA, postB] = randomPair;
      console.log(`Selected unique subreddit pair: r/${postA.subreddit} vs r/${postB.subreddit}`);
    } else {
      // Fallback to the original algorithm if no unique pairs are available
      console.log("No unique subreddit pairs available, falling back to default selection");
      postA = uniquePosts[0];
      postB = null;

      // Try to find a post from a different subreddit for variety
      for (let i = 1; i < uniquePosts.length; i++) {
        if (uniquePosts[i].subreddit !== postA.subreddit) {
          postB = uniquePosts[i];
          break;
        }
      }
      
      // If no different subreddit found, just use the second highest scoring post
      if (!postB && uniquePosts.length > 1) {
        postB = uniquePosts[1];
      }
    }

    if (!postB) {
      throw new Error("Could not find a second unique post for the round");
    }

    console.log(`Selected posts: ${postA.id} from r/${postA.subreddit} (${postA.score} score) vs ${postB.id} from r/${postB.subreddit} (${postB.score} score)`);

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
      throw new Error(`Failed to create round in database: ${errorText}`);
    }

    const newRound = await createRoundResponse.json();
    console.log("Successfully created unique round:", newRound[0]?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Unique round created successfully",
        round: newRound[0],
        subreddit_pair: `${postA.subreddit} vs ${postB.subreddit}`,
        postsAvailable: uniquePosts.length,
        usedPostsFiltered: usedPostIds.size,
        uniquePairsFound: validPairs.length,
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