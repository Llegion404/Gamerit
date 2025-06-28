import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useHotPotatoManager() {
  const intervalRef = useRef<NodeJS.Timeout>();
  const isProcessingRef = useRef(false);

  const checkAndManageHotPotatoRounds = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isProcessingRef.current) {
      console.log("Hot potato round management already in progress, skipping...");
      return;
    }

    try {
      isProcessingRef.current = true;
      console.log("Checking for hot potato rounds...");

      // Get all active hot potato rounds
      const { data: activeRounds, error: fetchError } = await supabase
        .from("hot_potato_rounds")
        .select("*")
        .eq("status", "active");

      if (fetchError) {
        console.error("Error fetching active hot potato rounds:", fetchError);
        return;
      }

      const currentActiveCount = activeRounds?.length || 0;
      console.log(`Found ${currentActiveCount} active hot potato rounds`);

      // Maintain 2-3 active hot potato rounds
      const targetRounds = 3;
      
      if (currentActiveCount < targetRounds) {
        const roundsToCreate = targetRounds - currentActiveCount;
        console.log(`Need to create ${roundsToCreate} hot potato rounds`);

        for (let i = 0; i < roundsToCreate; i++) {
          try {
            await createNewHotPotatoRound();
            console.log(`Created hot potato round ${i + 1}/${roundsToCreate}`);
            // Add delay between creations
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Failed to create hot potato round ${i + 1}:`, error);
            break;
          }
        }
      }

      // Check for posts that might have been deleted
      await checkHotPotatoPosts();

    } catch (error) {
      console.error("Error in hot potato round management:", error);
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  const createNewHotPotatoRound = async () => {
    try {
      console.log("Creating new hot potato round...");

      const { data, error } = await supabase.functions.invoke("create-hot-potato-round", {
        method: "POST",
      });

      if (error) {
        console.error("Error creating hot potato round:", error);
        throw error;
      }

      console.log("Hot potato round created successfully:", data);
      
      // Trigger UI refresh after successful round creation
      setTimeout(() => {
        console.log("Triggering UI refresh after hot potato round creation");
        window.dispatchEvent(new CustomEvent('hotPotatoRoundCreated', { detail: data }));
      }, 1000);
      
      return data;
    } catch (error) {
      console.error("Failed to create hot potato round:", error);
      throw error;
    }
  };

  const checkHotPotatoPosts = async () => {
    try {
      console.log("Checking hot potato posts for deletion...");

      const { data, error } = await supabase.functions.invoke("check-hot-potato-posts", {
        method: "POST",
      });

      if (error) {
        console.error("Error checking hot potato posts:", error);
        return;
      }

      if (data?.deleted_posts > 0) {
        console.log(`${data.deleted_posts} hot potato posts were deleted`);
        // Trigger UI refresh if posts were deleted
        window.dispatchEvent(new CustomEvent('hotPotatoPostsUpdated', { detail: data }));
      }

      return data;
    } catch (error) {
      console.error("Failed to check hot potato posts:", error);
    }
  };

  const startHotPotatoMonitoring = useCallback(() => {
    console.log("Starting hot potato round monitoring...");

    // Initial check after a small delay
    setTimeout(() => {
      checkAndManageHotPotatoRounds().catch((error) => {
        console.error("Initial hot potato round management check failed:", error);
      });
    }, 3000); // 3 second delay

    // Then check every 10 minutes
    intervalRef.current = setInterval(() => {
      checkAndManageHotPotatoRounds().catch((error) => {
        console.error("Scheduled hot potato round management check failed:", error);
      });
    }, 5 * 60 * 60 * 1000); // 5 hours
  }, [checkAndManageHotPotatoRounds]);

  const stopHotPotatoMonitoring = useCallback(() => {
    console.log("Stopping hot potato round monitoring...");
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  // Start monitoring when hook is used
  useEffect(() => {
    startHotPotatoMonitoring();

    // Cleanup on unmount
    return () => {
      stopHotPotatoMonitoring();
    };
  }, [startHotPotatoMonitoring, stopHotPotatoMonitoring]);

  return {
    checkAndManageHotPotatoRounds,
    createNewHotPotatoRound,
    checkHotPotatoPosts,
    startHotPotatoMonitoring,
    stopHotPotatoMonitoring,
  };
}