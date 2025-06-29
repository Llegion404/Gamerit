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
    author: string;
    subreddit: string;
    permalink: string;
    created_utc: number;
    num_comments: number;
  };
}

interface RedditComment {
  data: {
    id: string;
    body: string;
    author: string;
    score: number;
    controversiality: number;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[] | RedditComment[];
  };
}

interface Dilemma {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  choiceA: {
    text: string;
    score: number;
    author: string;
  };
  choiceB: {
    text: string;
    score: number;
    author: string;
  };
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
    const { subreddit } = await req.json();

    if (!subreddit) {
      return new Response(JSON.stringify({ error: "Subreddit is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if we have cached dilemmas for this subreddit
    const { data: existingDilemmas, error: fetchError } = await supabase
      .from("subreddit_dilemmas")
      .select("*")
      .eq("subreddit", subreddit)
      .limit(10);

    if (fetchError) {
      console.error("Error fetching existing dilemmas:", fetchError);
    }

    // If we have cached dilemmas, return a random one
    if (existingDilemmas && existingDilemmas.length > 0) {
      const randomDilemma = existingDilemmas[Math.floor(Math.random() * existingDilemmas.length)];
      
      return new Response(
        JSON.stringify({
          success: true,
          dilemma: {
            id: randomDilemma.id,
            title: randomDilemma.post_title,
            subreddit: randomDilemma.subreddit,
            author: randomDilemma.post_author,
            choiceA: {
              text: randomDilemma.choice_a_text,
              score: randomDilemma.choice_a_score,
              author: randomDilemma.choice_a_author,
            },
            choiceB: {
              text: randomDilemma.choice_b_text,
              score: randomDilemma.choice_b_score,
              author: randomDilemma.choice_b_author,
            },
          },
          source: "cache",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // If no cached dilemmas, fetch from Reddit API
    const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
    const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");

    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Reddit API credentials not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Get Reddit access token
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

    // Fetch top posts from the subreddit
    const postsResponse = await fetch(`https://oauth.reddit.com/r/${subreddit}/hot?limit=25`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
      },
    });

    if (!postsResponse.ok) {
      throw new Error(`Failed to fetch posts from r/${subreddit}`);
    }

    const postsData = await postsResponse.json();
    const posts = postsData.data.children.filter((post: any) => 
      post.data.num_comments > 10 && 
      !post.data.stickied && 
      !post.data.over_18 &&
      post.data.title.length > 20 &&
      post.data.title.length < 300
    );

    if (posts.length === 0) {
      throw new Error(`No suitable posts found in r/${subreddit}`);
    }

    // Select a random post
    const randomPost = posts[Math.floor(Math.random() * posts.length)];
    const postId = randomPost.data.id;
    const postTitle = randomPost.data.title;
    const postAuthor = randomPost.data.author;

    // Fetch comments for the selected post
    const commentsResponse = await fetch(`https://oauth.reddit.com/r/${subreddit}/comments/${postId}?sort=top&limit=100`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
      },
    });

    if (!commentsResponse.ok) {
      throw new Error(`Failed to fetch comments for post ${postId}`);
    }

    const commentsData = await commentsResponse.json();
    const comments = commentsData[1].data.children
      .filter((comment: any) => 
        comment.kind === "t1" && 
        comment.data.body && 
        comment.data.body.length > 20 &&
        comment.data.body.length < 500 &&
        comment.data.author !== "[deleted]" &&
        comment.data.author !== "AutoModerator"
      )
      .map((comment: any) => ({
        id: comment.data.id,
        body: comment.data.body,
        author: comment.data.author,
        score: comment.data.score,
        controversiality: comment.data.controversiality,
      }));

    if (comments.length < 5) {
      throw new Error(`Not enough valid comments for post ${postId}`);
    }

    // Sort comments by score (highest first)
    comments.sort((a: any, b: any) => b.score - a.score);

    // Get top comment for choice A
    const topComment = comments[0];

    // Find a controversial comment for choice B
    // Either a highly downvoted comment or one with high controversiality
    let controversialComment;
    
    // First try to find a negative score comment
    const negativeComments = comments.filter((c: any) => c.score < 0);
    if (negativeComments.length > 0) {
      // Sort by most negative
      negativeComments.sort((a: any, b: any) => a.score - b.score);
      controversialComment = negativeComments[0];
    } else {
      // If no negative comments, find one with high controversiality
      const controversialComments = comments.filter((c: any) => c.controversiality > 0);
      if (controversialComments.length > 0) {
        // Sort by controversiality
        controversialComments.sort((a: any, b: any) => b.controversiality - a.controversiality);
        controversialComment = controversialComments[0];
      } else {
        // If no controversial comments either, just use the lowest scored comment
        controversialComment = comments[comments.length - 1];
      }
    }

    // Create the dilemma
    const dilemma: Dilemma = {
      id: postId,
      title: postTitle,
      subreddit: subreddit,
      author: postAuthor,
      choiceA: {
        text: topComment.body,
        score: topComment.score,
        author: topComment.author,
      },
      choiceB: {
        text: controversialComment.body,
        score: controversialComment.score,
        author: controversialComment.author,
      },
    };

    // Cache the dilemma in the database
    await supabase.from("subreddit_dilemmas").insert({
      subreddit: subreddit,
      post_id: postId,
      post_title: postTitle,
      post_author: postAuthor,
      choice_a_text: topComment.body,
      choice_a_score: topComment.score,
      choice_a_author: topComment.author,
      choice_b_text: controversialComment.body,
      choice_b_score: controversialComment.score,
      choice_b_author: controversialComment.author,
    }).onConflict("post_id").ignore();

    return new Response(
      JSON.stringify({
        success: true,
        dilemma: dilemma,
        source: "reddit_api",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error fetching subreddit dilemma:", error);
    
    // Return a fallback dilemma for the requested subreddit
    return new Response(
      JSON.stringify({
        success: true,
        dilemma: {
          id: "fallback",
          title: "What would you do in this situation?",
          subreddit: "AskReddit",
          author: "random_user",
          choiceA: {
            text: "The hivemind-approved response that aligns with the subreddit's values.",
            score: 5000 + Math.floor(Math.random() * 10000),
            author: "popular_opinion"
          },
          choiceB: {
            text: "A controversial take that challenges the subreddit's conventional wisdom.",
            score: -500 - Math.floor(Math.random() * 2000),
            author: "downvoted_truth"
          }
        },
        source: "fallback",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});