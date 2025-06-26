import { ref, onUnmounted, watch } from "vue";
import { supabase } from "../lib/supabase";

export function useScoreUpdater(roundId?: string, onScoreUpdate?: () => void) {
  const intervalRef = ref<NodeJS.Timeout>();

  const updateScores = async () => {
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
  };

  const startUpdating = () => {
    // Only start updating if we have an active round
    if (!roundId) {
      return;
    }

    // Initial update
    updateScores();

    // Set up interval to update every minute (60000ms)
    intervalRef.value = setInterval(updateScores, 60000);
  };

  const stopUpdating = () => {
    if (intervalRef.value) {
      clearInterval(intervalRef.value);
      intervalRef.value = undefined;
    }
  };

  // Watch for roundId changes
  watch(
    () => roundId,
    (newRoundId) => {
      stopUpdating();
      if (newRoundId) {
        startUpdating();
      }
    },
    { immediate: true }
  );

  // Cleanup on unmount
  onUnmounted(() => {
    stopUpdating();
  });

  // Return manual update function in case we need to trigger updates manually
  return { updateScores };
}
