import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { MultiBattle } from "./components/MultiBattle";
import { MemeMarket } from "./components/MemeMarket";
import { Leaderboard } from "./components/Leaderboard";
import { PreviousRounds } from "./components/PreviousRounds";
import { AdminPanel } from "./components/AdminPanel";
import { useAuth } from "./hooks/useAuth";
import { useGameData } from "./hooks/useGameData";
import { useRoundManager } from "./hooks/useRoundManager";
import { Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

function App() {
  const { player, redditUser, loading: authLoading, login, logout, refreshPlayer, claimWelfareChips } = useAuth();
  const {
    currentRounds,
    previousRounds,
    leaderboard,
    loading: dataLoading,
    placeBet,
    getUserBets,
    refreshData,
  } = useGameData();
  const [canClaimWelfare, setCanClaimWelfare] = useState(false);
  const [activeGame, setActiveGame] = useState("reddit-battles");

  // Start automatic round management
  useRoundManager();

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
      toast.success("Bet placed successfully! 🎰");
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
              <MemeMarket player={player} onRefreshPlayer={refreshPlayer} />
            </div>
            <div className="space-y-4 sm:space-y-6 order-first lg:order-last">
              <Leaderboard players={leaderboard} />
              {/* Admin Panel - only show if user is logged in */}
              {redditUser && <AdminPanel />}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card/50 mt-8 sm:mt-16 py-6 sm:py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm sm:text-base">
            Gamerit - Where Reddit posts battle for supremacy
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">🎰 Bet responsibly with Karma Chips! 🎰</p>
          <div className="mt-3 sm:mt-4 text-muted-foreground text-xs space-y-1">
            <p>• Start with 1,000 free Karma Chips</p>
            <p>• Win bets pay 2x your wager</p>
            <p>• Claim 50 welfare chips daily when broke</p>
          </div>
        </div>
      </footer>

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
