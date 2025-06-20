import { Clock, Trophy } from "lucide-react";
import { GameRound } from "../lib/supabase";

interface PreviousRoundsProps {
  rounds: GameRound[];
}

export function PreviousRounds({ rounds }: PreviousRoundsProps) {
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
                <div className="text-primary font-medium text-xs sm:text-sm">r/{round.post_a_subreddit}</div>
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
                <div className="text-primary font-medium text-xs sm:text-sm">r/{round.post_b_subreddit}</div>
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
