import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    score: number;
    num_comments: number;
    created_utc: number;
    permalink: string;
  };
}

interface RedditComment {
  data: {
    id: string;
    body: string;
    author: string;
    subreddit: string;
    score: number;
    created_utc: number;
  };
}

interface RedditResponse {
  data: {
    children: (RedditPost | RedditComment)[];
  };
}

interface RadioContent {
  id: string;
  type: "post" | "comment";
  title?: string;
  text: string;
  author: string;
  subreddit: string;
  score: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
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
    const { subreddits, player_id } = await req.json();

    console.log("Fetch radio content - Received request:", {
      subreddits: subreddits,
      player_id: player_id,
      subreddits_type: typeof subreddits,
      is_array: Array.isArray(subreddits),
      length: subreddits?.length,
    });

    if (!subreddits || !Array.isArray(subreddits) || subreddits.length === 0) {
      console.error("Invalid subreddits validation failed:", {
        exists: !!subreddits,
        is_array: Array.isArray(subreddits),
        has_length: subreddits?.length > 0,
        actual_value: subreddits,
      });
      return new Response(
        JSON.stringify({
          error: "Invalid subreddits list",
          debug: {
            received_subreddits: subreddits,
            type: typeof subreddits,
            is_array: Array.isArray(subreddits),
            length: subreddits?.length,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Get Reddit credentials from environment (same as create-auto-round)
    const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
    const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");

    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({
          error: "Reddit credentials not configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    // Get Reddit access token using client credentials (same as create-auto-round)
    console.log("Getting Reddit access token using client credentials...");
    const tokenResponse = await fetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(
            `${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`,
          )}`,
          "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Failed to get Reddit access token:", errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to authenticate with Reddit",
          details: errorText,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log("Successfully obtained Reddit access token");

    console.log(`Fetching content from subreddits: ${subreddits.join(", ")}`);

    const allContent: RadioContent[] = [];
    const debugInfo: {
      subreddits_processed: {
        subreddit: string;
        posts: number;
        comments: number;
      }[];
      total_posts_found: number;
      total_comments_found: number;
      errors: string[];
    } = {
      subreddits_processed: [],
      total_posts_found: 0,
      total_comments_found: 0,
      errors: [],
    };

    // Fetch content from each subreddit
    for (const subreddit of subreddits) {
      console.log(`Processing subreddit: r/${subreddit}`);
      let subredditPosts = 0;
      let subredditComments = 0;

      try {
        // Fetch hot posts using OAuth Reddit API with client credentials token
        const postsUrl = `https://oauth.reddit.com/r/${subreddit}/hot?limit=25`;
        console.log(`Fetching from: ${postsUrl}`);

        const postsResponse = await fetch(postsUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
          },
        });

        console.log(
          `Response status for r/${subreddit}:`,
          postsResponse.status,
        );

        if (postsResponse.ok) {
          const postsData: RedditResponse = await postsResponse.json();
          console.log(
            `Found ${postsData.data.children.length} posts in r/${subreddit}`,
          );

          for (const item of postsData.data.children) {
            const post = item as RedditPost;

            // Filter out removed/deleted posts and ensure we have content
            // Use a reasonable score threshold for quality content
            if (
              post.data.author !== "[deleted]" &&
              post.data.title &&
              post.data.title !== "[removed]" &&
              post.data.score > 5 &&
              post.data.title.length > 10 // Ensure substantial titles
            ) {
              subredditPosts++;

              // Create content from post title and text
              let text = post.data.title;
              if (
                post.data.selftext &&
                post.data.selftext.length > 0 &&
                post.data.selftext !== "[removed]"
              ) {
                text += ". " + post.data.selftext.substring(0, 300); // Limit length for TTS
              }

              allContent.push({
                id: `post_${post.data.id}`,
                type: "post",
                title: post.data.title,
                text: text,
                author: post.data.author,
                subreddit: post.data.subreddit,
                score: post.data.score,
              });

              // Also fetch top comments for this post if it has many comments
              if (post.data.num_comments > 10) {
                try {
                  const commentsResponse = await fetch(
                    `https://oauth.reddit.com/r/${subreddit}/comments/${post.data.id}?limit=3`,
                    {
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
                      },
                    },
                  );

                  if (commentsResponse.ok) {
                    const commentsData = await commentsResponse.json();
                    const comments = commentsData[1]?.data?.children || [];

                    for (const commentItem of comments.slice(0, 2)) {
                      // Top 2 comments to avoid too much content
                      const comment = commentItem as RedditComment;

                      if (
                        comment.data.author !== "[deleted]" &&
                        comment.data.body &&
                        comment.data.body !== "[removed]" &&
                        comment.data.body.length > 20 &&
                        comment.data.score > 2
                      ) {
                        subredditComments++;

                        allContent.push({
                          id: `comment_${comment.data.id}`,
                          type: "comment",
                          text: comment.data.body.substring(0, 300), // Limit length
                          author: comment.data.author,
                          subreddit: comment.data.subreddit,
                          score: comment.data.score,
                        });
                      }
                    }
                  }
                } catch (error) {
                  console.error(
                    `Error fetching comments for post ${post.data.id}:`,
                    error,
                  );
                }
              }
            }
          }
        } else {
          console.error(
            `Failed to fetch from r/${subreddit}: ${postsResponse.status}`,
          );
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
        debugInfo.errors.push(`r/${subreddit}: ${error.message}`);
      }

      console.log(
        `Completed r/${subreddit}: ${subredditPosts} posts, ${subredditComments} comments`,
      );
      debugInfo.subreddits_processed.push({
        subreddit,
        posts: subredditPosts,
        comments: subredditComments,
      });
      debugInfo.total_posts_found += subredditPosts;
      debugInfo.total_comments_found += subredditComments;
    }

    // Sort content by score (highest first) and limit to reasonable amount
    allContent.sort((a, b) => b.score - a.score);
    const limitedContent = allContent.slice(0, 30); // Limit to 30 items for better performance

    console.log(`Collected ${limitedContent.length} content items total`);

    return new Response(
      JSON.stringify({
        success: true,
        content: limitedContent,
        total_items: limitedContent.length,
        debug: debugInfo,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error fetching radio content:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
