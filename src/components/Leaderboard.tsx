import { Crown, Trophy, Medal } from "lucide-react";
import { Player } from "../lib/supabase";

interface LeaderboardProps {
  players: Player[];
}

export function Leaderboard({ players }: LeaderboardProps) {
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
    <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-4 sm:mb-6 flex items-center">
        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />
        Leaderboard
      </h2>

      <div className="space-y-2 sm:space-y-3">
        {players.slice(0, 10).map((player, index) => (
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
                <p className="text-primary text-xs sm:text-sm font-medium">{player.points.toLocaleString()} chips</p>
              </div>
            </div>

            {index < 3 && <div className="text-primary font-semibold text-sm sm:text-base shrink-0">#{index + 1}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
