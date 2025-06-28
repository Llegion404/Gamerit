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
    ups?: number;
    downs?: number;
    controversiality?: number;
    distinguished?: string;
    stickied?: boolean;
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
    ups?: number;
    downs?: number;
    upvote_ratio?: number;
    over_18?: boolean;
    removed_by_category?: string;
    banned_by?: string;
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
  quality_score: number;
}

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Comprehensive validation functions
function isValidContent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const cleanText = text.trim().toLowerCase();
  
  // Basic length requirements
  if (cleanText.length < 15 || cleanText.length > 500) return false;
  
  // Check for deleted/removed content
  if (cleanText.includes('[deleted]') || cleanText.includes('[removed]')) return false;
  
  // Check for common spam/promotion indicators
  const promotionKeywords = [
    'buy now', 'click here', 'visit my', 'check out my', 'subscribe to',
    'follow me', 'dm me', 'message me for', 'selling', 'for sale',
    'discount code', 'promo code', 'affiliate', 'sponsored',
    'onlyfans', 'cashapp', 'venmo', 'paypal.me', 'gofundme',
    'bitcoin', 'crypto', 'investment opportunity', 'make money',
    'work from home', 'earn $', 'get rich', 'financial freedom'
  ];
  
  for (const keyword of promotionKeywords) {
    if (cleanText.includes(keyword)) return false;
  }
  
  // Check for excessive links or promotional patterns
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const urls = text.match(urlPattern) || [];
  if (urls.length > 1) return false; // Allow max 1 URL
  
  // Check for excessive capitalization (likely spam)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.3) return false;
  
  // Check for excessive punctuation (spam indicator)
  const punctuationRatio = (text.match(/[!?]{2,}/g) || []).length;
  if (punctuationRatio > 2) return false;
  
  // Check for bot-like patterns
  const botPatterns = [
    /^i am a bot/i,
    /this action was performed automatically/i,
    /beep boop/i,
    /^bot here/i,
    /automated message/i
  ];
  
  for (const pattern of botPatterns) {
    if (pattern.test(text)) return false;
  }
  
  return true;
}

function isValidAuthor(author: string): boolean {
  if (!author || author === '[deleted]' || author === 'AutoModerator') return false;
  
  // Check for bot-like usernames
  const botPatterns = [
    /bot$/i,
    /^auto/i,
    /moderator$/i,
    /^reddit/i,
    /^u\/\[deleted\]/i
  ];
  
  for (const pattern of botPatterns) {
    if (pattern.test(author)) return false;
  }
  
  return true;
}

function calculateQualityScore(item: RedditComment | RedditPost): number {
  let score = 0;
  const data = item.data;
  
  // Base score from upvotes (capped to prevent skewing)
  score += Math.min(data.score || 0, 100) * 0.1;
  
  // Bonus for positive score
  if ((data.score || 0) > 0) score += 10;
  
  // Bonus for higher upvote ratio (posts only)
  if ('upvote_ratio' in data && data.upvote_ratio) {
    score += data.upvote_ratio * 20;
  }
  
  // Penalty for controversial content (comments)
  if ('controversiality' in data && data.controversiality) {
    score -= data.controversiality * 5;
  }
  
  // Bonus for non-distinguished content (not mod/admin posts)
  if (!data.distinguished) score += 5;
  
  // Bonus for non-stickied content
  if (!data.stickied) score += 5;
  
  // Text quality bonus
  const text = 'body' in data ? data.body : data.selftext || data.title;
  if (text) {
    // Bonus for good length
    if (text.length >= 50 && text.length <= 300) score += 10;
    
    // Bonus for proper punctuation
    if (/[.!?]$/.test(text.trim())) score += 5;
    
    // Bonus for complete sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length >= 1) score += 5;
    
    // Penalty for excessive repetition
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.7) score -= 10;
  }
  
  // Age bonus (prefer content that's not too old or too new)
  const ageHours = (Date.now() / 1000 - data.created_utc) / 3600;
  if (ageHours >= 1 && ageHours <= 168) { // 1 hour to 1 week old
    score += 5;
  }
  
  return Math.max(0, score);
}

