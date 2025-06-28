import { Clock, Trophy } from "lucide-react";
import { GameRound } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useGameData } from "../hooks/useGameData";
import { useState, useEffect } from "react";

interface PreviousRoundsProps {
  rounds: GameRound[];
}

interface UserBet {
  id: string;
  bet_on: "A" | "B";
  amount: number;
}
export function PreviousRounds({ rounds }: PreviousRoundsProps) {
  const { player } = useAuth();
  const { getUserBets } = useGameData();
  const [userBets, setUserBets] = useState<Record<string, UserBet>>({});

  useEffect(() => {
    const fetchUserBets = async () => {
      if (!player) return;

      const betsMap: Record<string, UserBet> = {};
      
      for (const round of rounds) {
        try {
          const bets = await getUserBets(player.id, round.id);
          if (bets.length > 0) {
            betsMap[round.id] = bets[0];
          }
        } catch (error) {
          console.error(`Failed to fetch bets for round ${round.id}:`, error);
        }
      }
      
      setUserBets(betsMap);
    };

    fetchUserBets();
  }, [player, rounds, getUserBets]);

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateMobile = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-4 sm:mb-6 flex items-center">
        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />
        Previous Rounds
      </h2>

      <div className="space-y-3 sm:space-y-4">
        {rounds.slice(0, 5).map((round) => (
          <div
            key={round.id}
            className="bg-secondary/50 hover:bg-accent rounded-md p-3 sm:p-4 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                <span className="font-medium text-sm sm:text-base">Winner: Post {round.winner}</span>
              </div>
              <span className="text-primary text-xs sm:text-sm font-medium">
                <span className="hidden sm:inline">{formatDate(round.created_at)}</span>
                <span className="sm:hidden">{formatDateMobile(round.created_at)}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
              <div
                className={`p-2 sm:p-3 rounded-md ${
                  round.winner === "A" ? "bg-primary/10 border border-primary/20" : "bg-secondary"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-primary font-medium text-xs sm:text-sm">r/{round.post_a_subreddit}</div>
                  {userBets[round.id]?.bet_on === "A" && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                        Your Bet
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {userBets[round.id].amount} chips
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-muted-foreground line-clamp-2 text-xs">{round.post_a_title}</div>
                <div className="font-medium text-xs sm:text-sm mt-1">
                  {round.post_a_initial_score} → {round.post_a_final_score}
                </div>
              </div>

              <div
                className={`p-2 sm:p-3 rounded-md ${
                  round.winner === "B" ? "bg-primary/10 border border-primary/20" : "bg-secondary"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-primary font-medium text-xs sm:text-sm">r/{round.post_b_subreddit}</div>
                  {userBets[round.id]?.bet_on === "B" && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                        Your Bet
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {userBets[round.id].amount} chips
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-muted-foreground line-clamp-2 text-xs">{round.post_b_title}</div>
                <div className="font-medium text-xs sm:text-sm mt-1">
                  {round.post_b_initial_score} → {round.post_b_final_score}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
