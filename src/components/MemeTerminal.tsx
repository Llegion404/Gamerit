import { useState, useEffect, useCallback, useRef } from "react";
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart3, Zap, AlertTriangle, Target, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProgression } from "../hooks/useProgression";
import toast from "react-hot-toast";

interface MemeStock {
  id: string;
  meme_keyword: string;
  current_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  history: Array<{ timestamp: string; value: number }>;
  mention_count?: number;
  sentiment_score?: number;
  volatility?: number;
  volume_24h?: number;
}

interface LiveUpdate {
  keyword: string;
  mentions: number;
  sentiment: number;
  price_change: number;
  timestamp: string;
}

interface Portfolio {
  id: string;
  stock_id: string;
  shares_owned: number;
  average_buy_price: number;
  meme_stocks: MemeStock;
}

interface OrderBook {
  keyword: string;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
}

export function MemeTerminal() {
  const { player, redditUser } = useAuth();
  const { awardXP } = useProgression(redditUser?.name || null);
  
  // Core state
  const [stocks, setStocks] = useState<MemeStock[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [selectedStock, setSelectedStock] = useState<MemeStock | null>(null);
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<"market" | "portfolio" | "orders" | "news">("market");
  const [sortBy, setSortBy] = useState<"price" | "change" | "volume" | "mentions">("change");
  const [filterBy, setFilterBy] = useState<"all" | "gainers" | "losers" | "trending">("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Trading state
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  
  // Real-time updates
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);
  const updateIntervalRef = useRef<NodeJS.Timeout>();
  const audioRef = useRef<HTMLAudioElement>();

  // Initialize audio for trading sounds
  useEffect(() => {
    audioRef.current = new Audio();
  }, []);

  const playSound = (type: "buy" | "sell" | "alert") => {
    if (!soundEnabled || !audioRef.current) return;
    
    // Create simple beep sounds using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different frequencies for different actions
    const frequencies = {
      buy: 800,
      sell: 600,
      alert: 1000
    };
    
    oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime);
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  // Fetch stocks with enhanced data
  const fetchStocks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("meme_stocks")
        .select("*")
        .eq("is_active", true)
        .order("current_value", { ascending: false });

      if (error) throw error;

      // Enhance stocks with simulated real-time data
      const enhancedStocks = (data || []).map(stock => ({
        ...stock,
        mention_count: Math.floor(Math.random() * 1000) + 50,
        sentiment_score: Math.random() * 2 - 1, // -1 to 1
        volatility: Math.random() * 0.5 + 0.1, // 0.1 to 0.6
        volume_24h: Math.floor(Math.random() * 10000) + 1000,
      }));

      setStocks(enhancedStocks);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching stocks:", error);
      toast.error("Failed to load market data");
    }
  }, []);

  // Fetch portfolio
  const fetchPortfolio = useCallback(async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from("player_portfolios")
        .select(`
          *,
          meme_stocks!inner(*)
        `)
        .eq("player_id", player.id)
        .gt("shares_owned", 0);

      if (error) throw error;
      setPortfolio(data || []);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
    }
  }, [player]);

  // Generate live updates
  const generateLiveUpdate = useCallback(() => {
    if (stocks.length === 0) return;

    const randomStock = stocks[Math.floor(Math.random() * stocks.length)];
    const priceChange = (Math.random() - 0.5) * 0.2; // ±10% max change
    const newPrice = Math.max(1, Math.floor(randomStock.current_value * (1 + priceChange)));
    
    const update: LiveUpdate = {
      keyword: randomStock.meme_keyword,
      mentions: Math.floor(Math.random() * 100) + 10,
      sentiment: Math.random() * 2 - 1,
      price_change: priceChange,
      timestamp: new Date().toISOString(),
    };

    setLiveUpdates(prev => [update, ...prev.slice(0, 19)]); // Keep last 20 updates

    // Update stock price
    setStocks(prev => prev.map(stock => 
      stock.meme_keyword === randomStock.meme_keyword
        ? { ...stock, current_value: newPrice }
        : stock
    ));

    // Play sound for significant changes
    if (Math.abs(priceChange) > 0.05) {
      playSound(priceChange > 0 ? "buy" : "sell");
    }
  }, [stocks, soundEnabled]);

  // Real-time updates
  useEffect(() => {
    if (isLive) {
      updateIntervalRef.current = setInterval(() => {
        generateLiveUpdate();
      }, 2000 + Math.random() * 3000); // Random interval 2-5 seconds
    } else {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isLive, generateLiveUpdate]);

  // Initial data load
  useEffect(() => {
    fetchStocks();
    fetchPortfolio();
  }, [fetchStocks, fetchPortfolio]);

  // Calculate portfolio metrics
  const portfolioValue = portfolio.reduce((total, item) => {
    return total + item.shares_owned * item.meme_stocks.current_value;
  }, 0);

  const totalInvested = portfolio.reduce((total, item) => {
    return total + item.shares_owned * item.average_buy_price;
  }, 0);

  const totalPnL = portfolioValue - totalInvested;
  const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // Filter and sort stocks
  const filteredStocks = stocks
    .filter(stock => {
      if (filterBy === "all") return true;
      if (filterBy === "gainers") return (stock.history?.length || 0) > 1 && 
        stock.current_value > (stock.history?.[stock.history.length - 2]?.value || stock.current_value);
      if (filterBy === "losers") return (stock.history?.length || 0) > 1 && 
        stock.current_value < (stock.history?.[stock.history.length - 2]?.value || stock.current_value);
      if (filterBy === "trending") return (stock.mention_count || 0) > 200;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price":
          return b.current_value - a.current_value;
        case "change":
          const aChange = a.history?.length > 1 ? 
            (a.current_value - a.history[a.history.length - 2].value) / a.history[a.history.length - 2].value : 0;
          const bChange = b.history?.length > 1 ? 
            (b.current_value - b.history[b.history.length - 2].value) / b.history[b.history.length - 2].value : 0;
          return bChange - aChange;
        case "volume":
          return (b.volume_24h || 0) - (a.volume_24h || 0);
        case "mentions":
          return (b.mention_count || 0) - (a.mention_count || 0);
        default:
          return 0;
      }
    });

  // Place order
  const placeOrder = async () => {
    if (!selectedStock || !player || !orderQuantity) return;

    setIsPlacingOrder(true);
    try {
      const quantity = parseInt(orderQuantity);
      const price = orderType === "market" ? selectedStock.current_value : parseInt(orderPrice);
      const totalCost = quantity * price;

      if (orderSide === "buy") {
        if (player.points < totalCost) {
          toast.error("Insufficient karma chips");
          return;
        }

        // Execute buy order
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buy-meme-stock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            player_id: player.id,
            stock_id: selectedStock.id,
            amount_in_chips: totalCost,
          }),
        });

        const result = await response.json();
        if (result.success) {
          toast.success(`🚀 Bought ${quantity} shares of $${selectedStock.meme_keyword.toUpperCase()}!`);
          playSound("buy");
          
          // Award XP for trading
          if (redditUser?.name) {
            await awardXP(5, "Executed meme stock trade", {
              action: "buy",
              stock: selectedStock.meme_keyword,
              quantity,
              price,
            });
          }
        } else {
          toast.error(result.error);
        }
      } else {
        // Execute sell order (simplified)
        const portfolioItem = portfolio.find(p => p.stock_id === selectedStock.id);
        if (!portfolioItem || portfolioItem.shares_owned < quantity) {
          toast.error("Insufficient shares");
          return;
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sell-meme-stock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            player_id: player.id,
            stock_id: selectedStock.id,
            shares_to_sell: quantity,
          }),
        });

        const result = await response.json();
        if (result.success) {
          toast.success(`💰 Sold ${quantity} shares of $${selectedStock.meme_keyword.toUpperCase()}!`);
          playSound("sell");
          
          if (redditUser?.name) {
            await awardXP(5, "Executed meme stock trade", {
              action: "sell",
              stock: selectedStock.meme_keyword,
              quantity,
              price,
            });
          }
        } else {
          toast.error(result.error);
        }
      }

      // Reset form and refresh data
      setOrderQuantity("");
      setOrderPrice("");
      fetchPortfolio();
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error("Failed to execute trade");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Get price change data
  const getPriceChange = (stock: MemeStock) => {
    if (!stock.history || stock.history.length < 2) return { change: 0, percentage: 0 };
    
    const current = stock.current_value;
    const previous = stock.history[stock.history.length - 2]?.value || current;
    const change = current - previous;
    const percentage = previous > 0 ? (change / previous) * 100 : 0;
    
    return { change, percentage };
  };

  if (!player || !redditUser) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-card rounded-lg border p-8 text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-4">Meme Terminal</h2>
          <p className="text-muted-foreground">Please log in to access the professional meme trading platform.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Terminal Header */}
      <div className="bg-black text-green-400 rounded-lg p-4 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span className="text-lg font-bold">MEME TERMINAL v2.0</span>
            </div>
            <div className={`flex items-center space-x-1 ${isLive ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm">{isLive ? 'LIVE' : 'PAUSED'}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="text-gray-400">PORTFOLIO:</span>
              <span className={`ml-2 font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {portfolioValue.toLocaleString()} KC
              </span>
              <span className={`ml-2 ${pnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%)
              </span>
            </div>
            
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1 hover:bg-gray-800 rounded"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            
            <button
              onClick={() => setIsLive(!isLive)}
              className="p-1 hover:bg-gray-800 rounded"
            >
              <RefreshCw className={`w-4 h-4 ${isLive ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-gray-400">
          Last Update: {lastUpdate.toLocaleTimeString()} | 
          Active Positions: {portfolio.length} | 
          Available: {player.points.toLocaleString()} KC
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Market Data Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Market Controls */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Market Overview</h3>
              <div className="flex space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border border-border rounded px-2 py-1 bg-background"
                >
                  <option value="change">% Change</option>
                  <option value="price">Price</option>
                  <option value="volume">Volume</option>
                  <option value="mentions">Mentions</option>
                </select>
                
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as any)}
                  className="text-sm border border-border rounded px-2 py-1 bg-background"
                >
                  <option value="all">All Stocks</option>
                  <option value="gainers">Gainers</option>
                  <option value="losers">Losers</option>
                  <option value="trending">Trending</option>
                </select>
              </div>
            </div>

            {/* Stock List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredStocks.map((stock) => {
                const { change, percentage } = getPriceChange(stock);
                const isSelected = selectedStock?.id === stock.id;
                
                return (
                  <div
                    key={stock.id}
                    onClick={() => setSelectedStock(stock)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="font-mono font-bold text-lg">
                          ${stock.meme_keyword.toUpperCase()}
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span>{stock.mention_count} mentions</span>
                          <span>•</span>
                          <span className={stock.sentiment_score! > 0 ? 'text-green-500' : 'text-red-500'}>
                            {stock.sentiment_score! > 0 ? '😊' : '😞'} {Math.abs(stock.sentiment_score!).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {stock.current_value.toLocaleString()} KC
                        </div>
                        <div className={`text-sm flex items-center ${
                          percentage >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {percentage >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {percentage >= 0 ? '+' : ''}{percentage.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Vol: {stock.volume_24h?.toLocaleString()}</span>
                      <span>Volatility: {((stock.volatility || 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Trading Panel */}
        <div className="space-y-4">
          {/* Order Entry */}
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-lg font-semibold mb-4">Place Order</h3>
            
            {selectedStock ? (
              <div className="space-y-4">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <div className="font-mono font-bold text-lg">
                    ${selectedStock.meme_keyword.toUpperCase()}
                  </div>
                  <div className="text-2xl font-bold">
                    {selectedStock.current_value.toLocaleString()} KC
                  </div>
                </div>

                {/* Order Type */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => setOrderType("market")}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      orderType === "market" 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Market
                  </button>
                  <button
                    onClick={() => setOrderType("limit")}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      orderType === "limit" 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Limit
                  </button>
                </div>

                {/* Buy/Sell */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => setOrderSide("buy")}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      orderSide === "buy" 
                        ? 'bg-green-600 text-white' 
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => setOrderSide("sell")}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      orderSide === "sell" 
                        ? 'bg-red-600 text-white' 
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    SELL
                  </button>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    placeholder="Number of shares"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    min="1"
                  />
                </div>

                {/* Price (for limit orders) */}
                {orderType === "limit" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Price (KC)</label>
                    <input
                      type="number"
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(e.target.value)}
                      placeholder="Price per share"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                      min="1"
                    />
                  </div>
                )}

                {/* Order Summary */}
                {orderQuantity && (
                  <div className="p-3 bg-secondary/50 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span>Estimated Total:</span>
                      <span className="font-bold">
                        {(parseInt(orderQuantity) * (orderType === "market" ? selectedStock.current_value : parseInt(orderPrice || "0"))).toLocaleString()} KC
                      </span>
                    </div>
                  </div>
                )}

                {/* Place Order Button */}
                <button
                  onClick={placeOrder}
                  disabled={isPlacingOrder || !orderQuantity || (orderType === "limit" && !orderPrice)}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-colors ${
                    orderSide === "buy" 
                      ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400' 
                      : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                  } disabled:cursor-not-allowed`}
                >
                  {isPlacingOrder ? (
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Executing...</span>
                    </div>
                  ) : (
                    `${orderSide.toUpperCase()} ${selectedStock.meme_keyword.toUpperCase()}`
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select a stock to place an order</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Feed & Portfolio */}
        <div className="space-y-4">
          {/* Live Updates */}
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-yellow-500" />
              Live Feed
            </h3>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {liveUpdates.map((update, index) => (
                <div key={index} className="text-xs p-2 bg-secondary/30 rounded border-l-2 border-primary">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold">${update.keyword.toUpperCase()}</span>
                    <span className={`font-bold ${update.price_change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {update.price_change >= 0 ? '+' : ''}{(update.price_change * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {update.mentions} mentions • Sentiment: {update.sentiment > 0 ? '😊' : '😞'} {Math.abs(update.sentiment).toFixed(2)}
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(update.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio Summary */}
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-lg font-semibold mb-4">Portfolio</h3>
            
            {portfolio.length > 0 ? (
              <div className="space-y-3">
                {portfolio.map((item) => {
                  const currentValue = item.shares_owned * item.meme_stocks.current_value;
                  const invested = item.shares_owned * item.average_buy_price;
                  const pnl = currentValue - invested;
                  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

                  return (
                    <div key={item.id} className="p-3 bg-secondary/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold">
                          ${item.meme_stocks.meme_keyword.toUpperCase()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {item.shares_owned} shares
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {currentValue.toLocaleString()} KC
                        </span>
                        <span className={`text-sm font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()} KC
                          <br />
                          ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No positions</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Market Status Bar */}
      <div className="bg-black text-green-400 rounded-lg p-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span>MARKET STATUS: {isLive ? 'OPEN' : 'CLOSED'}</span>
            <span>ACTIVE STOCKS: {stocks.length}</span>
            <span>TOTAL VOLUME: {stocks.reduce((sum, s) => sum + (s.volume_24h || 0), 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>GAINERS: {filteredStocks.filter(s => getPriceChange(s).percentage > 0).length}</span>
            <span>LOSERS: {filteredStocks.filter(s => getPriceChange(s).percentage < 0).length}</span>
            <span className="animate-pulse">● LIVE DATA</span>
          </div>
        </div>
      </div>
    </div>
  );
}