const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RedditPostResponse {
  data: {
    children: Array<{
      data: {
        id: string;
        score: number;
        title: string;
        author: string;
      };
    }>;
  };
}

// Helper function to make fetch requests with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Request to ${url} timed out after ${timeoutMs}ms`);
      throw new Error(`Request timeout: ${url}`);
    }
    console.error(`Network error for ${url}:`, error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  // Add CORS headers to all responses
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers,
      });
    }

    console.log("Starting score update process...");

    // Get environment variables
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

    // Get Reddit access token using client credentials with timeout
    const tokenResponse = await fetchWithTimeout("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`)}`,
        "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    }, 15000);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Failed to get Reddit access token:", errorText);
      throw new Error("Failed to authenticate with Reddit");
    }

    const tokenData: RedditTokenResponse = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get active rounds from Supabase with timeout
    const activeRoundsResponse = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/game_rounds?status=eq.active&select=*`, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
    }, 10000);

    if (!activeRoundsResponse.ok) {
      throw new Error("Failed to fetch active rounds");
    }

    const activeRounds = await activeRoundsResponse.json();

    if (!activeRounds || activeRounds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active rounds to update",
          updatedRounds: 0,
        }),
        {
          status: 200,
          headers,
        }
      );
    }

    let updatedRounds = 0;
    const updateResults = [];

    // Update scores for each active round
    for (const round of activeRounds) {
      try {
        // Fetch current scores for both posts using the proper Reddit posts API with timeout
        const [postAResponse, postBResponse] = await Promise.all([
          fetchWithTimeout(`https://oauth.reddit.com/api/info.json?id=t3_${round.post_a_id}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
            },
          }, 10000).catch(error => {
            console.error(`Error fetching post A (${round.post_a_id}):`, error);
            return null;
          }),
          fetchWithTimeout(`https://oauth.reddit.com/api/info.json?id=t3_${round.post_b_id}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
            },
          }, 10000).catch(error => {
            console.error(`Error fetching post B (${round.post_b_id}):`, error);
            return null;
          }),
        ]);

        let postACurrentScore = round.post_a_final_score; // Default to last known score
        let postBCurrentScore = round.post_b_final_score; // Default to last known score
        let postAExists = true;
        let postBExists = true;

        // Check if post A still exists and get its current score
        if (postAResponse && postAResponse.ok) {
          try {
            const postAData: RedditPostResponse = await postAResponse.json();
            if (postAData.data?.children?.[0]?.data) {
              postACurrentScore = postAData.data.children[0].data.score;
            } else {
              postAExists = false;
              console.log(`Post A (${round.post_a_id}) appears to be deleted or removed`);
            }
          } catch (error) {
            console.error(`Error parsing post A data:`, error);
            postAExists = false;
          }
        } else {
          postAExists = false;
          console.log(`Post A (${round.post_a_id}) is not accessible`);
        }

        // Check if post B still exists and get its current score
        if (postBResponse && postBResponse.ok) {
          try {
            const postBData: RedditPostResponse = await postBResponse.json();
            if (postBData.data?.children?.[0]?.data) {
              postBCurrentScore = postBData.data.children[0].data.score;
            } else {
              postBExists = false;
              console.log(`Post B (${round.post_b_id}) appears to be deleted or removed`);
            }
          } catch (error) {
            console.error(`Error parsing post B data:`, error);
            postBExists = false;
          }
        } else {
          postBExists = false;
          console.log(`Post B (${round.post_b_id}) is not accessible`);
        }

        // Update the round with new scores using timeout
        const updateResponse = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/game_rounds?id=eq.${round.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            post_a_final_score: postACurrentScore,
            post_b_final_score: postBCurrentScore,
          }),
        }, 10000);

        if (updateResponse.ok) {
          updatedRounds++;
          updateResults.push({
            roundId: round.id,
            postA: {
              id: round.post_a_id,
              previousScore: round.post_a_final_score,
              currentScore: postACurrentScore,
              exists: postAExists,
            },
            postB: {
              id: round.post_b_id,
              previousScore: round.post_b_final_score,
              currentScore: postBCurrentScore,
              exists: postBExists,
            },
          });

          console.log(
            `Updated round ${round.id}: Post A: ${round.post_a_final_score} -> ${postACurrentScore}, Post B: ${round.post_b_final_score} -> ${postBCurrentScore}`
          );
        } else {
          console.error(`Failed to update round ${round.id}`);
        }

        // If either post doesn't exist, we might want to handle this case
        // For now, we'll just log it, but you could add logic to end the round or mark it as problematic
        if (!postAExists || !postBExists) {
          console.warn(
            `Round ${round.id} has deleted posts - Post A exists: ${postAExists}, Post B exists: ${postBExists}`
          );
        }
      } catch (error) {
        console.error(`Error updating round ${round.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updatedRounds} rounds`,
        updatedRounds,
        results: updateResults,
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (error) {
    console.error("Error in update-current-scores function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});