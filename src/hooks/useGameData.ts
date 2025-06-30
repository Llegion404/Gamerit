import { useState, useEffect, useCallback } from "react";
import { supabase, GameRound, Player } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Constants for better maintainability
const POLLING_INTERVAL_MS = 30000; // 30 seconds
const PREVIOUS_ROUNDS_LIMIT = 10;
const LEADERBOARD_LIMIT = 10;
const REACTIVE_REFRESH_DELAY = 1000; // 1 second delay for reactive refresh

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
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rounds" }, (payload) => {
        console.log("Game rounds change detected:", payload);
        this.notifySubscribers();
      })
      .subscribe();

    this.playersSubscription = supabase
      .channel(`players_global_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload) => {
        console.log("Players change detected:", payload);
        this.notifySubscribers();
      })
      .subscribe();
  }

  private notifySubscribers() {
    console.log(`Notifying ${this.subscribers.size} subscribers of data changes`);
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

  const fetchCurrentRounds = useCallback(async () => {
    try {
      console.log("Fetching current rounds...");
      
      // Add connection test before making requests
      const connectionTest = await supabase.from("game_rounds").select("count").limit(1);
      if (connectionTest.error) {
        console.error("Supabase connection test failed:", connectionTest.error);
        throw new Error(`Database connection failed: ${connectionTest.error.message}`);
      }
      
      const { data, error } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error && data) {
        console.log(`Found ${data.length} active rounds`);
        setCurrentRounds(data);
        setCurrentRound(data[0] || null); // Set first round for backward compatibility
        setLastRefreshTime(Date.now());
      } else {
        console.log("No active rounds found or error occurred:", error);
        if (error) {
          console.error("Database error details:", error);
        }
        setCurrentRounds([]);
        setCurrentRound(null);
      }
    } catch (error) {
      console.error("Error fetching current rounds:", error);
      // Provide more specific error information
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error("Network connectivity issue detected. Please check:");
        console.error("1. Internet connection");
        console.error("2. Supabase project status");
        console.error("3. CORS configuration in Supabase dashboard");
        console.error("4. Environment variables are correct");
      }
      setCurrentRounds([]);
      setCurrentRound(null);
    }
  }, []);

  // Keep the old function for backward compatibility
  const fetchCurrentRound = useCallback(async () => {
    await fetchCurrentRounds();
  }, [fetchCurrentRounds]);

  const fetchPreviousRounds = useCallback(async () => {
    try {
      console.log("Fetching previous rounds...");
      const { data, error } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "finished")
        .order("created_at", { ascending: false })
        .limit(PREVIOUS_ROUNDS_LIMIT);

      if (!error && data) {
        console.log(`Found ${data.length} previous rounds`);
        setPreviousRounds(data);
      }
    } catch (error) {
      console.error("Error fetching previous rounds:", error);
      setPreviousRounds([]);
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      console.log("Fetching leaderboard...");
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("points", { ascending: false })
        .limit(LEADERBOARD_LIMIT);

      if (!error && data) {
        console.log(`Found ${data.length} players in leaderboard`);
        setLeaderboard(data);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      setLeaderboard([]);
    }
  }, []);

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
      console.log("Updating current scores...");
      const { data, error } = await supabase.functions.invoke("update-current-scores", {
        method: "POST",
      });

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
  };

  useEffect(() => {
    const loadData = async () => {
      console.log("Initial data load starting...");
      setLoading(true);
      await Promise.all([fetchCurrentRound(), fetchPreviousRounds(), fetchLeaderboard()]);
      setLoading(false);
      console.log("Initial data load completed");
    };

    loadData();

    // Use subscription manager to prevent duplicate subscriptions
    const subscriptionManager = SubscriptionManager.getInstance();
    const refreshCallback = () => {
      console.log("Real-time refresh triggered");
      fetchCurrentRound();
      fetchPreviousRounds();
      fetchLeaderboard();
    };

    subscriptionManager.subscribe(refreshCallback);

    // Add polling as backup (every 30 seconds)
    const pollingInterval = setInterval(() => {
      console.log("Polling refresh triggered");
      fetchCurrentRound();
      fetchPreviousRounds();
      fetchLeaderboard();
    }, POLLING_INTERVAL_MS);

    return () => {
      subscriptionManager.unsubscribe(refreshCallback);
      clearInterval(pollingInterval);
    };
  }, [fetchCurrentRound, fetchPreviousRounds, fetchLeaderboard]);

  const refreshData = useCallback(() => {
    console.log("Manual refresh triggered");
    fetchCurrentRound();
    fetchPreviousRounds();
    fetchLeaderboard();
  }, [fetchCurrentRound, fetchPreviousRounds, fetchLeaderboard]);

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