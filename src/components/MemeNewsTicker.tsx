import { useEffect, useState, useRef } from "react";
import { Newspaper, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { supabase } from "../lib/supabase";

interface MemeStock {
  id: string;
  meme_keyword: string;
  current_value: number;
  history: Array<{ timestamp: string; value: number }>;
}

interface NewsItem {
  id: string;
  text: string;
  type: "positive" | "negative" | "neutral" | "breaking";
}

// Financial jargon for dramatic effect
const positiveJargon = [
  "skyrocketing",
  "mooning",
  "surging",
  "exploding upward",
  "breaking resistance levels",
  "outperforming the market",
  "defying gravity",
  "on a bull run",
  "showing unprecedented growth",
  "crushing expectations",
];

const negativeJargon = [
  "plummeting",
  "in free fall",
  "crashing hard",
  "tanking",
  "collapsing",
  "bleeding out",
  "breaking support levels",
  "facing a liquidity crisis",
  "experiencing a correction",
  "under massive sell pressure",
];

const neutralJargon = [
  "consolidating",
  "trading sideways",
  "showing mixed signals",
  "at a crossroads",
  "testing key levels",
  "seeking direction",
  "in accumulation phase",
  "maintaining equilibrium",
  "showing market indecision",
  "awaiting catalyst",
];

// Dramatic news templates
const newsTemplates = {
  positive: [
    "BREAKING: #{keyword} has seen a #{percentage}% surge as #{reason}!",
    "ALERT: #{keyword} is #{jargon} with a #{percentage}% gain after #{reason}!",
    "MARKET FRENZY: Investors pile into #{keyword} driving a #{percentage}% rally as #{reason}!",
    "BULL ALERT: #{keyword} defies gravity with a #{percentage}% upward explosion!",
    "HOT TAKE: Analysts stunned as #{keyword} rockets #{percentage}% in what experts call 'unprecedented momentum'!",
  ],
  negative: [
    "BREAKING: #{keyword} has #{jargon} by #{percentage}% as #{reason}!",
    "MARKET PANIC: #{keyword} investors facing catastrophic #{percentage}% losses after #{reason}!",
    "SELL-OFF ALERT: #{keyword} experiences #{percentage}% death spiral as #{reason}!",
    "BEAR MARKET: #{keyword} collapses #{percentage}% in what analysts call 'the great meme recession'!",
    "FLASH CRASH: #{keyword} plunges #{percentage}% in minutes as #{reason}!",
  ],
  neutral: [
    "MARKET WATCH: #{keyword} #{jargon} at #{value} chips as #{reason}.",
    "ANALYSIS: #{keyword} shows #{jargon} pattern as traders await #{reason}.",
    "TECHNICAL ALERT: #{keyword} enters #{jargon} phase at #{value} chips per share.",
    "TRADING DESK: #{keyword} exhibits classic #{jargon} behavior as #{reason}.",
    "MARKET INSIGHT: #{keyword} remains #{jargon} despite #{reason}.",
  ],
  breaking: [
    "🚨 MARKET DISRUPTION: The term '#{keyword}' has ENTERED THE MARKET at #{value} chips per share! Analysts predict MASSIVE VOLATILITY!",
    "🔥 NEW LISTING ALERT: '#{keyword}' debuts at #{value} chips in what experts call 'the meme event of the quarter'!",
    "⚡ BREAKING: '#{keyword}' has been DELISTED after catastrophic market performance! Investors left holding worthless meme bags!",
    "💥 MARKET SHOCK: '#{keyword}' SUSPENDED from trading after suspicious viral activity detected! Regulators investigating!",
    "🌋 MEME ERUPTION: '#{keyword}' experiences unprecedented #{percentage}% swing in what traders are calling 'The Great Meme Volatility Event of 2025'!",
  ],
};

// Reasons for price movements
const priceReasons = [
  "viral TikTok trend",
  "celebrity endorsement",
  "Reddit hivemind activity",
  "controversial Twitter post",
  "unexpected cultural relevance",
  "mainstream media coverage",
  "algorithmic trading bots",
  "coordinated meme campaign",
  "institutional investor interest",
  "unexpected use case discovery",
  "market manipulation concerns",
  "regulatory scrutiny",
  "competing meme emergence",
  "social sentiment shift",
  "generational appeal factors",
  "cross-platform virality metrics",
  "content creator adoption",
  "engagement multiplier effect",
  "memetic saturation point",
  "cultural relevance decay",
];

export function MemeNewsTicker() {
  const [stocks, setStocks] = useState<MemeStock[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const tickerRef = useRef<HTMLDivElement>(null);

  // Fetch stocks data
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const { data, error } = await supabase
          .from("meme_stocks")
          .select("id, meme_keyword, current_value, history")
          .eq("is_active", true);

        if (error) throw error;
        setStocks(data || []);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching stocks for news ticker:", error);
        setLoading(false);
      }
    };

    fetchStocks();

    // Set up a subscription for real-time updates
    const stocksSubscription = supabase
      .channel("meme_stocks_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "meme_stocks" }, () => {
        fetchStocks();
      })
      .subscribe();

    // Refresh every 2 minutes
    const interval = setInterval(fetchStocks, 2 * 60 * 1000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(stocksSubscription);
    };
  }, []);

  // Generate news items from stocks data
  useEffect(() => {
    if (stocks.length === 0) return;
    
    console.log("Generating news items from stocks data...");

    const generateNewsItems = () => {
      const items: NewsItem[] = [];

      // Process each stock for potential news
      stocks.forEach((stock) => {
        // Skip stocks with insufficient history
        if (!stock.history || stock.history.length < 2) return;

        // Calculate price change
        const recentHistory = stock.history.slice(-5); // Last 5 history points
        const oldestValue = recentHistory[0].value;
        const currentValue = stock.current_value;
        const percentageChange = ((currentValue - oldestValue) / oldestValue) * 100;
        const absChange = Math.abs(percentageChange);

        // Only create news for significant changes (>5%)
        if (absChange >= 5) {
          const type = percentageChange > 0 ? "positive" : "negative";
          const templates = newsTemplates[type];
          const jargonList = type === "positive" ? positiveJargon : negativeJargon;
          
          // Select random template and jargon
          const template = templates[Math.floor(Math.random() * templates.length)];
          const jargon = jargonList[Math.floor(Math.random() * jargonList.length)];
          const reason = priceReasons[Math.floor(Math.random() * priceReasons.length)];
          
          // Create news text
          const newsText = template
            .replace("#{keyword}", stock.meme_keyword)
            .replace("#{percentage}", absChange.toFixed(1))
            .replace("#{jargon}", jargon)
            .replace("#{value}", stock.current_value.toString())
            .replace("#{reason}", reason);
          
          items.push({
            id: `${stock.id}-${Date.now()}`,
            text: newsText,
            type: type,
          });
        } else if (Math.random() < 0.3) { // 30% chance for neutral news
          const templates = newsTemplates.neutral;
          const jargon = neutralJargon[Math.floor(Math.random() * neutralJargon.length)];
          const reason = priceReasons[Math.floor(Math.random() * priceReasons.length)];
          
          const template = templates[Math.floor(Math.random() * templates.length)];
          const newsText = template
            .replace("#{keyword}", stock.meme_keyword)
            .replace("#{jargon}", jargon)
            .replace("#{value}", stock.current_value.toString())
            .replace("#{reason}", reason);
          
          items.push({
            id: `${stock.id}-${Date.now()}-neutral`,
            text: newsText,
            type: "neutral",
          });
        }
      });

      // Add occasional breaking news (new listings, delistings, etc.)
      if (Math.random() < 0.3 && stocks.length > 0) {
        const randomStock = stocks[Math.floor(Math.random() * stocks.length)];
        const templates = newsTemplates.breaking;
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        const newsText = template
          .replace("#{keyword}", randomStock.meme_keyword)
          .replace("#{value}", randomStock.current_value.toString())
          .replace("#{percentage}", (Math.random() * 50 + 20).toFixed(1));
        
        items.push({
          id: `breaking-${Date.now()}`,
          text: newsText,
          type: "breaking",
        });
      }

      // Ensure we have at least some news
      if (items.length === 0 && stocks.length > 0) {
        const randomStock = stocks[Math.floor(Math.random() * stocks.length)];
        const randomType = Math.random() > 0.5 ? "positive" : "negative";
        const templates = newsTemplates[randomType];
        const jargonList = randomType === "positive" ? positiveJargon : negativeJargon;
        
        const template = templates[Math.floor(Math.random() * templates.length)];
        const jargon = jargonList[Math.floor(Math.random() * jargonList.length)];
        const reason = priceReasons[Math.floor(Math.random() * priceReasons.length)];
        
        const newsText = template
          .replace("#{keyword}", randomStock.meme_keyword)
          .replace("#{percentage}", (Math.random() * 15 + 5).toFixed(1))
          .replace("#{jargon}", jargon)
          .replace("#{value}", randomStock.current_value.toString())
          .replace("#{reason}", reason);
        
        items.push({
          id: `fallback-${Date.now()}`,
          text: newsText,
          type: randomType,
        });
      }

      return items;
    };

    // Generate initial news
    setNewsItems(generateNewsItems());

    // Regenerate news more frequently (every 15 seconds)
    const newsInterval = setInterval(() => {
      console.log("Regenerating news items...");
      setNewsItems(generateNewsItems());
    }, 15000);

    return () => clearInterval(newsInterval);
  }, [stocks]);

  // Ticker animation
  useEffect(() => {
    if (!tickerRef.current || newsItems.length === 0) return;

    const ticker = tickerRef.current;
    const firstItem = ticker.firstElementChild as HTMLElement;
    
    if (!firstItem) return;

    const animateTicker = () => {
      const tickerWidth = ticker.offsetWidth;
      const firstItemWidth = firstItem.offsetWidth;
      
      // Only animate if content is wider than container
      if (firstItemWidth > tickerWidth) {
        const duration = firstItemWidth * 20; // Speed based on content length
        
        ticker.animate(
          [
            { transform: "translateX(0)" },
            { transform: `translateX(-${firstItemWidth}px)` },
          ],
          {
            duration,
            iterations: 1,
            easing: "linear",
          }
        ).onfinish = () => {
          // Move first item to the end
          ticker.appendChild(firstItem);
          animateTicker();
        };
      } else {
        // If content is shorter than container, just wait and rotate
        setTimeout(() => {
          ticker.appendChild(firstItem);
          animateTicker();
        }, 5000);
      }
    };

    animateTicker();
  }, [newsItems]);

  if (loading || newsItems.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white py-2 overflow-hidden border-y border-blue-500 shadow-md">
      <div className="flex items-center">
        <div className="flex-shrink-0 px-3 border-r border-blue-500 flex items-center gap-2">
          <Newspaper className="h-4 w-4 animate-pulse" />
          <span className="font-bold text-sm whitespace-nowrap">LIVE MEME NEWS</span>
        </div>
        <div className="overflow-hidden flex-1 relative">
          <div ref={tickerRef} className="flex whitespace-nowrap">
            {newsItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center px-4 gap-2"
              >
                {item.type === "positive" && <TrendingUp className="h-4 w-4 text-green-300" />}
                {item.type === "negative" && <TrendingDown className="h-4 w-4 text-red-300" />}
                {item.type === "breaking" && <Zap className="h-4 w-4 text-yellow-300 animate-pulse" />}
                <span className={`text-sm font-medium ${
                  item.type === "positive" ? "text-green-300" :
                  item.type === "negative" ? "text-red-300" :
                  item.type === "breaking" ? "text-yellow-300 font-bold" :
                  "text-white"
                }`}>
                  {item.text}
                </span>
                <span className="mx-2 text-blue-300">•</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}