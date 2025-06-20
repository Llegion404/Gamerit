const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface TokenRequest {
  code: string;
  state: string;
  redirect_uri: string;
}

Deno.serve(async (req: Request) => {
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code, state, redirect_uri }: TokenRequest = await req.json();

    if (!code || !state || !redirect_uri) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Reddit credentials from environment
    const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
    const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");

    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Reddit credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`)}`,
        "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Reddit token exchange failed:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        requestData: { code: code.substring(0, 10) + "...", redirect_uri },
      });
      return new Response(
        JSON.stringify({
          error: "Failed to exchange code for token",
          details: errorText,
          status: tokenResponse.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ error: "No access token received" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user info from Reddit
    const userResponse = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("Reddit user info failed:", errorText);
      return new Response(JSON.stringify({ error: "Failed to get user info" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userData = await userResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        access_token: tokenData.access_token,
        user: userData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in reddit-oauth function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
