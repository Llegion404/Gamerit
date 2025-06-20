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

interface RedditPost {
  data: {
    id: string;
    score: number;
    title: string;
    author: string;
    subreddit: string;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
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

    console.log("Starting end-round process...");

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

    // Find rounds older than 24 hours that are still active
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const checkActiveRoundResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/game_rounds?status=eq.active&created_at=lt.${twentyFourHoursAgo.toISOString()}&select=*`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const expiredRounds = await checkActiveRoundResponse.json();

    if (!expiredRounds || expiredRounds.length === 0) {
      console.log("No rounds to end");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No rounds to end",
        }),
        {
          status: 200,
          headers,
        }
      );
    }

    console.log(`Found ${expiredRounds.length} expired rounds to process`);

    for (const round of expiredRounds) {
      try {
        console.log(`Processing round ${round.id}...`);

        // Mark as pending payout to prevent double processing
        await fetch(`${SUPABASE_URL}/rest/v1/game_rounds?id=eq.${round.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "pending_payout" }),
        });

        // Fetch current scores from Reddit API
        let postAFinalScore = round.post_a_initial_score;
        let postBFinalScore = round.post_b_initial_score;

        try {
          // Fetch Post A current score using authenticated Reddit API
          const responseA = await fetch(`https://oauth.reddit.com/api/info.json?id=t3_${round.post_a_id}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
            },
          });

          if (responseA.ok) {
            const dataA = await responseA.json();
            if (dataA.data?.children?.[0]?.data?.score !== undefined) {
              postAFinalScore = dataA.data.children[0].data.score;
            }
          }

          // Fetch Post B current score using authenticated Reddit API
          const responseB = await fetch(`https://oauth.reddit.com/api/info.json?id=t3_${round.post_b_id}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
            },
          });

          if (responseB.ok) {
            const dataB = await responseB.json();
            if (dataB.data?.children?.[0]?.data?.score !== undefined) {
              postBFinalScore = dataB.data.children[0].data.score;
            }
          }
        } catch (redditError) {
          console.error("Error fetching from Reddit API:", redditError);
          // Continue with initial scores if Reddit API fails
        }

        // Determine winner
        const winner =
          postAFinalScore > postBFinalScore
            ? "A"
            : postBFinalScore > postAFinalScore
            ? "B"
            : Math.random() > 0.5
            ? "A"
            : "B"; // Random winner for ties

        console.log(`Round ${round.id}: Post ${winner} wins (A: ${postAFinalScore}, B: ${postBFinalScore})`);

        // Update round with final scores and winner
        await fetch(`${SUPABASE_URL}/rest/v1/game_rounds?id=eq.${round.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            post_a_final_score: postAFinalScore,
            post_b_final_score: postBFinalScore,
            winner: winner,
            status: "finished",
          }),
        });

        // Get all bets for this round
        const betsResponse = await fetch(`${SUPABASE_URL}/rest/v1/bets?round_id=eq.${round.id}&select=*`, {
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
          },
        });

        const bets = await betsResponse.json();

        if (bets && bets.length > 0) {
          console.log(`Processing ${bets.length} bets for round ${round.id}`);

          // Process winning bets
          for (const bet of bets) {
            if (bet.bet_on === winner) {
              // Winner gets 2x their bet amount (original bet + winnings)
              const winnings = bet.amount * 2;

              // Get current player points
              const playerResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/players?id=eq.${bet.player_id}&select=points`,
                {
                  headers: {
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    apikey: SUPABASE_SERVICE_ROLE_KEY,
                    "Content-Type": "application/json",
                  },
                }
              );

              const playerData = await playerResponse.json();
              if (playerData && playerData.length > 0) {
                const currentPoints = playerData[0].points;
                const newPoints = currentPoints + winnings;

                // Update player points
                await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${bet.player_id}`, {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    apikey: SUPABASE_SERVICE_ROLE_KEY,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    points: newPoints,
                  }),
                });

                console.log(`Paid ${winnings} chips to player ${bet.player_id} (${currentPoints} -> ${newPoints})`);
              }
            }
            // Losers get nothing (they already lost their bet amount when placing it)
          }
        }

        console.log(`Successfully processed round ${round.id}`);
      } catch (roundError) {
        console.error(`Error processing round ${round.id}:`, roundError);

        // Mark round as finished even if there was an error to prevent reprocessing
        await fetch(`${SUPABASE_URL}/rest/v1/game_rounds?id=eq.${round.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "finished" }),
        });
      }
    }

    console.log(`Successfully processed ${expiredRounds.length} expired rounds`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${expiredRounds.length} expired rounds`,
        rounds_processed: expiredRounds.length,
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (error) {
    console.error("Error in end-round function:", error);
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
