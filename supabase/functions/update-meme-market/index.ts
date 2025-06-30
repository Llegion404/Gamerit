import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define query parameter interface
interface UpdateMarketParams {
  create_new_stocks?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RedditPost {
  data: {
    id: string;
    title: string;
    score: number;
    created_utc: number;
    subreddit: string;
    author: string;
    num_comments: number;
    upvote_ratio: number;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

interface MemeStock {
  id: string;
  meme_keyword: string;
  current_value: number;
  is_active: boolean;
  history: Array<{ timestamp: string; value: number }>;
  created_at: string;
}

interface KeywordData {
  count: number;
  totalScore: number;
  posts: number;
  avgScore: number;
  trendScore: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse query parameters to determine if we should create new stocks
    const url = new URL(req.url);
    const params: UpdateMarketParams = {};
    for (const [key, value] of url.searchParams.entries()) {
      params[key as keyof UpdateMarketParams] = value;
    }
    
    // Default to not creating new stocks (refresh only)
    const shouldCreateNewStocks = params.create_new_stocks === 'true';
    
    // Initialize Supabase client with service role key for admin privileges
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
    const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");

    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
      console.log("Reddit credentials not available, using database refresh function");
      
      // Use database function to refresh stocks when Reddit API isn't available
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: refreshResult } = await supabase.rpc("refresh_meme_stocks");
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "Meme stocks refreshed (Reddit data unavailable)",
          stocks_updated: refreshResult?.stocks_updated || 0,
          new_stocks_created: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting meme market update... (create_new_stocks=${shouldCreateNewStocks})`);
    
    // Force a timestamp to ensure cache busting
    const updateTimestamp = new Date().toISOString();
    console.log(`Update timestamp: ${updateTimestamp}`);

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
      throw new Error("Failed to get Reddit access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Target subreddits for meme analysis (expanded list)
    const targetSubreddits = [
      "dankmemes", "memes", "MemeEconomy", "wholesomememes", "funny", 
      "PrequelMemes", "HistoryMemes", "ProgrammerHumor", "gaming",
      "teenagers", "okbuddyretard", "DeepFriedMemes", "surrealmemes",
      "antimeme", "bonehurtingjuice", "comedyheaven", "me_irl",
      "meirl", "2meirl4meirl", "absolutelynotme_irl", "blackpeopletwitter",
      "whitepeopletwitter", "scottishpeopletwitter", "facepalm",
      "therewasanattempt", "mildlyinfuriating", "oddlysatisfying"
    ];

    // Fetch hot posts from each subreddit
    const allPosts: RedditPost[] = [];

    for (const subreddit of targetSubreddits) {
      try {
        // Fetch both hot and top posts for better coverage
        const endpoints = [`hot`, `top?t=day`];
        
        for (const endpoint of endpoints) {
          const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/${endpoint}?limit=50`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "KarmaCasino/1.0 by u/Cold_Count_3944",
            },
          });

          if (response.ok) {
            const data: RedditResponse = await response.json();
            const posts = data.data.children
              .filter(item => item.kind === "t3")
              .map(item => item.data)
              .filter(post => 
                post.score > 10 && // Minimum engagement
                post.upvote_ratio > 0.6 && // Not too controversial
                !post.title.toLowerCase().includes('[deleted]') &&
                !post.title.toLowerCase().includes('[removed]')
              );
            
            allPosts.push(...posts);
            console.log(`Found ${posts.length} quality posts from r/${subreddit}/${endpoint}`);
          }
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    console.log(`Total posts collected: ${allPosts.length}`);

    // Enhanced keyword extraction and analysis
    const keywordCounts: Map<string, KeywordData> = new Map();

    // Expanded stop words list (financial terms added)
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
      "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they", "me", "him",
      "her", "us", "them", "my", "your", "his", "our", "their", "is", "are", "was", "were", "be",
      "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
      "when", "where", "why", "how", "what", "who", "which", "reddit", "post", "comment", "upvote",
      "downvote", "karma", "edit", "update", "new", "old", "first", "last", "best", "worst", "good",
      "bad", "great", "amazing", "awesome", "terrible", "just", "now", "today", "yesterday", "tomorrow",
      "like", "get", "make", "take", "come", "go", "see", "know", "think", "say", "tell", "ask",
      "give", "use", "find", "work", "call", "try", "need", "feel", "become", "leave", "put", "mean",
      "keep", "let", "begin", "seem", "help", "talk", "turn", "start", "might", "show", "hear", "play",
      "run", "move", "live", "believe", "hold", "bring", "happen", "write", "provide", "sit", "stand",
      "lose", "pay", "meet", "include", "continue", "set", "learn", "change", "lead", "understand",
      "watch", "follow", "stop", "create", "speak", "read", "allow", "add", "spend", "grow", "open",
      "walk", "win", "offer", "remember", "love", "consider", "appear", "buy", "wait", "serve", "die",
      "send", "expect", "build", "stay", "fall", "cut", "reach", "kill", "remain"
      // Financial/trading terms that should be included as meme stocks
      // "stonks", "hodl", "diamond", "hands", "moon", "rocket", "ape", "tendies", "yolo", "fomo"
    ]);

    // Analyze posts for meme keywords
    allPosts.forEach((post) => {
      const title = post.title.toLowerCase();
      const words = title.match(/\b[a-zA-Z]{3,}\b/g) || [];

      words.forEach((word) => {
        if (!stopWords.has(word) && word.length >= 3 && word.length <= 15) {
          const current = keywordCounts.get(word) || { 
            count: 0, 
            totalScore: 0, 
            posts: 0, 
            avgScore: 0, 
            trendScore: 0 
          };
          
          current.count++;
          current.totalScore += post.score;
          current.posts++;
          current.avgScore = current.totalScore / current.posts;
          
          // Calculate trend score based on recency and engagement
          const hoursOld = (Date.now() / 1000 - post.created_utc) / 3600;
          const recencyBonus = Math.max(0, 48 - hoursOld) / 48; // Bonus for recent posts (48h window)
          const engagementScore = post.score * post.upvote_ratio * (post.num_comments / 5); // Higher comment weight
          current.trendScore += engagementScore * (1 + recencyBonus);
          
          keywordCounts.set(word, current);
        }
      });
    });

    // Filter for significant keywords with enhanced criteria
    const significantKeywords = Array.from(keywordCounts.entries())
      .filter(([_, data]) => 
        data.posts >= 2 && // Appeared in at least 2 posts (lowered threshold)
        data.count >= 3 && // Mentioned at least 3 times total (lowered threshold)
        data.avgScore >= 15 && // Average post score of 15+ (lowered threshold)
        data.trendScore >= 50 // Minimum trend score (lowered threshold)
      )
      .sort((a, b) => b[1].trendScore - a[1].trendScore); // Sort by trend score

    console.log(`Found ${significantKeywords.length} significant trending keywords`);

    // Get current meme stocks from database
    const { data: existingStocks, error: fetchError } = await supabase
      .from("meme_stocks")
      .select("*");

    if (fetchError) {
      throw new Error(`Error fetching existing stocks: ${fetchError.message}`);
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeStocks = existingStocks.filter(stock => 
      stock.is_active && new Date(stock.created_at) > oneWeekAgo
    );
    const expiredStocks = existingStocks.filter(stock => 
      stock.is_active && new Date(stock.created_at) <= oneWeekAgo
    );

    console.log(`Active stocks (< 1 week): ${activeStocks.length}`);
    console.log(`Expired stocks (≥ 1 week): ${expiredStocks.length}`);

    let updatedCount = 0;
    let newStocksCount = 0;
    let deactivatedCount = 0;

    // Update values for existing active stocks
    for (const stock of activeStocks) {
      const keywordData = keywordCounts.get(stock.meme_keyword);
      
      if (keywordData) {
        // Calculate new value using enhanced formula
        const baseValue = Math.max(25, Math.floor(keywordData.avgScore * 1.5)); // Lower base value
        const trendMultiplier = 1 + (keywordData.trendScore / 500); // More sensitive to trends
        // Increase volatility for more noticeable changes
        const volatilityFactor = 0.8 + (Math.random() * 0.4); // ±20% random volatility
        const newValue = Math.floor(baseValue * trendMultiplier * volatilityFactor);
        
        // Ensure reasonable bounds (5-10000) - wider range for more excitement
        const finalValue = Math.max(5, Math.min(10000, newValue));

        // Update stock with history tracking
        const { error: updateError } = await supabase.rpc("update_stock_history", {
          p_stock_id: stock.id,
          p_new_value: finalValue,
        });

        if (!updateError) {
          updatedCount++;
          console.log(`Updated ${stock.meme_keyword}: ${stock.current_value} -> ${finalValue} (trend: ${keywordData.trendScore.toFixed(0)})`);
        }
      } else {
        // Stock keyword not trending, apply small random volatility
        // Increase volatility for more noticeable changes even when not trending
        const volatilityFactor = 0.85 + (Math.random() * 0.3); // ±15% volatility
        const newValue = Math.max(10, Math.floor(stock.current_value * volatilityFactor));
        
        // Only update if change is significant enough to be visible
        if (Math.abs(newValue - stock.current_value) >= Math.max(1, stock.current_value * 0.02)) {
          await supabase.rpc("update_stock_history", {
            p_stock_id: stock.id,
            p_new_value: newValue,
          });
          updatedCount++;
        }
      }
    }

    // Deactivate expired stocks
    for (const stock of expiredStocks) {
      const { error: deactivateError } = await supabase
        .from("meme_stocks");
      
      // Only deactivate if we're in weekly update mode (creating new stocks)
      if (shouldCreateNewStocks) {
        await supabase
          .from("meme_stocks")
          .update({ is_active: false })
          .eq("id", stock.id);

        if (!deactivateError) {
          deactivatedCount++;
          console.log(`Deactivated expired stock: ${stock.meme_keyword} (created ${stock.created_at})`);
        }
      }
    }

    // Add new trending stocks
    const currentActiveCount = activeStocks.length - deactivatedCount;
    const maxStocks = 20; // Increased for more variety
    const slotsAvailable = Math.max(0, maxStocks - currentActiveCount);

    // Only create new stocks if explicitly requested (weekly cron job)
    if (shouldCreateNewStocks && slotsAvailable > 0) {
      const activeKeywords = new Set(activeStocks.map(stock => stock.meme_keyword));
      const newKeywords = significantKeywords
        .filter(([keyword, _]) => !activeKeywords.has(keyword))
        .slice(0, slotsAvailable);

      for (const [keyword, data] of newKeywords) {
        const baseValue = Math.max(25, Math.floor(data.avgScore * 1.5));
        const trendMultiplier = 1 + (data.trendScore / 500);
        const initialValue = Math.floor(baseValue * trendMultiplier);
        const finalValue = Math.max(5, Math.min(10000, initialValue));

        const { error: insertError } = await supabase
          .from("meme_stocks")
          .insert({
            meme_keyword: keyword,
            current_value: finalValue,
            is_active: true,
            history: [{ timestamp: new Date().toISOString(), value: finalValue }],
          });

        if (!insertError) {
          newStocksCount++;
          console.log(`Created new stock ${keyword}: ${finalValue} (trend: ${data.trendScore.toFixed(0)})`);
        }
      }
      if (!shouldCreateNewStocks) {
        console.log("Skipping new stock creation as requested (refresh only)");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: shouldCreateNewStocks 
          ? "Meme market fully updated with new stocks" 
          : "Existing meme stocks refreshed successfully",
        timestamp: updateTimestamp,
        stats: {
          posts_analyzed: allPosts.length,
          keywords_found: significantKeywords.length,
          active_stocks_before: activeStocks.length,
          stocks_updated: updatedCount,
          new_stocks_added: shouldCreateNewStocks ? newStocksCount : 0,
          expired_stocks_deactivated: deactivatedCount,
          current_active_stocks: currentActiveCount + newStocksCount,
          create_new_stocks_mode: shouldCreateNewStocks,
        },
        trending_keywords: significantKeywords.slice(0, 10).map(([keyword, data]) => ({
          keyword,
          trend_score: Math.round(data.trendScore),
          posts: data.posts,
          avg_score: Math.round(data.avgScore),
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error updating meme market:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});