function isPromotionalContent(text: string): boolean {
  const promotionalPatterns = [
    // Direct sales
    /\b(buy|purchase|order|shop)\s+(now|today|here)\b/i,
    /\b(for sale|selling|available)\b/i,
    /\$([\d,]+)/g, // Price mentions
    
    // Social media promotion
    /\b(follow|subscribe|like|share)\s+(me|my|us)\b/i,
    /\b(instagram|twitter|youtube|tiktok|facebook)\s*[@:]?\s*\w+/i,
    
    // Contact requests
    /\b(dm|message|contact|email)\s+(me|us)\b/i,
    /\b(whatsapp|telegram|discord)\b/i,
    
    // Financial schemes
    /\b(make money|earn \$|passive income|side hustle)\b/i,
    /\b(investment|trading|forex|crypto)\s+(opportunity|tips|signals)\b/i,
    
    // Referral/affiliate
    /\b(referral|affiliate|promo|discount)\s+(code|link)\b/i,
    /\b(use my code|sign up with)\b/i,
  ];
  
  return promotionalPatterns.some(pattern => pattern.test(text));
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

    // Curated subreddits known for quality content and minimal spam
    const oracleSubreddits = [
      "gardening",
      "cooking",
      "showerthoughts",
      "lifeprotips",
      "explainlikeimfive",
      "todayilearned",
      "askreddit",
      "books",
      "philosophy",
      "science",
      "getmotivated",
      "meditation",
      "productivity",
      "personalfinance",
      "fitness",
      "nutrition",
      "psychology",
      "history",
      "nature",
      "travel",
      "art",
      "writing",
      "diy",
      "crafts",
      "minimalism",
      "zerowaste",
      "wholesomememes",
      "mademesmile",
      "humansbeingbros"
    ];

    // Randomly select 4-6 subreddits for variety
    const selectedSubreddits = oracleSubreddits
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 3) + 4);

    console.log(`Consulting subreddits: ${selectedSubreddits.join(", ")}`);

    const allWisdom: OracleAnswer[] = [];

    // Fetch wisdom from selected subreddits
    for (const subreddit of selectedSubreddits) {
      try {
        // Prefer hot and top content for quality
        const sortTypes = ["hot", "top?t=week", "top?t=day"];
        const sortType = sortTypes[Math.floor(Math.random() * sortTypes.length)];
        
        const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/${sortType}?limit=30`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "User-Agent": "RedditOracle/1.0",
          },
        });

        if (response.ok) {
          const data: RedditResponse = await response.json();
          
          // Extract and validate wisdom from posts
          for (const item of data.data.children) {
            // Skip if author is invalid
            if (!isValidAuthor(item.data.author)) continue;
            
            // Skip NSFW content
            if ('over_18' in item.data && item.data.over_18) continue;
            
            // Skip removed content
            if ('removed_by_category' in item.data && item.data.removed_by_category) continue;
            if ('banned_by' in item.data && item.data.banned_by) continue;

            // For posts with text content
            if ("selftext" in item.data && item.data.selftext) {
              const text = item.data.selftext.trim();
              if (isValidContent(text) && !isPromotionalContent(text)) {
                const qualityScore = calculateQualityScore(item);
                if (qualityScore >= 20) { // Minimum quality threshold
                  allWisdom.push({
                    text: text,
                    subreddit: item.data.subreddit,
                    author: item.data.author,
                    score: item.data.score,
                    quality_score: qualityScore,
                  });
                }
              }
            }

            // For post titles that could be wisdom (from certain subreddits)
            if (["showerthoughts", "lifeprotips", "getmotivated"].includes(subreddit.toLowerCase())) {
              if ("title" in item.data && item.data.title.length > 20 && item.data.title.length < 200) {
                const text = item.data.title;
                if (isValidContent(text) && !isPromotionalContent(text)) {
                  const qualityScore = calculateQualityScore(item);
                  if (qualityScore >= 15) {
                    allWisdom.push({
                      text: text,
                      subreddit: item.data.subreddit,
                      author: item.data.author,
                      score: item.data.score,
                      quality_score: qualityScore,
                    });
                  }
                }
              }
            }
          }

          // Get high-quality comments from top posts
          const topPosts = data.data.children
            .filter(item => "num_comments" in item.data && (item.data as any).num_comments > 10)
            .filter(item => item.data.score > 50) // Only from well-received posts
            .slice(0, 3); // Limit to top 3 posts

          for (const post of topPosts) {
            try {
              const commentsResponse = await fetch(
                `https://oauth.reddit.com/r/${subreddit}/comments/${post.data.id}?limit=15&sort=top`,
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

                for (const comment of comments.slice(0, 8)) {
                  if (!isValidAuthor(comment.data.author)) continue;
                  
                  const text = comment.data.body;
                  if (
                    text &&
                    isValidContent(text) &&
                    !isPromotionalContent(text) &&
                    comment.data.score >= 5 // Minimum upvotes for comments
                  ) {
                    const qualityScore = calculateQualityScore(comment);
                    if (qualityScore >= 25) { // Higher threshold for comments
                      allWisdom.push({
                        text: text,
                        subreddit: comment.data.subreddit,
                        author: comment.data.author,
                        score: comment.data.score,
                        quality_score: qualityScore,
                      });
                    }
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

    console.log(`Found ${allWisdom.length} pieces of validated wisdom`);

    // Sort by quality score and select from top tier
    allWisdom.sort((a, b) => b.quality_score - a.quality_score);
    
    // Select from top 30% of quality content
    const topTierCount = Math.max(1, Math.floor(allWisdom.length * 0.3));
    const topTierWisdom = allWisdom.slice(0, topTierCount);
    
    // Randomly select from top tier
    const selectedWisdom = topTierWisdom[Math.floor(Math.random() * topTierWisdom.length)];

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
      .replace(/\/s\s*$/i, "") // Remove sarcasm tags
      .trim();

    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(cleanedText)) {
      cleanedText += ".";
    }

    console.log(`Oracle wisdom selected from r/${selectedWisdom.subreddit} (quality: ${selectedWisdom.quality_score}): "${cleanedText.substring(0, 50)}..."`);

    return new Response(
      JSON.stringify({
        success: true,
        answer: {
          text: cleanedText,
          subreddit: selectedWisdom.subreddit,
          author: selectedWisdom.author,
          score: selectedWisdom.score,
          quality_score: selectedWisdom.quality_score,
        },
        question: question,
        consulted_subreddits: selectedSubreddits,
        total_wisdom_found: allWisdom.length,
        quality_filtered: true,
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