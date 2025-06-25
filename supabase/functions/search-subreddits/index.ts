const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SearchRequest {
  query: string;
  limit?: number;
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

    const { query, limit = 10 }: SearchRequest = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify({ subreddits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search Reddit for subreddits
    const searchUrl = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(
      query
    )}&limit=${limit}&raw_json=1`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "KarmaCasino/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract subreddit names and info
    const subreddits =
      data.data?.children?.map((child: any) => ({
        name: child.data.display_name,
        title: child.data.title,
        description: child.data.public_description || child.data.description,
        subscribers: child.data.subscribers,
        over18: child.data.over18,
      })) || [];

    // Filter out NSFW subreddits and sort by subscriber count
    const filteredSubreddits = subreddits
      .filter((sub: any) => !sub.over18)
      .sort((a: any, b: any) => (b.subscribers || 0) - (a.subscribers || 0));

    return new Response(JSON.stringify({ subreddits: filteredSubreddits }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error searching subreddits:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to search subreddits",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
