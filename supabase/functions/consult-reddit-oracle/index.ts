import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    score: number;
    created_utc: number;
    num_comments?: number;
  };
}

interface RedditResponse {
  data: {
    children: (RedditComment | RedditPost)[];
  };
}

interface OracleAnswer {
  text: string;
  subreddit: string;
  author: string;
  score: number;
}

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

async function getRedditAccessToken(): Promise<string> {
  const clientId = Deno.env.get('REDDIT_CLIENT_ID');
  const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Reddit credentials not configured');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'RedditOracle/1.0',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Failed to get Reddit access token: ${response.status}`);
  }

  const data: RedditTokenResponse = await response.json();
  return data.access_token;
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
    const { question, player_id } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Oracle consultation: "${question}"`);

    // Get Reddit access token
    let accessToken: string;
    try {
      accessToken = await getRedditAccessToken();
    } catch (error) {
      console.error('Failed to get Reddit access token:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "The oracle's connection to the digital realm has been severed",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 503,
        }
      );
    }

    // Diverse subreddits for mystical wisdom
    const oracleSubreddits = [
      "gardening",
      "cooking",
      "showerthoughts",
      "lifeprotips",
      "explainlikeimfive",
      "todayilearned",
      "askreddit",
      "relationship_advice",
      "personalfinance",
      "fitness",
      "books",
      "movies",
      "music",
      "travel",
      "philosophy",
      "science",
      "technology",
      "art",
      "photography",
      "diy",
      "getmotivated",
      "wholesomememes",
      "mildlyinteresting",
      "oddlysatisfying",
      "earthporn",
      "foodporn",
      "cozyplaces",
      "meditation",
      "minimalism",
      "productivity",
    ];

    // Randomly select 3-5 subreddits for variety
    const selectedSubreddits = oracleSubreddits
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 3) + 3);

    console.log(`Consulting subreddits: ${selectedSubreddits.join(", ")}`);

    const allWisdom: OracleAnswer[] = [];

    // Fetch wisdom from selected subreddits
    for (const subreddit of selectedSubreddits) {
      try {
        // Randomly choose between hot, top, or new posts
        const sortTypes = ["hot", "top?t=week", "new"];
        const sortType = sortTypes[Math.floor(Math.random() * sortTypes.length)];
        
        const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/${sortType}?limit=25`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "User-Agent": "RedditOracle/1.0",
          },
        });

        if (response.ok) {
          const data: RedditResponse = await response.json();
          
          // Extract wisdom from posts and comments
          for (const item of data.data.children) {
            if (item.data.author === "[deleted]") continue;

            // For posts with text content
            if ("selftext" in item.data && item.data.selftext && item.data.selftext.length > 20) {
              const text = item.data.selftext.trim();
              if (text.length > 10 && text.length < 500 && !text.includes("[removed]")) {
                allWisdom.push({
                  text: text,
                  subreddit: item.data.subreddit,
                  author: item.data.author,
                  score: item.data.score,
                });
              }
            }

            // For post titles that could be wisdom
            if ("title" in item.data && item.data.title.length > 20 && item.data.title.length < 200) {
              allWisdom.push({
                text: item.data.title,
                subreddit: item.data.subreddit,
                author: item.data.author,
                score: item.data.score,
              });
            }
          }

          // Also try to get comments from a few posts
          const postsWithComments = data.data.children
            .filter(item => "num_comments" in item.data && (item.data as any).num_comments > 5)
            .slice(0, 2);

          for (const post of postsWithComments) {
            try {
              const commentsResponse = await fetch(
                `https://oauth.reddit.com/r/${subreddit}/comments/${post.data.id}?limit=10`,
                {
                  headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "User-Agent": "RedditOracle/1.0",
                  },
                }
              );

              if (commentsResponse.ok) {
                const commentsData = await commentsResponse.json();
                const comments = commentsData[1]?.data?.children || [];

                for (const comment of comments.slice(0, 5)) {
                  if (
                    comment.data.author !== "[deleted]" &&
                    comment.data.body &&
                    comment.data.body.length > 20 &&
                    comment.data.body.length < 400 &&
                    !comment.data.body.includes("[removed]") &&
                    comment.data.score > 1
                  ) {
                    allWisdom.push({
                      text: comment.data.body,
                      subreddit: comment.data.subreddit,
                      author: comment.data.author,
                      score: comment.data.score,
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching comments from r/${subreddit}:`, error);
            }
          }
        } else {
          console.error(`Failed to fetch from r/${subreddit}: ${response.status}`);
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    if (allWisdom.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "The oracle is silent. The cosmic energies are misaligned.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Filter for quality wisdom (remove very short or low-quality responses)
    const qualityWisdom = allWisdom.filter(wisdom => {
      const text = wisdom.text.toLowerCase();
      return (
        wisdom.text.length >= 20 &&
        wisdom.text.length <= 400 &&
        !text.includes("http") &&
        !text.includes("www.") &&
        !text.includes("edit:") &&
        !text.includes("update:") &&
        !text.includes("tl;dr") &&
        wisdom.score >= 1
      );
    });

    // If we have quality wisdom, use it; otherwise fall back to all wisdom
    const finalWisdom = qualityWisdom.length > 0 ? qualityWisdom : allWisdom;

    // Select random wisdom, with slight preference for higher-scored content
    const weightedWisdom = finalWisdom.flatMap(wisdom => {
      const weight = Math.max(1, Math.floor(Math.log(wisdom.score + 1)));
      return Array(weight).fill(wisdom);
    });

    const selectedWisdom = weightedWisdom[Math.floor(Math.random() * weightedWisdom.length)];

    // Clean up the wisdom text
    let cleanedText = selectedWisdom.text
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Remove markdown formatting for better readability
    cleanedText = cleanedText
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^>\s*/gm, "")
      .trim();

    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(cleanedText)) {
      cleanedText += ".";
    }

    console.log(`Oracle wisdom selected from r/${selectedWisdom.subreddit}: "${cleanedText.substring(0, 50)}..."`);

    return new Response(
      JSON.stringify({
        success: true,
        answer: {
          text: cleanedText,
          subreddit: selectedWisdom.subreddit,
          author: selectedWisdom.author,
          score: selectedWisdom.score,
        },
        question: question,
        consulted_subreddits: selectedSubreddits,
        total_wisdom_found: allWisdom.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error consulting Reddit Oracle:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "The oracle encountered a disturbance in the digital realm",
        details: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});