// Meta-minutes utility functions for Productivity Paradox
// Now using database storage via Supabase

import { supabase } from "./supabase";

export const updateMetaMinutes = async (playerId: string, minutesToAdd: number) => {
  try {
    const { data, error } = await supabase.rpc("update_meta_minutes", {
      p_player_id: playerId,
      p_minutes_to_add: minutesToAdd,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating meta minutes:", error);
    throw error;
  }
};

export const updatePlayerPoints = async (playerId: string, pointsChange: number) => {
  try {
    const { data, error } = await supabase.rpc("update_player_points", {
      p_player_id: playerId,
      p_points_change: pointsChange,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating player points:", error);
    throw error;
  }
};
