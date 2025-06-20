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
    score: number;
    created_utc: number;
    subreddit: string;
    author: string;
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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin privileges
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting meme market update...");

    // Define target subreddits for meme analysis
    const targetSubreddits = ["dankmemes", "MemeEconomy", "memes", "wholesomememes", "funny"];

    // Fetch hot posts from each subreddit
    const allPosts: RedditPost[] = [];

    for (const subreddit of targetSubreddits) {
      try {
        const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=50`, {
          headers: {
            "User-Agent": "Karma-Casino-Bot/1.0",
          },
        });

        if (response.ok) {
          const data: RedditResponse = await response.json();
          allPosts.push(...data.data.children);
          console.log(`Fetched ${data.data.children.length} posts from r/${subreddit}`);
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
      }
    }

    console.log(`Total posts collected: ${allPosts.length}`);

    // Extract and analyze keywords from post titles
    const keywordCounts: Map<string, { count: number; totalScore: number; posts: number }> = new Map();

    // Common words to filter out (stop words + reddit-specific)
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "him",
      "her",
      "us",
      "them",
      "my",
      "your",
      "his",
      "our",
      "their",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "when",
      "where",
      "why",
      "how",
      "what",
      "who",
      "which",
      "reddit",
      "post",
      "comment",
      "upvote",
      "downvote",
      "karma",
      "edit",
      "update",
      "new",
      "old",
      "first",
      "last",
      "best",
      "worst",
      "good",
      "bad",
      "great",
      "amazing",
      "awesome",
      "terrible",
      "just",
      "now",
      "today",
      "yesterday",
      "tomorrow",
    ]);

    allPosts.forEach((post) => {
      const title = post.data.title.toLowerCase();
      const words = title.match(/\b[a-zA-Z]{3,}\b/g) || [];

      words.forEach((word) => {
        if (!stopWords.has(word) && word.length >= 3) {
          const current = keywordCounts.get(word) || { count: 0, totalScore: 0, posts: 0 };
          current.count++;
          current.totalScore += post.data.score;
          current.posts++;
          keywordCounts.set(word, current);
        }
      });
    });

    // Filter for significant keywords (appeared in multiple posts)
    const significantKeywords = Array.from(keywordCounts.entries())
      .filter(([_, data]) => data.posts >= 2 && data.count >= 3)
      .sort((a, b) => b[1].totalScore - a[1].totalScore);

    console.log(`Found ${significantKeywords.length} significant keywords`);

    // Get current meme stocks from database
    const { data: existingStocks, error: fetchError } = await supabase.from("meme_stocks").select("*");

    if (fetchError) {
      throw new Error(`Error fetching existing stocks: ${fetchError.message}`);
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Separate existing stocks into active (less than 1 week old) and expired (more than 1 week old)
    const activeStocks = existingStocks.filter((stock) => stock.is_active && new Date(stock.created_at) > oneWeekAgo);

    const expiredStocks = existingStocks.filter((stock) => stock.is_active && new Date(stock.created_at) <= oneWeekAgo);

    console.log(`Active stocks (< 1 week): ${activeStocks.length}`);
    console.log(`Expired stocks (≥ 1 week): ${expiredStocks.length}`);

    // Update values for existing active stocks (but don't change their active status)
    const existingStocksMap = new Map(activeStocks.map((stock) => [stock.meme_keyword, stock]));

    for (const stock of activeStocks) {
      const keywordData = keywordCounts.get(stock.meme_keyword);

      if (keywordData) {
        // Calculate new value based on current trending data
        const calculatedValue = Math.max(10, Math.floor((keywordData.totalScore + keywordData.posts * 10) / 100));

        const { error: updateError } = await supabase
          .from("meme_stocks")
          .update({
            current_value: calculatedValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", stock.id);

        if (updateError) {
          console.error(`Error updating stock ${stock.meme_keyword}:`, updateError);
        } else {
          console.log(`Updated active stock ${stock.meme_keyword}: ${stock.current_value} -> ${calculatedValue}`);
        }
      } else {
        // Stock keyword not trending anymore, but keep it active until 1 week expires
        // Just update the timestamp
        const { error: updateError } = await supabase
          .from("meme_stocks")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("id", stock.id);

        if (updateError) {
          console.error(`Error updating timestamp for ${stock.meme_keyword}:`, updateError);
        } else {
          console.log(`Keeping active stock ${stock.meme_keyword} (not currently trending but < 1 week old)`);
        }
      }
    }

    // Deactivate expired stocks (older than 1 week)
    const stocksToDeactivate = expiredStocks;
    for (const stock of stocksToDeactivate) {
      const { error: deactivateError } = await supabase
        .from("meme_stocks")
        .update({ is_active: false })
        .eq("id", stock.id);

      if (deactivateError) {
        console.error(`Error deactivating expired stock ${stock.meme_keyword}:`, deactivateError);
      } else {
        console.log(`Deactivated expired stock: ${stock.meme_keyword} (created ${stock.created_at})`);
      }
    }

    // Add new stocks from trending keywords (only if we have space)
    const currentActiveCount = activeStocks.length - stocksToDeactivate.length; // Active stocks after deactivation
    const slotsAvailable = Math.max(0, 10 - currentActiveCount); // Target 10 active stocks

    if (slotsAvailable > 0) {
      // Find new keywords that aren't already active stocks
      const activeKeywords = new Set(activeStocks.map((stock) => stock.meme_keyword));
      const newKeywords = significantKeywords
        .filter(([keyword, _]) => !activeKeywords.has(keyword))
        .slice(0, slotsAvailable);

      console.log(`Adding ${newKeywords.length} new stocks (${slotsAvailable} slots available)`);

      for (const [keyword, data] of newKeywords) {
        const calculatedValue = Math.max(10, Math.floor((data.totalScore + data.posts * 10) / 100));

        const { error: insertError } = await supabase.from("meme_stocks").insert({
          meme_keyword: keyword,
          current_value: calculatedValue,
          is_active: true,
          history: [{ timestamp: new Date().toISOString(), value: calculatedValue }],
        });

        if (insertError) {
          console.error(`Error creating new stock ${keyword}:`, insertError);
        } else {
          console.log(`Created new stock ${keyword}: ${calculatedValue}`);
        }
      }
    } else {
      console.log(`No slots available for new stocks (${currentActiveCount}/10 active)`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Meme market updated successfully",
        active_stocks_before: activeStocks.length,
        expired_stocks_deactivated: stocksToDeactivate.length,
        new_stocks_added:
          slotsAvailable > 0
            ? Math.min(
                slotsAvailable,
                significantKeywords.filter(
                  ([keyword, _]) => !new Set(activeStocks.map((s) => s.meme_keyword)).has(keyword)
                ).length
              )
            : 0,
        total_trending_keywords: significantKeywords.length,
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
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
