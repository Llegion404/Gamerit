import { useState } from "react";
import { GameRound as GameRoundComponent } from "./GameRound";
import { GameRound as GameRoundType, Player } from "../lib/supabase";
import { RedditUser } from "../lib/reddit-auth";

interface UserBet {
  id: string;
  bet_on: "A" | "B";
  amount: number;
}

interface MultiBattleProps {
  rounds: GameRoundType[];
  player: Player | null;
  redditUser: RedditUser | null;
  onPlaceBet: (roundId: string, betOn: "A" | "B", amount: number) => Promise<void>;
  getUserBets: (playerId: string, roundId: string) => Promise<UserBet[]>;
  refreshData: () => void;
}

export function MultiBattle({ rounds, player, redditUser, onPlaceBet, getUserBets, refreshData }: MultiBattleProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (!rounds || rounds.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">No Active Battles</h2>
        <p className="text-muted-foreground">New battles will be created automatically. Please wait...</p>
      </div>
    );
  }

  const formatRoundTime = (timestamp: string) => {
    const now = new Date();
    const created = new Date(timestamp);
    const hoursDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    const remaining = Math.max(0, 24 - hoursDiff);
    return remaining > 0 ? `${remaining}h left` : "Ending soon";
  };

  return (
    <div className="space-y-6">
      {/* Battle Overview */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4 text-center">Battles Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
          {rounds.slice(0, 10).map((round, index) => {
            const timeLeft = formatRoundTime(round.created_at);
            return (
              <div
                key={round.id}
                className={`p-3 rounded border text-center cursor-pointer transition-colors ${
                  activeTab === index
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-background border-border hover:border-primary/50"
                }`}
                onClick={() => setActiveTab(index)}
              >
                <div className="font-medium">#{index + 1}</div>
                <div className="truncate">{round.post_a_subreddit}</div>
                <div className="text-[10px] opacity-75">vs</div>
                <div className="truncate">{round.post_b_subreddit}</div>
                <div className="text-[10px] opacity-75 mt-1">{timeLeft}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Round Display */}
      <div className="transition-all duration-300">
        <GameRoundComponent
          round={rounds[activeTab]}
          player={player}
          redditUser={redditUser}
          onPlaceBet={onPlaceBet}
          getUserBets={getUserBets}
          refreshData={refreshData}
        />
      </div>
    </div>
  );
}
