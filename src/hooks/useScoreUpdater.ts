import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useScoreUpdater(roundId?: string, onScoreUpdate?: () => void) {
  const intervalRef = useRef<NodeJS.Timeout>();

  const updateScores = useCallback(async () => {
    try {
      // Call the Supabase function to update current scores
      const { data, error } = await supabase.functions.invoke("update-current-scores", {
        method: "POST",
      });

      if (error) {
        console.error("Error updating scores:", error);
        return;
      }

      console.log("Scores updated:", data);

      // Call the callback to refresh the UI
      if (onScoreUpdate) {
        onScoreUpdate();
      }
    } catch (error) {
      console.error("Failed to update scores:", error);
    }
  }, [onScoreUpdate]);

  useEffect(() => {
    // Only start updating if we have an active round
    if (!roundId) {
      return;
    }

    // Initial update
    updateScores();

    // Set up interval to update every minute (60000ms)
    intervalRef.current = setInterval(updateScores, 60000);

    // Cleanup on unmount or when roundId changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [roundId, updateScores]);

  // Return manual update function in case we need to trigger updates manually
  return { updateScores };
}
