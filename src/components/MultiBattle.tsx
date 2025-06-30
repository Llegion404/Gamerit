import { useState, useEffect } from "react";
import { GameRound as GameRoundComponent } from "./GameRound";
import { HotPotatoBetting } from "./HotPotatoBetting";
import { PreviousRounds } from "./PreviousRounds";
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
  const [lastActiveRoundId, setLastActiveRoundId] = useState<string | null>(null);
  const [battleMode, setBattleMode] = useState<"classic" | "hot-potato">("classic");

  // Listen for round creation events to refresh data
  useEffect(() => {
    const handleRoundCreated = (event: CustomEvent) => {
      console.log("Round created event received in MultiBattle:", event.detail);
      // Refresh data when a new round is created
      refreshData();
    };

    window.addEventListener('roundCreated', handleRoundCreated as EventListener);

    return () => {
      window.removeEventListener('roundCreated', handleRoundCreated as EventListener);
    };
  }, [refreshData]);
  if (!rounds || rounds.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">No Active Battles</h2>
        <p className="text-muted-foreground">New battles will be created automatically. Please wait...</p>
      </div>
    );
  }

  // Update last active round ID when switching tabs
  const handleTabChange = (newTab: number) => {
    const newRoundId = rounds[newTab]?.id;
    if (newRoundId !== lastActiveRoundId) {
      setLastActiveRoundId(newRoundId);
    }
    setActiveTab(newTab);
  };

  const formatRoundTime = (timestamp: string) => {
    const now = new Date();
    const created = new Date(timestamp);
    const hoursDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    const remaining = Math.max(0, 24 - hoursDiff);
    return remaining > 0 ? `${remaining}h left` : "Ending soon";
  };

  return (
    <div className="space-y-6">
      {/* Battle Mode Selector */}
      <div className="bg-card border border-border rounded-lg p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Battle Mode</h2>
            <p className="text-sm text-muted-foreground">
              Choose your preferred betting style
            </p>
          </div>
          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setBattleMode("classic")}
              className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                battleMode === "classic"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Classic Battles
            </button>
            <button
              onClick={() => setBattleMode("hot-potato")}
              className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                battleMode === "hot-potato"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🔥 Hot Potato
            </button>
          </div>
        </div>
      </div>

      {battleMode === "hot-potato" ? (
        <HotPotatoBetting
          player={player}
          redditUser={redditUser}
          onRefreshPlayer={() => {
            // Refresh player data - you might need to pass this from parent
            refreshData();
          }}
        />
      ) : (
        <>
          {/* Battle Overview */}
          <div className="bg-card border border-border rounded-lg p-3 sm:p-4">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Battles Overview
            </h2>
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
                    onClick={() => handleTabChange(index)}
                  >
                    <div className="font-medium">#{index + 1}</div>
                    <div className="truncate">{round.post_a_subreddit}</div>
                    <div className="text-[10px] opacity-75">vs</div>
                    <div className="truncate">{round.post_b_subreddit}</div>
                    <div className="text-[10px] opacity-75 mt-1">
                      {timeLeft}
                    </div>
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
        </>
      )}
    </div>
  );
}