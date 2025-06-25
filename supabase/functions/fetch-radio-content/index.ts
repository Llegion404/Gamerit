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
  type: 'post' | 'comment';
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

    if (!subreddits || !Array.isArray(subreddits) || subreddits.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid subreddits list" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Fetching content from subreddits: ${subreddits.join(", ")}`);

    const allContent: RadioContent[] = [];

    // Fetch content from each subreddit
    for (const subreddit of subreddits) {
      try {
        // Fetch hot posts
        const postsResponse = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=10`, {
          headers: {
            "User-Agent": "RedditRadio/1.0",
          },
        });

        if (postsResponse.ok) {
          const postsData: RedditResponse = await postsResponse.json();
          
          for (const item of postsData.data.children) {
            const post = item as RedditPost;
            
            // Filter out removed/deleted posts and ensure we have content
            if (post.data.author !== "[deleted]" && 
                post.data.title && 
                post.data.title !== "[removed]" &&
                post.data.score > 5) {
              
              // Create content from post title and text
              let text = post.data.title;
              if (post.data.selftext && post.data.selftext.length > 0 && post.data.selftext !== "[removed]") {
                text += ". " + post.data.selftext.substring(0, 500); // Limit length
              }

              allContent.push({
                id: `post_${post.data.id}`,
                type: 'post',
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

                    for (const commentItem of comments.slice(0, 3)) { // Top 3 comments
                      const comment = commentItem as RedditComment;
                      
                      if (comment.data.author !== "[deleted]" && 
                          comment.data.body && 
                          comment.data.body !== "[removed]" &&
                          comment.data.body.length > 20 &&
                          comment.data.score > 2) {
                        
                        allContent.push({
                          id: `comment_${comment.data.id}`,
                          type: 'comment',
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
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    // Sort content by score (highest first) and limit to reasonable amount
    allContent.sort((a, b) => b.score - a.score);
    const limitedContent = allContent.slice(0, 50); // Limit to 50 items

    console.log(`Collected ${limitedContent.length} content items`);

    return new Response(
      JSON.stringify({
        success: true,
        content: limitedContent,
        total_items: limitedContent.length,
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