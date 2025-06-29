import { Crown, Trophy, Medal, Timer } from "lucide-react";
import { Player } from "../lib/supabase";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface LeaderboardProps {
  players: Player[];
}

interface BetLeaderboardEntry {
  player_id: string;
  reddit_username: string;
  points: number;
  total_bet_amount: number;
  total_bets: number; 
  win_rate: number;
  winning_bets: number;
}

export function Leaderboard({ players }: LeaderboardProps) {
  const [betLeaderboard, setBetLeaderboard] = useState<BetLeaderboardEntry[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<"points" | "bets">("points");
  const [loading, setLoading] = useState(false);

  // Fetch bet leaderboard data
  const fetchBetLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bet_leaderboard")
        .select("*")
        .order("total_bet_amount", { ascending: false })
        .limit(10);

      if (error) throw error;
      setBetLeaderboard(data || []);
    } catch (error) {
      console.error("Error fetching bet leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and setup refresh interval
  useEffect(() => {
    fetchBetLeaderboard();
    
    // Refresh leaderboard data every 30 seconds
    const interval = setInterval(() => {
      if (leaderboardType === "bets") {
        fetchBetLeaderboard();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchBetLeaderboard, leaderboardType]);
  
  // Refresh when switching to bets tab
  useEffect(() => {
    if (leaderboardType === "bets") {
      fetchBetLeaderboard();
    }
  }, [leaderboardType, fetchBetLeaderboard]);

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

  return (
    <div className="bg-card rounded-lg border p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center">
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />
          <h2 className="text-lg sm:text-xl font-bold">Leaderboard</h2>
        </div>
        
        {/* Leaderboard Type Selector */}
        <div className="flex bg-secondary rounded-lg p-1">
          <button
            onClick={() => setLeaderboardType("points")}
            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
              leaderboardType === "points"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Karma Chips
          </button>
          <button
            onClick={() => setLeaderboardType("bets")}
            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
              leaderboardType === "bets"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Total Bets
          </button>
        </div>
      </div>
      
      <div className="space-y-2 sm:space-y-3">
        {leaderboardType === "points" ? (
          // Points Leaderboard
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
        ) : (
          // Bets Leaderboard
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
                        {entry.total_bet_amount.toLocaleString()} chips bet
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{entry.total_bets} bets</span>
                        <span className="hidden sm:inline">•</span>
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
        )}
      </div>
    </div>
  );
}