import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    score: number;
    created_utc: number;
    permalink: string;
    over_18: boolean;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

interface DadJoke {
  id: string;
  joke: string;
  score: number;
  author: string;
  subreddit: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Reddit access token
    const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
    const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");

    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
      throw new Error("Reddit API credentials not configured");
    }

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

    // Fetch dad jokes from Reddit
    const subreddits = ["dadjokes"];
    const allJokes: DadJoke[] = [];

    for (const subreddit of subreddits) {
      try {
        // Fetch from both hot and top posts for variety
        const endpoints = ["hot", "top?t=week", "top?t=month"];
        
        for (const endpoint of endpoints) {
          const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/${endpoint}?limit=50`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
            },
          });

          if (response.ok) {
            const data: RedditResponse = await response.json();
            
            // Process posts to extract jokes
            for (const post of data.data.children) {
              // Skip NSFW content
              if (post.data.over_18) continue;
              
              // Skip posts without titles or with very short titles
              if (!post.data.title || post.data.title.length < 10) continue;
              
              // Skip posts with [deleted] or [removed]
              if (post.data.title.includes("[deleted]") || post.data.title.includes("[removed]")) continue;
              if (post.data.selftext.includes("[deleted]") || post.data.selftext.includes("[removed]")) continue;
              
              // Extract the joke - combine title and selftext if needed
              let jokeText = post.data.title;
              
              // If the title ends with a question mark and there's selftext, it's likely a setup/punchline format
              if (jokeText.trim().endsWith("?") && post.data.selftext && post.data.selftext.length > 0) {
                jokeText += " " + post.data.selftext;
              }
              
              // Skip very long jokes (hard to type)
              if (jokeText.length > 200) continue;
              
              // Skip very short jokes
              if (jokeText.length < 20) continue;
              
              // Add to jokes collection
              allJokes.push({
                id: post.data.id,
                joke: jokeText,
                score: post.data.score,
                author: post.data.author,
                subreddit: post.data.subreddit
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    // Sort by score (highest first) and take top 20
    const sortedJokes = allJokes
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return new Response(
      JSON.stringify({
        success: true,
        jokes: sortedJokes,
        count: sortedJokes.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error fetching dad jokes:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to fetch dad jokes",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});