import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log("Received request:", { subreddits, player_id });
    console.log("Subreddits type:", typeof subreddits);
    console.log("Subreddits value:", JSON.stringify(subreddits));
    console.log("Is array:", Array.isArray(subreddits));
    console.log("Length:", subreddits?.length);

    if (!subreddits || !Array.isArray(subreddits) || subreddits.length === 0) {
      console.log("Invalid subreddits validation failed:");
      console.log("- subreddits exists:", !!subreddits);
      console.log("- is array:", Array.isArray(subreddits));
      console.log("- has length:", subreddits?.length > 0);
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
        }
      );
    }

    console.log(`Fetching content from subreddits: ${subreddits.join(", ")}`);

    const allContent: RadioContent[] = [];
    const debugInfo: any = {
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
        // Fetch hot posts
        const postsUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`;
        console.log(`Fetching from: ${postsUrl}`);

        const postsResponse = await fetch(postsUrl, {
          headers: {
            "User-Agent": "RedditRadio/1.0",
          },
        });

        console.log(`Response status for r/${subreddit}:`, postsResponse.status);

        if (postsResponse.ok) {
          const postsData: RedditResponse = await postsResponse.json();
          console.log(`Found ${postsData.data.children.length} posts in r/${subreddit}`);

          for (const item of postsData.data.children) {
            const post = item as RedditPost;

            console.log(`Checking post: ${post.data.title} (score: ${post.data.score}, author: ${post.data.author})`);

            // Filter out removed/deleted posts and ensure we have content
            // Lowered score threshold from 5 to 1 for better content discovery
            if (
              post.data.author !== "[deleted]" &&
              post.data.title &&
              post.data.title !== "[removed]" &&
              post.data.score > 1 // Lowered from 5 to 1
            ) {
              console.log(`Adding post: ${post.data.title}`);
              subredditPosts++;

              // Create content from post title and text
              let text = post.data.title;
              if (post.data.selftext && post.data.selftext.length > 0 && post.data.selftext !== "[removed]") {
                text += ". " + post.data.selftext.substring(0, 500); // Limit length
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
                    `https://www.reddit.com/r/${subreddit}/comments/${post.data.id}.json?limit=5`,
                    {
                      headers: {
                        "User-Agent": "RedditRadio/1.0",
                      },
                    }
                  );

                  if (commentsResponse.ok) {
                    const commentsData = await commentsResponse.json();
                    const comments = commentsData[1]?.data?.children || [];

                    for (const commentItem of comments.slice(0, 3)) {
                      // Top 3 comments
                      const comment = commentItem as RedditComment;

                      if (
                        comment.data.author !== "[deleted]" &&
                        comment.data.body &&
                        comment.data.body !== "[removed]" &&
                        comment.data.body.length > 20 &&
                        comment.data.score > 2
                      ) {
                        console.log(`Adding comment by ${comment.data.author} (score: ${comment.data.score})`);
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
                  console.error(`Error fetching comments for post ${post.data.id}:`, error);
                }
              }
            } else {
              console.log(
                `Filtered out post: ${post.data.title} (author: ${post.data.author}, score: ${post.data.score})`
              );
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
        debugInfo.errors.push(`r/${subreddit}: ${error.message}`);
      }

      console.log(`Completed r/${subreddit}: ${subredditPosts} posts, ${subredditComments} comments`);
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
    const limitedContent = allContent.slice(0, 50); // Limit to 50 items

    console.log(`Collected ${limitedContent.length} content items total`);
    console.log("Debug info:", debugInfo);

    return new Response(
      JSON.stringify({
        success: true,
        content: limitedContent,
        total_items: limitedContent.length,
        debug: debugInfo, // Include debug info in response
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error fetching radio content:", error);
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
