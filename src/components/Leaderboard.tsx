import { Crown, Trophy, Medal, Timer, TrendingUp, Search, Italic as Crystal } from "lucide-react";
import { Player } from "../lib/supabase";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface LeaderboardProps {
  players: Player[];
  gameMode?: string;
}

interface BetLeaderboardEntry {
  player_id: string;
  reddit_username: string;
  points: number;
  highest_bet_amount: number;
  total_bets: number; 
  win_rate: number;
  total_winnings: number;
}

interface PortfolioLeaderboardEntry {
  player_id: string;
  reddit_username: string;
  portfolio_value: number;
  stocks_owned: number;
  profit_loss: number;
}

export function Leaderboard({ players, gameMode = "reddit-battles" }: LeaderboardProps) {
  const [betLeaderboard, setBetLeaderboard] = useState<BetLeaderboardEntry[]>([]);
  const [portfolioLeaderboard, setPortfolioLeaderboard] = useState<PortfolioLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch bet leaderboard data
  const fetchBetLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bet_leaderboard")
        .select("*")
        .order("highest_bet_amount", { ascending: false })
        .limit(10);

      if (error) throw error;
      setBetLeaderboard(data || []);
    } catch (error) {
      console.error("Error fetching bet leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch portfolio leaderboard data
  const fetchPortfolioLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      // This would ideally be a view in the database, but for now we'll simulate it
      const { data: portfolios, error } = await supabase
        .from("player_portfolios")
        .select(`
          player_id,
          shares_owned,
          average_buy_price,
          meme_stocks!inner(current_value),
          players!inner(reddit_username)
        `)
        .gt("shares_owned", 0);

      if (error) throw error;

      // Calculate portfolio values and aggregate by player
      const playerPortfolios: Record<string, {
        player_id: string;
        reddit_username: string;
        portfolio_value: number;
        stocks_owned: number;
        total_cost: number;
      }> = {};

      portfolios?.forEach(portfolio => {
        const playerId = portfolio.player_id;
        const value = portfolio.shares_owned * portfolio.meme_stocks.current_value;
        const cost = portfolio.shares_owned * portfolio.average_buy_price;
        
        if (!playerPortfolios[playerId]) {
          playerPortfolios[playerId] = {
            player_id: playerId,
            reddit_username: portfolio.players.reddit_username,
            portfolio_value: 0,
            stocks_owned: 0,
            total_cost: 0
          };
        }
        
        playerPortfolios[playerId].portfolio_value += value;
        playerPortfolios[playerId].stocks_owned += portfolio.shares_owned;
        playerPortfolios[playerId].total_cost += cost;
      });

      // Convert to array and add profit/loss
      const leaderboard = Object.values(playerPortfolios).map(player => ({
        player_id: player.player_id,
        reddit_username: player.reddit_username,
        portfolio_value: Math.round(player.portfolio_value),
        stocks_owned: player.stocks_owned,
        profit_loss: Math.round(player.portfolio_value - player.total_cost)
      }));

      // Sort by portfolio value
      leaderboard.sort((a, b) => b.portfolio_value - a.portfolio_value);
      
      setPortfolioLeaderboard(leaderboard.slice(0, 10));
    } catch (error) {
      console.error("Error fetching portfolio leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and setup refresh interval
  useEffect(() => {
    if (gameMode === "reddit-battles") {
      fetchBetLeaderboard();
    } else if (gameMode === "meme-market") {
      fetchPortfolioLeaderboard();
    }
    
    // Refresh leaderboard data every 30 seconds
    const interval = setInterval(() => {
      if (gameMode === "reddit-battles") {
        fetchBetLeaderboard();
      } else if (gameMode === "meme-market") {
        fetchPortfolioLeaderboard();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [gameMode, fetchBetLeaderboard, fetchPortfolioLeaderboard]);
  
  // Refresh when switching game modes
  useEffect(() => {
    if (gameMode === "reddit-battles") {
      fetchBetLeaderboard();
    } else if (gameMode === "meme-market") {
      fetchPortfolioLeaderboard();
    }
  }, [gameMode, fetchBetLeaderboard, fetchPortfolioLeaderboard]);

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />;
      case 2:
        return <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />;
      case 3:
        return <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />;
      default:
        return (
          <span className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-primary font-semibold text-xs sm:text-sm">
            {position}
          </span>
        );
    }
  };

  const getLeaderboardIcon = () => {
    switch (gameMode) {
      case "meme-market":
        return <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />;
      case "archaeology":
        return <Search className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />;
      case "reddit-oracle":
        return <Crystal className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />;
      default:
        return <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />;
    }
  };

  const getLeaderboardTitle = () => {
    switch (gameMode) {
      case "meme-market":
        return "Market Leaders";
      case "archaeology":
        return "Top Archaeologists";
      case "reddit-oracle":
        return "Wisest Oracles";
      case "subreddit-reigns":
        return "Subreddit Kings";
      default:
        return "Leaderboard";
    }
  };

  return (
    <div className="bg-card rounded-lg border p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center">
          {getLeaderboardIcon()}
          <h2 className="text-lg sm:text-xl font-bold">{getLeaderboardTitle()}</h2>
        </div>
      </div>
      
      <div className="space-y-2 sm:space-y-3">
        {gameMode === "meme-market" ? (
          // Meme Market Portfolio Leaderboard
          loading ? (
            // Loading state
            Array(5).fill(0).map((_, index) => (
              <div key={index} className="animate-pulse bg-secondary/50 p-3 rounded-md h-16"></div>
            ))
          ) : portfolioLeaderboard.length > 0 ? (
            // Portfolio leaderboard
            portfolioLeaderboard.map((entry, index) => (
              <div
                key={entry.player_id}
                className={`flex items-center justify-between p-2 sm:p-3 rounded-md transition-colors hover:bg-accent ${
                  index < 3 ? "bg-primary/5 border border-primary/20" : "bg-secondary/50"
                }`}
              >
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  {getPositionIcon(index + 1)}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm sm:text-base truncate">u/{entry.reddit_username}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <p className="text-primary text-xs sm:text-sm font-medium">
                        {entry.portfolio_value.toLocaleString()} chips
                      </p>
                      <div className="flex items-center gap-1 text-xs">
                        <span>{entry.stocks_owned} shares</span>
                        <span className="hidden sm:inline">•</span>
                        <span className={entry.profit_loss > 0 ? "text-green-500" : "text-red-500"}>
                          {entry.profit_loss > 0 ? "+" : ""}{entry.profit_loss.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {index < 3 && <div className="text-primary font-semibold text-sm sm:text-base shrink-0">#{index + 1}</div>}
              </div>
            ))
          ) : (
            // No portfolio data
            <div className="text-center py-4 text-muted-foreground">
              No portfolio data available
            </div>
          )
        ) : gameMode === "reddit-battles" && betLeaderboard.length > 0 ? (
          // Betting Leaderboard
          loading ? (
            // Loading state
            Array(5).fill(0).map((_, index) => (
              <div key={index} className="animate-pulse bg-secondary/50 p-3 rounded-md h-16"></div>
            ))
          ) : (
            betLeaderboard.map((entry, index) => (
              <div
                key={entry.player_id}
                className={`flex items-center justify-between p-2 sm:p-3 rounded-md transition-colors hover:bg-accent ${
                  index < 3 ? "bg-primary/5 border border-primary/20" : "bg-secondary/50"
                }`}
              >
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  {getPositionIcon(index + 1)}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm sm:text-base truncate">u/{entry.reddit_username}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <p className="text-primary text-xs sm:text-sm font-medium">
                        <span>{entry.highest_bet_amount.toLocaleString()}</span>
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className={entry.win_rate > 50 ? "text-green-500" : "text-red-500"}>
                          {entry.win_rate}% win rate
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {index < 3 && <div className="text-primary font-semibold text-sm sm:text-base shrink-0">#{index + 1}</div>}
              </div>
            ))
          )
        ) : (
          // Default Points Leaderboard (for all other game modes)
          players.slice(0, 10).map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-2 sm:p-3 rounded-md transition-colors hover:bg-accent ${
                index < 3 ? "bg-primary/5 border border-primary/20" : "bg-secondary/50"
              }`}
            >
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                {getPositionIcon(index + 1)}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base truncate">u/{player.reddit_username}</p>
                  <p className="text-primary text-xs sm:text-sm font-medium">
                    {player.points.toLocaleString()} chips
                  </p>
                </div>
              </div>
              {index < 3 && <div className="text-primary font-semibold text-sm sm:text-base shrink-0">#{index + 1}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}