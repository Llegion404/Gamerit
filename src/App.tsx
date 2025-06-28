import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { MultiBattle } from "./components/MultiBattle";
import { MemeMarket } from "./components/MemeMarket";
import { Leaderboard } from "./components/Leaderboard";
import { PreviousRounds } from "./components/PreviousRounds";
import { AdminPanel } from "./components/AdminPanel";
import { ProductivityParadox } from "./components/ProductivityParadox";
import ProgressionSystem from "./components/ProgressionSystem";
import AchievementNotification from "./components/AchievementNotification";
import { useAuth } from "./hooks/useAuth";
import { useGameData } from "./hooks/useGameData";
import { useRoundManager } from "./hooks/useRoundManager";
import { useHotPotatoManager } from "./hooks/useHotPotatoManager";
import { useProgression } from "./hooks/useProgression";
import { Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Archaeology from "./components/Archaeology";
import { ComingSoon } from "./components/ComingSoon";
import RedditRadio from "./components/RedditRadio";
import { RedditOracle } from "./components/RedditOracle";

function App() {
  const { player, redditUser, loading: authLoading, login, logout, refreshPlayer, claimWelfareChips } = useAuth();
  const {
    currentRounds,
    previousRounds,
    leaderboard,
    loading: dataLoading,
    lastRefreshTime,
    placeBet,
    getUserBets,
    refreshData,
  } = useGameData();
  const { awardXP } = useProgression(redditUser?.name || null);
  const [canClaimWelfare, setCanClaimWelfare] = useState(false);
  const [activeGame, setActiveGame] = useState("reddit-battles");
  const [newAchievements, setNewAchievements] = useState<string[]>([]);

  // Start automatic round management
  useRoundManager();
  useHotPotatoManager();

  // Listen for round creation events and show notifications
  useEffect(() => {
    const handleRoundCreated = (event: CustomEvent) => {
      console.log("Round created event received in App:", event.detail);
      if (activeGame === "reddit-battles") {
        toast.success("New battle created! 🎯", {
          duration: 3000,
          style: {
            background: "hsl(var(--card))",
            color: "hsl(var(--card-foreground))",
            border: "1px solid hsl(var(--border))",
          },
        });
      }
    };

    window.addEventListener('roundCreated', handleRoundCreated as EventListener);

    return () => {
      window.removeEventListener('roundCreated', handleRoundCreated as EventListener);
    };
  }, [activeGame]);
  useEffect(() => {
    // Check if player can claim welfare chips
    if (player) {
      setCanClaimWelfare(player.points === 0);
    }
  }, [player]);

  const handlePlaceBet = async (roundId: string, betOn: "A" | "B", amount: number) => {
    if (!player || !redditUser) return;

    try {
      await placeBet(roundId, betOn, amount, redditUser.id);
      await refreshPlayer(); // Refresh player points after betting

      // Award XP for placing a bet
      try {
        const xpResult = await awardXP(10, "Placed bet in Reddit Battle", {
          roundId,
          betOn,
          amount,
          timestamp: new Date().toISOString(),
        });

        if (xpResult?.level_up) {
          toast.success(`🎉 Level up! You are now level ${xpResult.new_level}!`);
        }

        if (xpResult?.new_achievements && xpResult.new_achievements.length > 0) {
          setNewAchievements(xpResult.new_achievements);
        }
      } catch (xpError) {
        console.error("Failed to award XP:", xpError);
        // Don't fail the bet if XP awarding fails
      }

      toast.success("Bet placed successfully! 🎰 (+10 XP)");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to place bet. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleClaimWelfare = async () => {
    try {
      const result = await claimWelfareChips();
      if (result?.success) {
        toast.success(result.message + " 🎁");
        setCanClaimWelfare(false);
      } else {
        toast.error(result?.error || "Failed to claim welfare chips");
      }
    } catch {
      toast.error("Failed to claim welfare chips. Please try again.");
    }
  };

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-lg">Loading Gamerit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        player={player}
        redditUser={redditUser}
        onLogin={login}
        onLogout={logout}
        onClaimWelfare={handleClaimWelfare}
        canClaimWelfare={canClaimWelfare}
        activeGame={activeGame}
        onGameChange={setActiveGame}
      />

      <main className="container mx-auto px-4 py-4 sm:py-8 max-w-7xl">
        {activeGame === "reddit-battles" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                <MultiBattle
                  rounds={currentRounds}
                  player={player}
                  redditUser={redditUser}
                  onPlaceBet={handlePlaceBet}
                  getUserBets={getUserBets}
                  refreshData={refreshData}
                />
              </div>

              <div className="space-y-4 sm:space-y-6 order-first lg:order-last">
                <Leaderboard players={leaderboard} />

                {/* Admin Panel - only show if user is logged in */}
                {redditUser && <AdminPanel />}
              </div>
            </div>

            {/* Previous Rounds section moved lower */}
            <div className="mt-8 sm:mt-12">
              <PreviousRounds rounds={previousRounds} />
            </div>
          </>
        )}

        {activeGame === "meme-market" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2">
              <MemeMarket player={player} onRefreshPlayer={refreshPlayer} redditUsername={redditUser?.name} />
            </div>
            <div className="space-y-4 sm:space-y-6 order-first lg:order-last">
              <Leaderboard players={leaderboard} />
              {/* Admin Panel - only show if user is logged in */}
              {redditUser && <AdminPanel />}
            </div>
          </div>
        )}

        {activeGame === "archaeology" && <Archaeology />}

        {activeGame === "productivity-paradox" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2">
              <ProductivityParadox player={player} onRefreshPlayer={refreshPlayer} redditUsername={redditUser?.name} />
            </div>
            <div className="space-y-4 sm:space-y-6 order-first lg:order-last">
              <Leaderboard players={leaderboard} showMetaMinutes={true} />
              {/* Admin Panel - only show if user is logged in */}
              {redditUser && <AdminPanel />}
            </div>
          </div>
        )}

        {activeGame === "coming-soon" && <ComingSoon />}

        {activeGame === "reddit-radio" && <RedditRadio />}

        {activeGame === "reddit-oracle" && <RedditOracle />}

        {activeGame === "progression" && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">Player Progression</h1>
              <p className="text-muted-foreground">
                Track your level, earn XP through gameplay, and unlock achievements as you master Gamerit!
              </p>
            </div>
            <ProgressionSystem redditUsername={redditUser?.name || null} />
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card/50 mt-8 sm:mt-16 py-6 sm:py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm sm:text-base">Gamerit - The Ultimate Reddit Gaming Platform</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            🎯 Battle • 📈 Trade • 🦴 Explore • 🏆 Compete • ⭐ Progress
          </p>
          <div className="mt-3 sm:mt-4 text-muted-foreground text-xs space-y-1">
            <p>• Reddit Battles: Bet on post performance and win big</p>
            <p>• Meme Market: Trade trending keywords like stocks</p>
            <p>• Archaeology: Discover the deepest comment chains</p>
            <p>• Reddit Oracle: Ask questions and receive mystical wisdom from random Reddit comments</p>
            <p>• Progression: Level up and unlock achievements as you play</p>
            <p>• Start with 1,000 free Karma Chips • Claim 50 welfare chips daily when broke</p>
          </div>
        </div>
      </footer>

      {/* Achievement Notifications */}
      {newAchievements.length > 0 && (
        <AchievementNotification achievements={newAchievements} onClose={() => setNewAchievements([])} />
      )}

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "hsl(var(--card))",
            color: "hsl(var(--card-foreground))",
            border: "1px solid hsl(var(--border))",
          },
          success: {
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(142 76% 36%)",
            },
          },
          error: {
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(0 84% 60%)",
            },
          },
        }}
      />
    </div>
  );
}

export default App;