/*
  # Update Player Tracking Fields

  1. New Fields
    - Add tracking fields to players table for better statistics
      - `total_karma_chips_earned` (integer) - Total chips earned over time
      - `total_karma_chips_lost` (integer) - Total chips lost over time
      - `lowest_karma_chips` (integer) - Lowest chip count ever reached
      - `highest_karma_chips` (integer) - Highest chip count ever reached

  2. Functions
    - Update player stats tracking function to maintain these values
    - Add function to update player stats based on current points
*/

-- Add tracking fields to players table if they don't exist
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_karma_chips_earned integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_karma_chips_lost integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS lowest_karma_chips integer NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS highest_karma_chips integer NOT NULL DEFAULT 1000;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_players_xp ON players(xp DESC);
CREATE INDEX IF NOT EXISTS idx_players_level ON players(level DESC);

-- Function to update player stats based on current points
CREATE OR REPLACE FUNCTION update_player_stats(
  p_player_id uuid,
  p_current_points integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record players%ROWTYPE;
  updated_highest boolean := false;
  updated_lowest boolean := false;
BEGIN
  -- Get current player data
  SELECT * INTO player_record
  FROM players
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Update highest/lowest tracking
  IF p_current_points > player_record.highest_karma_chips THEN
    updated_highest := true;
  END IF;
  
  IF p_current_points < player_record.lowest_karma_chips THEN
    updated_lowest := true;
  END IF;

  -- Update player stats
  UPDATE players
  SET 
    lowest_karma_chips = LEAST(lowest_karma_chips, p_current_points),
    highest_karma_chips = GREATEST(highest_karma_chips, p_current_points)
  WHERE id = p_player_id;

  RETURN json_build_object(
    'success', true, 
    'updated_highest', updated_highest,
    'updated_lowest', updated_lowest
  );
END;
$$;

-- Function to track karma chips earned/lost
CREATE OR REPLACE FUNCTION track_karma_chips_transaction(
  p_player_id uuid,
  p_amount integer,
  p_is_earning boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_is_earning THEN
    -- Track earnings
    UPDATE players
    SET 
      total_karma_chips_earned = total_karma_chips_earned + p_amount,
      highest_karma_chips = GREATEST(highest_karma_chips, points + p_amount)
    WHERE id = p_player_id;
  ELSE
    -- Track losses
    UPDATE players
    SET 
      total_karma_chips_lost = total_karma_chips_lost + p_amount,
      lowest_karma_chips = LEAST(lowest_karma_chips, points - p_amount)
    WHERE id = p_player_id;
  END IF;
END;
$$;

-- Update existing players to set highest_karma_chips to their current points if higher
UPDATE players
SET highest_karma_chips = GREATEST(highest_karma_chips, points)
WHERE highest_karma_chips < points;

-- Create function to update player points with tracking
CREATE OR REPLACE FUNCTION update_player_points(
  p_player_id uuid,
  p_points_change integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record players%ROWTYPE;
  new_points integer;
BEGIN
  -- Get current player data
  SELECT * INTO player_record
  FROM players
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Calculate new points
  new_points := player_record.points + p_points_change;
  
  -- Ensure points don't go negative
  IF new_points < 0 THEN
    new_points := 0;
  END IF;

  -- Track earnings/losses
  IF p_points_change > 0 THEN
    -- Track earnings
    UPDATE players
    SET 
      points = new_points,
      total_karma_chips_earned = total_karma_chips_earned + p_points_change,
      highest_karma_chips = GREATEST(highest_karma_chips, new_points)
    WHERE id = p_player_id;
  ELSE
    -- Track losses (use absolute value for the loss amount)
    UPDATE players
    SET 
      points = new_points,
      total_karma_chips_lost = total_karma_chips_lost + ABS(p_points_change),
      lowest_karma_chips = LEAST(lowest_karma_chips, new_points)
    WHERE id = p_player_id;
  END IF;

  RETURN json_build_object(
    'success', true, 
    'new_balance', new_points,
    'points_change', p_points_change
  );
END;
$$;