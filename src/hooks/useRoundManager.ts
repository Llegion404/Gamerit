import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useRoundManager() {
  const intervalRef = useRef<NodeJS.Timeout>();
  const isProcessingRef = useRef(false);

  const checkAndManageRounds = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isProcessingRef.current) {
      console.log("Round management already in progress, skipping...");
      return;
    }

    try {
      isProcessingRef.current = true;
      console.log("Checking for expired rounds...");

      // Get all active rounds with better error handling
      const { data: activeRounds, error: fetchError } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "active");

      if (fetchError) {
        console.error("Error fetching active rounds:", fetchError);
        // Don't throw here, just log and return to avoid breaking the app
        return;
      }

      if (!activeRounds || activeRounds.length === 0) {
        console.log("No active rounds found, creating new round...");
        try {
          await createNewRound();
        } catch (error) {
          console.error("Failed to create initial round:", error);
          // Don't throw, just log the error
        }
        return;
      }

      // Check if any rounds have expired (older than 24 hours)
      const now = new Date();
      const expiredRounds = activeRounds.filter((round) => {
        const created = new Date(round.created_at);
        const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
        return hoursDiff >= 24;
      });

      if (expiredRounds.length > 0) {
        console.log(`Found ${expiredRounds.length} expired rounds, ending them...`);

        for (const round of expiredRounds) {
          try {
            await endRound(round.id);
          } catch (error) {
            console.error(`Failed to end round ${round.id}:`, error);
            // Continue with other rounds even if one fails
          }
        }

        // After ending rounds, check if we need to create more rounds to maintain 10 active
        const { data: remainingActiveRounds } = await supabase.from("game_rounds").select("id").eq("status", "active");
        const currentActiveCount = remainingActiveRounds?.length || 0;

        if (currentActiveCount < 10) {
          const roundsToCreate = 10 - currentActiveCount;
          console.log(`Need to create ${roundsToCreate} rounds to maintain 10 active rounds`);

          for (let i = 0; i < roundsToCreate; i++) {
            try {
              await createNewRound();
              console.log(`Created round ${i + 1}/${roundsToCreate}`);
              // Add a small delay between round creations to prevent overwhelming the system
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
              console.error(`Failed to create round ${i + 1}:`, error);
              break; // Stop creating more rounds if one fails
            }
          }
        }
      } else {
        console.log("All active rounds are still valid");

        // Check if we need to create more rounds to reach 10
        const currentActiveCount = activeRounds?.length || 0;
        if (currentActiveCount < 10) {
          const roundsToCreate = 10 - currentActiveCount;
          console.log(`Creating ${roundsToCreate} additional rounds to reach 10 active rounds`);

          for (let i = 0; i < roundsToCreate; i++) {
            try {
              await createNewRound();
              console.log(`Created additional round ${i + 1}/${roundsToCreate}`);
              // Add a small delay between round creations
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
              console.error(`Failed to create additional round ${i + 1}:`, error);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in round management:", error);
      // Don't re-throw to avoid breaking the app
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  const endRound = async (roundId: string) => {
    try {
      console.log(`Ending round ${roundId}...`);

      // Call the end-round function
      const { data, error } = await supabase.functions.invoke("end-round", {
        method: "POST",
        body: { roundId },
      });

      if (error) {
        console.error("Error ending round:", error);
        throw error;
      }

      console.log(`Round ${roundId} ended successfully:`, data);
      return data;
    } catch (error) {
      console.error(`Failed to end round ${roundId}:`, error);
      throw error;
    }
  };

  const createNewRound = async () => {
    try {
      console.log("Creating new automatic round...");

      // Call the create-auto-round function
      const { data, error } = await supabase.functions.invoke("create-auto-round", {
        method: "POST",
      });

      if (error) {
        console.error("Error creating new round:", error);
        throw error;
      }

      console.log("New round created successfully:", data);
      
      // Trigger a manual refresh of the UI data after successful round creation
      // This ensures the UI updates immediately after round creation
      setTimeout(() => {
        console.log("Triggering UI refresh after round creation");
        // Emit a custom event that the UI can listen to
        window.dispatchEvent(new CustomEvent('roundCreated', { detail: data }));
      }, 1000); // 1 second delay to ensure database consistency
      
      return data;
    } catch (error) {
      console.error("Failed to create new round:", error);
      throw error;
    }
  };

  const startRoundMonitoring = useCallback(() => {
    console.log("Starting round monitoring...");

    // Add a small delay before the first check to avoid initial page load conflicts
    setTimeout(() => {
      checkAndManageRounds().catch((error) => {
        console.error("Initial round management check failed:", error);
      });
    }, 2000); // 2 second delay

    // Then check every 5 hours
    intervalRef.current = setInterval(() => {
      checkAndManageRounds().catch((error) => {
        console.error("Scheduled round management check failed:", error);
      });
    }, 5 * 60 * 60 * 1000); // 5 hours
  }, [checkAndManageRounds]);

  // Add a function to manually create a round with better error handling
  const manuallyCreateRound = useCallback(async () => {
    try {
      console.log("Manually creating a new round...");
      const result = await createNewRound();
      console.log("Manual round creation successful:", result);
      return result;
    } catch (error) {
      console.error("Manual round creation failed:", error);
      throw error;
    }
  }, [createNewRound]);

  const stopRoundMonitoring = useCallback(() => {
    console.log("Stopping round monitoring...");
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  // Start monitoring when hook is used
  useEffect(() => {
    startRoundMonitoring();

    // Cleanup on unmount
    return () => {
      stopRoundMonitoring();
    };
  }, [startRoundMonitoring, stopRoundMonitoring]);

  // Also provide manual trigger functions
  return {
    checkAndManageRounds,
    createNewRound,
    endRound,
    manuallyCreateRound,
    startRoundMonitoring,
    stopRoundMonitoring,
  };
}
