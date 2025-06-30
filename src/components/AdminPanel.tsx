import { RefreshCw, TrendingUp, Plus } from "lucide-react";
import { useGameData } from "../hooks/useGameData";
import { useRoundManager } from "../hooks/useRoundManager";
import { useState, useCallback } from "react";
import toast from "react-hot-toast";

// Constants for refresh timing
const REFRESH_DELAY_FAST = 500; // 500ms
const REFRESH_DELAY_SLOW = 2000; // 2 seconds

/**
 * Simplified panel for refreshing game data
 */

export function AdminPanel() {
  const { currentRounds, previousRounds, refreshData } = useGameData();
  const { manuallyCreateRound } = useRoundManager();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingRound, setIsCreatingRound] = useState(false);

  const refreshDataWithRetry = useCallback(() => {
    // Immediate refresh
    refreshData();

    // Backup refreshes with delays for reliability
    setTimeout(refreshData, REFRESH_DELAY_FAST);
    setTimeout(refreshData, REFRESH_DELAY_SLOW);
  }, [refreshData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      refreshDataWithRetry();
      toast.success("Data refreshed successfully! 📊");

      // Reset refresh button state after a delay
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    } catch {
      setIsRefreshing(false);
      toast.error("Failed to refresh data");
    }
  };

  const handleCreateRound = async () => {
    if (currentRounds && currentRounds.length >= 10) {
      toast.error("Maximum number of active rounds (10) reached");
      return;
    }
    
    setIsCreatingRound(true);
    
    try {
      await manuallyCreateRound();
      toast.success("New battle created successfully! 🎯");
      
      // Refresh data after a short delay to see the new round
      setTimeout(() => {
        refreshDataWithRetry();
      }, 1000);
    } catch (error) {
      console.error("Failed to create new round:", error);
      toast.error("Failed to create new round");
    } finally {
      setIsCreatingRound(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 sm:p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Game Status</h2>
      </div>

      {/* Round Status */}
      <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-secondary/50 rounded-md border border-border">
        <h3 className="font-medium mb-3 text-sm sm:text-base">Current Status</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
          <div className="text-center">
            <div className="text-primary font-semibold text-xl sm:text-2xl">{currentRounds?.length || 0}</div>
            <div className="text-muted-foreground text-xs sm:text-sm">Active Rounds</div>
          </div>
          <div className="text-center">
            <div className="text-primary font-semibold text-xl sm:text-2xl">{previousRounds.length}</div>
            <div className="text-muted-foreground text-xs sm:text-sm">Completed Rounds</div>
          </div>
        </div>
        {currentRounds && currentRounds.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">Active battles: {currentRounds.length}/10 running</div>
        )}
      </div>


      {/* Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 gap-2 sm:gap-0">
        <div className="flex-1">
          <h3 className="font-medium text-blue-700 dark:text-blue-300 text-sm sm:text-base">Refresh Data</h3>
          <p className="text-blue-600 dark:text-blue-400 text-xs sm:text-sm">
            Manually refresh all game data and vote counts
          </p>
          <p className="text-primary text-xs mt-1">Use this to see the latest upvotes and betting activity</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </>
          )}
        </button>
      </div>

      <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-secondary/30 rounded-lg">
        <h4 className="font-medium mb-2 text-sm sm:text-base">How Betting Works:</h4>
        <ul className="text-muted-foreground text-xs sm:text-sm space-y-1">
          <li>• Reddit posts compete based on upvote growth over 24 hours</li>
          <li>• Place bets on which post you think will gain more upvotes</li>
          <li>• Win bets pay 2x your wager, lose bets give 0 chips</li>
          <li>• Refresh to see the latest vote counts and betting activity</li>
        </ul>
      </div>
    </div>
  );
}
