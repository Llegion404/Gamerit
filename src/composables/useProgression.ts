import { ref, onMounted, computed } from "vue";
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
  const progression = ref<PlayerProgression | null>(null);
  const achievements = ref<Achievement[]>([]);
  const playerAchievements = ref<PlayerAchievement[]>([]);
  const recentXP = ref<XPTransaction[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  // Calculate XP needed for next level
  const getXPForNextLevel = (currentLevel: number): number => {
    // Level progression: Level 2 = 100 XP total, Level 3 = 300 XP total, etc.
    let totalXPNeeded = 0;
    for (let level = 2; level <= currentLevel + 1; level++) {
      totalXPNeeded += (level - 1) * 100;
    }
    return totalXPNeeded;
  };

  const getXPProgress = computed(() => {
    if (!progression.value) return { current: 0, needed: 100, percentage: 0 };

    const currentLevelXP = getXPForNextLevel(progression.value.level - 1);
    const nextLevelXP = getXPForNextLevel(progression.value.level);
    const currentXPInLevel = progression.value.xp - currentLevelXP;
    const neededForNext = nextLevelXP - currentLevelXP;

    return {
      current: currentXPInLevel,
      needed: neededForNext,
      percentage: (currentXPInLevel / neededForNext) * 100,
    };
  });

  const fetchProgression = async () => {
    if (!redditUsername) return;

    try {
      loading.value = true;

      // Get player progression data
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select(
          "id, xp, level, total_karma_chips_earned, total_karma_chips_lost, lowest_karma_chips, highest_karma_chips"
        )
        .eq("reddit_username", redditUsername)
        .single();

      if (playerError && playerError.code !== "PGRST116") {
        throw playerError;
      }

      if (playerData) {
        progression.value = {
          xp: playerData.xp,
          level: playerData.level,
          total_karma_chips_earned: playerData.total_karma_chips_earned,
          total_karma_chips_lost: playerData.total_karma_chips_lost,
          lowest_karma_chips: playerData.lowest_karma_chips,
          highest_karma_chips: playerData.highest_karma_chips,
        };
      }

      // Get all achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from("achievements")
        .select("*")
        .order("requirement_value", { ascending: true });

      if (achievementsError) {
        throw achievementsError;
      }

      achievements.value = achievementsData || [];

      // Get player achievement progress
      if (playerData) {
        const { data: playerAchievementsData, error: playerAchievementsError } = await supabase
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
          `
          )
          .eq("player_id", playerData.id);

        if (playerAchievementsError) {
          throw playerAchievementsError;
        }

        playerAchievements.value =
          playerAchievementsData?.map((pa) => ({
            id: pa.id,
            achievement: pa.achievements as unknown as Achievement,
            progress: pa.progress,
            completed: pa.completed,
            completed_at: pa.completed_at,
          })) || [];

        // Get recent XP transactions
        const { data: xpData, error: xpError } = await supabase
          .from("xp_transactions")
          .select("*")
          .eq("player_id", playerData.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (xpError) {
          throw xpError;
        }

        recentXP.value = xpData || [];
      }
    } catch (err) {
      console.error("Error fetching progression:", err);
      error.value = err instanceof Error ? err.message : "Failed to fetch progression data";
    } finally {
      loading.value = false;
    }
  };

  const awardXP = async (amount: number, reason: string, metadata?: Record<string, unknown>) => {
    if (!redditUsername) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/award-xp`, {
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
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to award XP");
      }

      // Refresh progression data
      await fetchProgression();

      return result;
    } catch (err) {
      console.error("Error awarding XP:", err);
      throw err;
    }
  };

  const checkAchievements = async () => {
    if (!redditUsername) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-achievements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          reddit_username: redditUsername,
        }),
      });

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

  onMounted(() => {
    if (redditUsername) {
      fetchProgression();
    }
  });

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
