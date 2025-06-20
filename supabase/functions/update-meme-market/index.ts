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
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .slice(0, 20); // Top 20 trending keywords

    console.log(`Found ${significantKeywords.length} significant keywords`);

    // Get current meme stocks from database
    const { data: existingStocks, error: fetchError } = await supabase.from("meme_stocks").select("*");

    if (fetchError) {
      throw new Error(`Error fetching existing stocks: ${fetchError.message}`);
    }

    const existingStocksMap = new Map(existingStocks.map((stock) => [stock.meme_keyword, stock]));

    // Process each significant keyword
    for (const [keyword, data] of significantKeywords) {
      // Calculate value with scaled formula: ((Total Upvotes) + (Number of Posts * 10)) / 100
      // This makes stocks more affordable for gameplay
      const baseValue = data.totalScore + data.posts * 10;
      const calculatedValue = Math.max(Math.floor(baseValue / 100), 10); // Minimum 10 chips

      const existingStock = existingStocksMap.get(keyword);

      if (existingStock) {
        // Update existing stock
        const newHistory = [
          ...(existingStock.history || []),
          {
            timestamp: new Date().toISOString(),
            value: calculatedValue,
          },
        ];

        // Keep only last 168 hours (7 days) of history
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const filteredHistory = newHistory.filter((entry) => new Date(entry.timestamp) > weekAgo);

        const { error: updateError } = await supabase
          .from("meme_stocks")
          .update({
            current_value: calculatedValue,
            is_active: true,
            history: filteredHistory,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingStock.id);

        if (updateError) {
          console.error(`Error updating stock ${keyword}:`, updateError);
        } else {
          console.log(`Updated ${keyword}: ${calculatedValue} (was ${existingStock.current_value})`);
        }
      } else {
        // Create new stock
        const { error: insertError } = await supabase.from("meme_stocks").insert({
          meme_keyword: keyword,
          current_value: calculatedValue,
          is_active: true,
          history: [
            {
              timestamp: new Date().toISOString(),
              value: calculatedValue,
            },
          ],
        });

        if (insertError) {
          console.error(`Error creating stock ${keyword}:`, insertError);
        } else {
          console.log(`Created new stock ${keyword}: ${calculatedValue}`);
        }
      }
    }

    // Deactivate stocks that are no longer trending
    const activeKeywords = new Set(significantKeywords.map(([keyword]) => keyword));
    const stocksToDeactivate = existingStocks.filter(
      (stock) => stock.is_active && !activeKeywords.has(stock.meme_keyword)
    );

    for (const stock of stocksToDeactivate) {
      const { error: deactivateError } = await supabase
        .from("meme_stocks")
        .update({ is_active: false })
        .eq("id", stock.id);

      if (deactivateError) {
        console.error(`Error deactivating stock ${stock.meme_keyword}:`, deactivateError);
      } else {
        console.log(`Deactivated stock: ${stock.meme_keyword}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Meme market updated successfully",
        processed_keywords: significantKeywords.length,
        deactivated_stocks: stocksToDeactivate.length,
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
