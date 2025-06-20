import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus, DollarSign, Briefcase, BarChart3, X, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

interface MemeStock {
  id: string;
  meme_keyword: string;
  current_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  history: Array<{ timestamp: string; value: number }>;
}

interface PlayerPortfolio {
  id: string;
  player_id: string;
  stock_id: string;
  shares_owned: number;
  average_buy_price: number;
  created_at: string;
  updated_at: string;
  meme_stocks: MemeStock;
}

interface Player {
  id: string;
  reddit_username: string;
  points: number;
}

interface MemeMarketProps {
  player: Player | null;
  onRefreshPlayer: () => void;
}

export function MemeMarket({ player, onRefreshPlayer }: MemeMarketProps) {
  const [stocks, setStocks] = useState<MemeStock[]>([]);
  const [portfolio, setPortfolio] = useState<PlayerPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketUpdateLoading, setMarketUpdateLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"market" | "portfolio">("market");
  const [selectedStock, setSelectedStock] = useState<MemeStock | null>(null);
  const [buyAmount, setBuyAmount] = useState("");
  const [sellShares, setSellShares] = useState("");
  const [transactionLoading, setTransactionLoading] = useState(false);

  // Fetch active meme stocks
  const fetchStocks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("meme_stocks")
        .select("*")
        .eq("is_active", true)
        .order("current_value", { ascending: false });

      if (error) throw error;
      setStocks(data || []);
    } catch (error) {
      console.error("Error fetching stocks:", error);
      toast.error("Failed to load meme stocks");
    }
  }, []);

  // Fetch player portfolio
  const fetchPortfolio = useCallback(async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from("player_portfolios")
        .select(
          `
          *,
          meme_stocks!inner(*)
        `
        )
        .eq("player_id", player.id)
        .gt("shares_owned", 0);

      if (error) throw error;
      setPortfolio(data || []);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      toast.error("Failed to load portfolio");
    }
  }, [player]);

  // Load data on component mount and when player changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStocks(), fetchPortfolio()]);
      setLoading(false);
    };
    loadData();
  }, [fetchStocks, fetchPortfolio]);

  // Calculate trend for a stock
  const getStockTrend = (stock: MemeStock) => {
    if (!stock.history || stock.history.length < 2) return "neutral";

    const recent = stock.history.slice(-2);
    const previousValue = recent[0].value;
    const currentValue = recent[1].value;

    if (currentValue > previousValue) return "up";
    if (currentValue < previousValue) return "down";
    return "neutral";
  };

  // Calculate trend percentage
  const getTrendPercentage = (stock: MemeStock) => {
    if (!stock.history || stock.history.length < 2) return 0;

    const recent = stock.history.slice(-2);
    const previousValue = recent[0].value;
    const currentValue = recent[1].value;

    return ((currentValue - previousValue) / previousValue) * 100;
  };

  // Buy stock
  const buyStock = async () => {
    if (!player || !selectedStock || !buyAmount) return;

    const amount = parseInt(buyAmount);
    if (amount <= 0 || amount > player.points) {
      toast.error("Invalid amount");
      return;
    }

    setTransactionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buy-meme-stock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          player_id: player.id,
          stock_id: selectedStock.id,
          amount_in_chips: amount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Bought ${result.transaction.shares_bought} shares of ${result.transaction.stock_keyword}!`);
        setBuyAmount("");
        setSelectedStock(null);
        onRefreshPlayer();
        fetchPortfolio();
      } else {
        toast.error(result.error || "Failed to buy stock");
      }
    } catch (error) {
      console.error("Error buying stock:", error);
      toast.error("Failed to buy stock");
    } finally {
      setTransactionLoading(false);
    }
  };

  // Sell stock
  const sellStock = async (portfolioItem: PlayerPortfolio) => {
    if (!player || !sellShares) return;

    const shares = parseInt(sellShares);
    if (shares <= 0 || shares > portfolioItem.shares_owned) {
      toast.error("Invalid number of shares");
      return;
    }

    setTransactionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sell-meme-stock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          player_id: player.id,
          stock_id: portfolioItem.stock_id,
          shares_to_sell: shares,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const { transaction } = result;
        const profit = transaction.profit_loss > 0 ? "+" : "";
        toast.success(
          `Sold ${transaction.shares_sold} shares for ${transaction.total_payout} chips! ${profit}${Math.round(
            transaction.profit_loss
          )} profit`
        );
        setSellShares("");
        onRefreshPlayer();
        fetchPortfolio();
      } else {
        toast.error(result.error || "Failed to sell stock");
      }
    } catch (error) {
      console.error("Error selling stock:", error);
      toast.error("Failed to sell stock");
    } finally {
      setTransactionLoading(false);
    }
  };

  // Update meme market data
  const updateMarketData = async () => {
    setMarketUpdateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-meme-market");

      if (error) throw error;

      if (data?.success) {
        toast.success("Market data updated successfully!");
        await fetchStocks(); // Refresh stocks after update
      } else {
        throw new Error(data?.error || "Failed to update market");
      }
    } catch (error) {
      console.error("Error updating market:", error);
      toast.error("Failed to update market data");
    } finally {
      setMarketUpdateLoading(false);
    }
  };

  // Calculate portfolio total value
  const portfolioValue = portfolio.reduce((total, item) => {
    return total + item.shares_owned * item.meme_stocks.current_value;
  }, 0);

  // Calculate total profit/loss
  const totalInvested = portfolio.reduce((total, item) => {
    return total + item.shares_owned * item.average_buy_price;
  }, 0);

  const totalProfitLoss = portfolioValue - totalInvested;

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="flex items-center justify-center h-64 p-6">
          <div className="text-center">
            <BarChart3 className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Loading meme market...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Meme Market</h2>
          </div>
          <p className="text-muted-foreground mt-2">
            Trade meme stocks based on Reddit trends. Buy low, sell high, profit from viral content!
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="border-b border-border">
          <div className="flex justify-between items-center px-6">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("market")}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "market"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                Market
              </button>
              <button
                onClick={() => setActiveTab("portfolio")}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "portfolio"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                My Portfolio
              </button>
            </nav>
            <button
              onClick={updateMarketData}
              disabled={marketUpdateLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${marketUpdateLoading ? "animate-spin" : ""}`} />
              {marketUpdateLoading ? "Updating..." : "Update Market"}
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "market" && (
            <div className="space-y-4">
              {stocks.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Stocks</h3>
                  <p className="text-muted-foreground">The market is currently being analyzed. Check back soon!</p>
                </div>
              ) : (
                stocks.map((stock) => {
                  const trend = getStockTrend(stock);
                  const trendPercent = getTrendPercentage(stock);

                  return (
                    <div
                      key={stock.id}
                      className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow bg-background"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className="font-semibold text-lg">#{stock.meme_keyword}</h3>
                            <p className="text-sm text-muted-foreground">{stock.current_value} chips per share</p>
                          </div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              trend === "up"
                                ? "bg-green-100 text-green-800"
                                : trend === "down"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {trend === "up" && <TrendingUp className="h-3 w-3 mr-1" />}
                            {trend === "down" && <TrendingDown className="h-3 w-3 mr-1" />}
                            {trend === "neutral" && <Minus className="h-3 w-3 mr-1" />}
                            {trendPercent !== 0 ? `${trendPercent > 0 ? "+" : ""}${trendPercent.toFixed(1)}%` : "0%"}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedStock(stock)}
                          disabled={!player}
                          className="bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground px-4 py-2 rounded-md font-medium transition-colors"
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "portfolio" && (
            <div className="space-y-4">
              {!player ? (
                <div className="text-center py-8">
                  <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Login Required</h3>
                  <p className="text-muted-foreground">Please log in to view your portfolio</p>
                </div>
              ) : portfolio.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Empty Portfolio</h3>
                  <p className="text-muted-foreground">You haven't bought any meme stocks yet</p>
                </div>
              ) : (
                <>
                  {/* Portfolio Summary */}
                  <div className="border border-border rounded-lg p-4 bg-background">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Portfolio Value</p>
                        <p className="text-lg font-semibold">{portfolioValue} chips</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Invested</p>
                        <p className="text-lg font-semibold">{Math.round(totalInvested)} chips</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Profit/Loss</p>
                        <p
                          className={`text-lg font-semibold ${
                            totalProfitLoss >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {totalProfitLoss >= 0 ? "+" : ""}
                          {Math.round(totalProfitLoss)} chips
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Items */}
                  {portfolio.map((item) => {
                    const currentValue = item.shares_owned * item.meme_stocks.current_value;
                    const invested = item.shares_owned * item.average_buy_price;
                    const profitLoss = currentValue - invested;

                    return (
                      <div key={item.id} className="border border-border rounded-lg p-4 bg-background">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">#{item.meme_stocks.meme_keyword}</h3>
                            <p className="text-sm text-muted-foreground">
                              {item.shares_owned} shares @ {item.meme_stocks.current_value} chips each
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{currentValue} chips</p>
                            <p className={`text-sm ${profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {profitLoss >= 0 ? "+" : ""}
                              {Math.round(profitLoss)} chips
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Shares to sell"
                            className="flex-1 px-3 py-2 border border-input rounded-md text-sm bg-background"
                            value={sellShares}
                            onChange={(e) => setSellShares(e.target.value)}
                            max={item.shares_owned}
                            min={1}
                          />
                          <button
                            onClick={() => sellStock(item)}
                            disabled={transactionLoading || !sellShares}
                            className="bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground px-4 py-2 rounded-md font-medium transition-colors"
                          >
                            Sell
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Buy Stock Modal */}
      {selectedStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg border border-border shadow-lg w-full max-w-md">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Buy #{selectedStock.meme_keyword}</h3>
                </div>
                <button onClick={() => setSelectedStock(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-muted-foreground mt-2">Current price: {selectedStock.current_value} chips per share</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Amount to invest (chips)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="Enter amount"
                  max={player?.points || 0}
                  min={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available: {player?.points || 0} chips | Shares:{" "}
                  {buyAmount ? Math.floor(parseInt(buyAmount) / selectedStock.current_value) : 0}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedStock(null)}
                  className="flex-1 px-4 py-2 border border-input rounded-md font-medium transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={buyStock}
                  disabled={transactionLoading || !buyAmount || parseInt(buyAmount) <= 0}
                  className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground px-4 py-2 rounded-md font-medium transition-colors"
                >
                  {transactionLoading ? "Buying..." : "Buy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
