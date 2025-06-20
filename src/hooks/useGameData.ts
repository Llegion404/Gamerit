import { useState, useEffect, useCallback } from "react";
import { supabase, GameRound, Player } from "../lib/supabase";

// Constants for better maintainability
const POLLING_INTERVAL_MS = 30000; // 30 seconds
const PREVIOUS_ROUNDS_LIMIT = 10;
const LEADERBOARD_LIMIT = 10;

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

  const fetchCurrentRounds = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCurrentRounds(data);
        setCurrentRound(data[0] || null); // Set first round for backward compatibility
      } else {
        setCurrentRounds([]);
        setCurrentRound(null);
      }
    } catch {
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
      const { data, error } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "finished")
        .order("created_at", { ascending: false })
        .limit(PREVIOUS_ROUNDS_LIMIT);

      if (!error && data) {
        setPreviousRounds(data);
      }
    } catch {
      setPreviousRounds([]);
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("points", { ascending: false })
        .limit(LEADERBOARD_LIMIT);

      if (!error && data) {
        setLeaderboard(data);
      }
    } catch {
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCurrentRound(), fetchPreviousRounds(), fetchLeaderboard()]);
      setLoading(false);
    };

    loadData();

    // Set up real-time subscriptions
    const roundsSubscription = supabase
      .channel("game_rounds")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rounds" }, () => {
        fetchCurrentRound();
        fetchPreviousRounds();
      })
      .subscribe();

    const playersSubscription = supabase
      .channel("players")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    // Add polling as backup (every 30 seconds)
    const pollingInterval = setInterval(() => {
      fetchCurrentRound();
      fetchPreviousRounds();
      fetchLeaderboard();
    }, POLLING_INTERVAL_MS);

    return () => {
      supabase.removeChannel(roundsSubscription);
      supabase.removeChannel(playersSubscription);
      clearInterval(pollingInterval);
    };
  }, [fetchCurrentRound, fetchPreviousRounds, fetchLeaderboard]);

  const refreshData = useCallback(() => {
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
    placeBet,
    getUserBets,
    updateCurrentScores,
    refreshData,
  };
}
