import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase, GameRound, Player } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Constants for better maintainability
const POLLING_INTERVAL_MS = 30000; // 30 seconds
const PREVIOUS_ROUNDS_LIMIT = 10;
const LEADERBOARD_LIMIT = 10;
const REACTIVE_REFRESH_DELAY = 1000; // 1 second delay for reactive refresh
const MIN_REFRESH_INTERVAL = 2000; // Minimum 2 seconds between refreshes

// Global cache to prevent duplicate requests
class DataCache {
  private static instance: DataCache;
  private cache = new Map<
    string,
    { data: any; timestamp: number; promise?: Promise<any> }
  >();
  private readonly CACHE_TTL = 5000; // 5 seconds

  static getInstance(): DataCache {
    if (!DataCache.instance) {
      DataCache.instance = new DataCache();
    }
    return DataCache.instance;
  }

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached data if still valid
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Return ongoing promise if exists
    if (cached?.promise) {
      return cached.promise;
    }

    // Create new request
    const promise = fetcher();
    this.cache.set(key, { data: null, timestamp: now, promise });

    try {
      const data = await promise;
      this.cache.set(key, { data, timestamp: now });
      return data;
    } catch (error) {
      this.cache.delete(key);
      throw error;
    }
  }

  invalidate(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

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

    console.log("Setting up real-time subscriptions for game data");

    this.roundsSubscription = supabase
      .channel(`game_rounds_global_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rounds" },
        (payload) => {
          console.log("Game rounds change detected:", payload);
          this.notifySubscribers();
        },
      )
      .subscribe();

    this.playersSubscription = supabase
      .channel(`players_global_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          console.log("Players change detected:", payload);
          this.notifySubscribers();
        },
      )
      .subscribe();
  }

  private notifySubscribers() {
    console.log(
      `Notifying ${this.subscribers.size} subscribers of data changes`,
    );
    // Add a small delay to ensure database consistency
    setTimeout(() => {
      this.subscribers.forEach((callback) => callback());
    }, REACTIVE_REFRESH_DELAY);
  }

  private cleanup() {
    console.log("Cleaning up real-time subscriptions");
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
 * Custom hook for managing game data including rounds, leaderboard, and betting functionality
 * Features real-time subscriptions and polling fallback
 */

export function useGameData() {
  const [currentRounds, setCurrentRounds] = useState<GameRound[]>([]);
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null); // Keep for backward compatibility
  const [previousRounds, setPreviousRounds] = useState<GameRound[]>([]);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);

  // Refs to track loading states and prevent duplicate requests
  const loadingStates = useRef({
    currentRounds: false,
    previousRounds: false,
    leaderboard: false,
  });

  const cache = useMemo(() => DataCache.getInstance(), []);

  const fetchCurrentRounds = useCallback(async () => {
    if (loadingStates.current.currentRounds) return;

    try {
      loadingStates.current.currentRounds = true;
      console.log("Fetching current rounds...");

      const data = await cache.get("current-rounds", async () => {
        const { data, error } = await supabase
          .from("game_rounds")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
      });

      console.log(`Found ${data.length} active rounds`);
      setCurrentRounds(data);
      setCurrentRound(data[0] || null); // Set first round for backward compatibility
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error("Error fetching current rounds:", error);
      // Provide more specific error information
      if (
        error instanceof TypeError &&
        error.message.includes("Failed to fetch")
      ) {
        const troubleshootingMessage = `
Network connectivity issue detected. Please check:
1. Internet connection is working
2. Environment variables are set correctly in .env.local:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
3. Supabase project is active and accessible
4. CORS configuration in Supabase dashboard allows your domain

Current configuration:
- Supabase URL: ${import.meta.env.VITE_SUPABASE_URL || "NOT SET"}
- Anon Key: ${import.meta.env.VITE_SUPABASE_ANON_KEY ? "SET" : "NOT SET"}`;

        console.error(troubleshootingMessage);
      }
      setCurrentRounds([]);
      setCurrentRound(null);
    } finally {
      loadingStates.current.currentRounds = false;
    }
  }, [cache]);

  // Keep the old function for backward compatibility
  const fetchCurrentRound = useCallback(async () => {
    await fetchCurrentRounds();
  }, [fetchCurrentRounds]);

  const fetchPreviousRounds = useCallback(async () => {
    if (loadingStates.current.previousRounds) return;

    try {
      loadingStates.current.previousRounds = true;
      console.log("Fetching previous rounds...");

      const data = await cache.get("previous-rounds", async () => {
        const { data, error } = await supabase
          .from("game_rounds")
          .select("*")
          .eq("status", "finished")
          .order("created_at", { ascending: false })
          .limit(PREVIOUS_ROUNDS_LIMIT);

        if (error) throw error;
        return data || [];
      });

      console.log(`Found ${data.length} previous rounds`);
      setPreviousRounds(data);
    } catch (error) {
      console.error("Error fetching previous rounds:", error);
      setPreviousRounds([]);
    } finally {
      loadingStates.current.previousRounds = false;
    }
  }, [cache]);

  const fetchLeaderboard = useCallback(async () => {
    if (loadingStates.current.leaderboard) return;

    try {
      loadingStates.current.leaderboard = true;
      console.log("Fetching leaderboard...");

      const data = await cache.get("leaderboard", async () => {
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .order("points", { ascending: false })
          .limit(LEADERBOARD_LIMIT);

        if (error) throw error;
        return data || [];
      });

      console.log(`Found ${data.length} players in leaderboard`);
      setLeaderboard(data);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      setLeaderboard([]);
    } finally {
      loadingStates.current.leaderboard = false;
    }
  }, [cache]);

  const placeBet = useCallback(
    async (
      roundId: string,
      betOn: "A" | "B",
      amount: number,
      redditId: string,
    ) => {
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
    },
    [],
  );

  const getUserBets = useCallback(
    async (playerId: string, roundId?: string) => {
      let query = supabase.from("bets").select("*").eq("player_id", playerId);

      if (roundId) {
        query = query.eq("round_id", roundId);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      return data;
    },
    [],
  );

  const updateCurrentScores = useCallback(async () => {
    try {
      console.log("Updating current scores...");
      const { data, error } = await supabase.functions.invoke(
        "update-current-scores",
        {
          method: "POST",
        },
      );

      if (error) {
        console.error("Error updating scores:", error);
        throw error;
      }

      console.log("Scores updated successfully, refreshing data...");
      // Refresh current round data after score update
      await fetchCurrentRound();
      return data;
    } catch (error) {
      console.error("Failed to update scores:", error);
      throw error;
    }
  }, [fetchCurrentRound]);

  useEffect(() => {
    const loadData = async () => {
      console.log("Initial data load starting...");
      setLoading(true);

      // Load data in parallel but prevent duplicate requests with cache
      await Promise.allSettled([
        fetchCurrentRounds(),
        fetchPreviousRounds(),
        fetchLeaderboard(),
      ]);

      setLoading(false);
      console.log("Initial data load completed");
    };

    loadData();

    // Use subscription manager to prevent duplicate subscriptions
    const subscriptionManager = SubscriptionManager.getInstance();

    // Throttle refresh calls to prevent excessive API calls
    let refreshTimeout: NodeJS.Timeout | null = null;
    const refreshCallback = () => {
      if (refreshTimeout) return; // Prevent rapid successive calls

      refreshTimeout = setTimeout(() => {
        console.log("Real-time refresh triggered");
        cache.invalidate(); // Clear cache to force fresh data
        fetchCurrentRounds();
        fetchPreviousRounds();
        fetchLeaderboard();
        refreshTimeout = null;
      }, 1000); // 1 second throttle
    };

    subscriptionManager.subscribe(refreshCallback);

    // Reduce polling frequency and add throttling
    const pollingInterval = setInterval(() => {
      console.log("Polling refresh triggered");
      cache.invalidate(); // Clear cache for polling refresh
      fetchCurrentRounds();
      fetchPreviousRounds();
      fetchLeaderboard();
    }, POLLING_INTERVAL_MS);

    return () => {
      subscriptionManager.unsubscribe(refreshCallback);
      clearInterval(pollingInterval);
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [fetchCurrentRounds, fetchPreviousRounds, fetchLeaderboard, cache]);

  const refreshData = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
      console.log("Refresh throttled - too soon since last refresh");
      return;
    }

    console.log("Manual refresh triggered");
    cache.invalidate(); // Clear cache for manual refresh
    fetchCurrentRounds();
    fetchPreviousRounds();
    fetchLeaderboard();
  }, [
    fetchCurrentRounds,
    fetchPreviousRounds,
    fetchLeaderboard,
    cache,
    lastRefreshTime,
  ]);

  return {
    currentRound,
    currentRounds, // Add the new array of all active rounds
    previousRounds,
    leaderboard,
    loading,
    lastRefreshTime,
    placeBet,
    getUserBets,
    updateCurrentScores,
    refreshData,
  };
}
