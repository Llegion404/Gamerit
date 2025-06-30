import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  icon: string;
  xp_reward: number;
  karma_chips_reward: number;
  requirement_type: string;
  requirement_value: number;
}

export interface PlayerAchievement {
  id: string;
  achievement: Achievement;
  progress: number;
  completed: boolean;
  completed_at: string | null;
}

export interface PlayerProgression {
  xp: number;
  level: number;
  total_karma_chips_earned: number;
  total_karma_chips_lost: number;
  lowest_karma_chips: number;
  highest_karma_chips: number;
}

export interface XPTransaction {
  id: string;
  amount: number;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useProgression(redditUsername: string | null) {
  const [progression, setProgression] = useState<PlayerProgression | null>(
    null,
  );
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [playerAchievements, setPlayerAchievements] = useState<
    PlayerAchievement[]
  >([]);
  const [recentXP, setRecentXP] = useState<XPTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prevent duplicate loading states
  const loadingStates = useRef({
    progression: false,
    achievements: false,
    playerAchievements: false,
    recentXP: false,
  });

  // Calculate XP needed for next level
  const getXPForNextLevel = (currentLevel: number): number => {
    // Level progression: Level 2 = 100 XP total, Level 3 = 300 XP total, etc.
    let totalXPNeeded = 0;
    for (let level = 2; level <= currentLevel + 1; level++) {
      totalXPNeeded += (level - 1) * 100;
    }
    return totalXPNeeded;
  };

  const getXPProgress = (): {
    current: number;
    needed: number;
    percentage: number;
  } => {
    if (!progression) return { current: 0, needed: 0, percentage: 0 };

    const currentLevelXP = getXPForNextLevel(progression.level - 1);
    const nextLevelXP = getXPForNextLevel(progression.level);
    const currentXPInLevel = progression.xp - currentLevelXP;
    const neededForNext = nextLevelXP - currentLevelXP;

    return {
      current: currentXPInLevel,
      needed: neededForNext,
      percentage: (currentXPInLevel / neededForNext) * 100,
    };
  };

  const fetchProgression = useCallback(async () => {
    if (!redditUsername || loadingStates.current.progression) return;

    try {
      loadingStates.current.progression = true;
      setLoading(true);

      // Get player progression data first to get player ID
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select(
          "id, xp, level, total_karma_chips_earned, total_karma_chips_lost, lowest_karma_chips, highest_karma_chips",
        )
        .eq("reddit_username", redditUsername)
        .single();

      if (playerError && playerError.code !== "PGRST116") {
        throw playerError;
      }

      if (playerData) {
        setProgression({
          xp: playerData.xp,
          level: playerData.level,
          total_karma_chips_earned: playerData.total_karma_chips_earned,
          total_karma_chips_lost: playerData.total_karma_chips_lost,
          lowest_karma_chips: playerData.lowest_karma_chips,
          highest_karma_chips: playerData.highest_karma_chips,
        });

        // Load other data in parallel once we have player ID
        const [achievementsResult, playerAchievementsResult, recentXPResult] =
          await Promise.allSettled([
            // Get all achievements
            supabase
              .from("achievements")
              .select("*")
              .order("requirement_value", { ascending: true }),

            // Get player achievement progress
            supabase
              .from("player_achievements")
              .select(
                `
              id,
              progress,
              completed,
              completed_at,
              achievements!inner (
                id,
                name,
                description,
                tier,
                icon,
                xp_reward,
                karma_chips_reward,
                requirement_type,
                requirement_value
              )
            `,
              )
              .eq("player_id", playerData.id),

            // Get recent XP transactions
            supabase
              .from("xp_transactions")
              .select("*")
              .eq("player_id", playerData.id)
              .order("created_at", { ascending: false })
              .limit(10),
          ]);

        // Process achievements result
        if (
          achievementsResult.status === "fulfilled" &&
          !achievementsResult.value.error
        ) {
          setAchievements(achievementsResult.value.data || []);
        }

        // Process player achievements result
        if (
          playerAchievementsResult.status === "fulfilled" &&
          !playerAchievementsResult.value.error
        ) {
          const playerAchievements =
            playerAchievementsResult.value.data?.map((pa) => ({
              id: pa.id,
              achievement: pa.achievements[0], // Take the first achievement from the join
              progress: pa.progress,
              completed: pa.completed,
              completed_at: pa.completed_at,
            })) || [];
          setPlayerAchievements(playerAchievements);
        }

        // Process recent XP result
        if (
          recentXPResult.status === "fulfilled" &&
          !recentXPResult.value.error
        ) {
          setRecentXP(recentXPResult.value.data || []);
        }
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching progression:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      loadingStates.current.progression = false;
    }
  }, [redditUsername]);

  const awardXP = async (
    amount: number,
    reason: string,
    metadata?: Record<string, unknown>,
  ) => {
    if (!redditUsername) return;

    try {
      console.log(`Awarding ${amount} XP to ${redditUsername} for: ${reason}`);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/award-xp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            reddit_username: redditUsername,
            xp_amount: amount,
            reason,
            metadata,
          }),
        },
      );

      console.log(`XP award response status: ${response.status}`);

      const result = await response.json();
      console.log("XP award result:", result);

      if (!response.ok) {
        console.error("XP award failed:", result);
        throw new Error(result.error || "Failed to award XP");
      }

      if (result.success) {
        console.log(
          `Successfully awarded ${amount} XP. New total: ${result.new_xp}, Level: ${result.new_level}`,
        );

        // Force refresh progression data to show updated values immediately
        await fetchProgression();
      }

      // Refresh progression data

      return result;
    } catch (err) {
      console.error("Error awarding XP:", err);
      throw err;
    }
  };

  const checkAchievements = async () => {
    if (!redditUsername) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-achievements`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            reddit_username: redditUsername,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to check achievements");
      }

      // Refresh progression data if there were new achievements
      if (result.new_achievements && result.new_achievements.length > 0) {
        await fetchProgression();
      }

      return result;
    } catch (err) {
      console.error("Error checking achievements:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (redditUsername) {
      fetchProgression();
    }
  }, [redditUsername, fetchProgression]);

  return {
    progression,
    achievements,
    playerAchievements,
    recentXP,
    loading,
    error,
    getXPProgress,
    awardXP,
    checkAchievements,
    refetch: fetchProgression,
  };
}
