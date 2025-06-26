import { ref, onMounted, onUnmounted } from "vue";
import { supabase, GameRound, Player } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Constants for better maintainability
const POLLING_INTERVAL_MS = 30000; // 30 seconds
const PREVIOUS_ROUNDS_LIMIT = 10;
const LEADERBOARD_LIMIT = 10;

// Global subscription manager to prevent duplicate subscriptions
class SubscriptionManager {
  private static instance: SubscriptionManager;
  private roundsSubscription: RealtimeChannel | null = null;
  private playersSubscription: RealtimeChannel | null = null;
  private subscribers: Set<() => void> = new Set();

  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  subscribe(callback: () => void) {
    this.subscribers.add(callback);

    if (!this.roundsSubscription || !this.playersSubscription) {
      this.setupSubscriptions();
    }
  }

  unsubscribe(callback: () => void) {
    this.subscribers.delete(callback);

    if (this.subscribers.size === 0) {
      this.cleanup();
    }
  }

  private setupSubscriptions() {
    if (this.roundsSubscription || this.playersSubscription) {
      return; // Already set up
    }

    this.roundsSubscription = supabase
      .channel(`game_rounds_global_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rounds" }, () => {
        this.notifySubscribers();
      })
      .subscribe();

    this.playersSubscription = supabase
      .channel(`players_global_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => {
        this.notifySubscribers();
      })
      .subscribe();
  }

  private notifySubscribers() {
    this.subscribers.forEach((callback) => callback());
  }

  private cleanup() {
    if (this.roundsSubscription) {
      supabase.removeChannel(this.roundsSubscription);
      this.roundsSubscription = null;
    }
    if (this.playersSubscription) {
      supabase.removeChannel(this.playersSubscription);
      this.playersSubscription = null;
    }
  }
}

/**
 * Composable for managing game data including rounds, leaderboard, and betting functionality
 * Features real-time subscriptions and polling fallback
 */

export function useGameData() {
  const currentRounds = ref<GameRound[]>([]);
  const currentRound = ref<GameRound | null>(null); // Keep for backward compatibility
  const previousRounds = ref<GameRound[]>([]);
  const leaderboard = ref<Player[]>([]);
  const loading = ref(true);

  const fetchCurrentRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error && data) {
        currentRounds.value = data;
        currentRound.value = data[0] || null; // Set first round for backward compatibility
      } else {
        currentRounds.value = [];
        currentRound.value = null;
      }
    } catch {
      currentRounds.value = [];
      currentRound.value = null;
    }
  };

  // Keep the old function for backward compatibility
  const fetchCurrentRound = async () => {
    await fetchCurrentRounds();
  };

  const fetchPreviousRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "finished")
        .order("created_at", { ascending: false })
        .limit(PREVIOUS_ROUNDS_LIMIT);

      if (!error && data) {
        previousRounds.value = data;
      }
    } catch {
      previousRounds.value = [];
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("points", { ascending: false })
        .limit(LEADERBOARD_LIMIT);

      if (!error && data) {
        leaderboard.value = data;
      }
    } catch {
      leaderboard.value = [];
    }
  };

  const placeBet = async (roundId: string, betOn: "A" | "B", amount: number, redditId: string) => {
    const { data, error } = await supabase.rpc("place_bet_transaction", {
      p_round_id: roundId,
      p_reddit_id: redditId,
      p_bet_on: betOn,
      p_amount: amount,
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error);
    }

    return data;
  };

  const getUserBets = async (playerId: string, roundId?: string) => {
    let query = supabase.from("bets").select("*").eq("player_id", playerId);

    if (roundId) {
      query = query.eq("round_id", roundId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  };

  const updateCurrentScores = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("update-current-scores", {
        method: "POST",
      });

      if (error) {
        console.error("Error updating scores:", error);
        throw error;
      }

      // Refresh current round data after score update
      await fetchCurrentRound();
      return data;
    } catch (error) {
      console.error("Failed to update scores:", error);
      throw error;
    }
  };

  const refreshData = () => {
    fetchCurrentRound();
    fetchPreviousRounds();
    fetchLeaderboard();
  };

  let pollingInterval: NodeJS.Timeout | null = null;

  onMounted(async () => {
    loading.value = true;
    await Promise.all([fetchCurrentRound(), fetchPreviousRounds(), fetchLeaderboard()]);
    loading.value = false;

    // Use subscription manager to prevent duplicate subscriptions
    const subscriptionManager = SubscriptionManager.getInstance();
    const refreshCallback = () => {
      fetchCurrentRound();
      fetchPreviousRounds();
      fetchLeaderboard();
    };

    subscriptionManager.subscribe(refreshCallback);

    // Add polling as backup (every 30 seconds)
    pollingInterval = setInterval(() => {
      fetchCurrentRound();
      fetchPreviousRounds();
      fetchLeaderboard();
    }, POLLING_INTERVAL_MS);
  });

  onUnmounted(() => {
    const subscriptionManager = SubscriptionManager.getInstance();
    const refreshCallback = () => {
      fetchCurrentRound();
      fetchPreviousRounds();
      fetchLeaderboard();
    };

    subscriptionManager.unsubscribe(refreshCallback);
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
  });

  return {
    currentRound,
    currentRounds, // Add the new array of all active rounds
    previousRounds,
    leaderboard,
    loading,
    placeBet,
    getUserBets,
    updateCurrentScores,
    refreshData,
  };
}
