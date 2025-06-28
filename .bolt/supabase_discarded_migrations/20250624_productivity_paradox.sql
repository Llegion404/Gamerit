-- Add meta_minutes field to players table for Productivity Paradox feature
ALTER TABLE players ADD COLUMN meta_minutes integer DEFAULT 0;

-- Update existing players to have 0 meta_minutes
UPDATE players SET meta_minutes = 0 WHERE meta_minutes IS NULL;

-- Add function to update player points
CREATE OR REPLACE FUNCTION update_player_points(
  p_player_id uuid,
  p_points_change integer
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_total integer;
BEGIN
  -- Update the player's points
  UPDATE players 
  SET points = points + p_points_change
  WHERE id = p_player_id
  RETURNING points INTO v_new_total;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Player not found'
    );
  END IF;
  
  -- Check if player would have negative points
  IF v_new_total < 0 THEN
    -- Rollback the update
    UPDATE players 
    SET points = points - p_points_change
    WHERE id = p_player_id;
    
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient points'
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'new_total', v_new_total,
    'message', 'Points updated successfully'
  );
END;
$$;

-- Add function to update meta_minutes
CREATE OR REPLACE FUNCTION update_meta_minutes(
  p_player_id uuid,
  p_minutes_to_add integer
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_total integer;
BEGIN
  -- Update the player's meta_minutes
  UPDATE players 
  SET meta_minutes = meta_minutes + p_minutes_to_add
  WHERE id = p_player_id
  RETURNING meta_minutes INTO v_new_total;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Player not found'
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'new_total', v_new_total,
    'message', 'Meta-minutes updated successfully'
  );
END;
$$;

-- Update get_or_create_player function to include meta_minutes
CREATE OR REPLACE FUNCTION get_or_create_player(
  p_reddit_id text,
  p_reddit_username text,
  p_avatar_url text DEFAULT NULL
)
RETURNS players
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record players%ROWTYPE;
BEGIN
  -- Try to get existing player
  SELECT * INTO player_record
  FROM players
  WHERE reddit_id = p_reddit_id;

  IF FOUND THEN
    -- Update username and avatar in case they changed
    UPDATE players
    SET 
      reddit_username = p_reddit_username,
      avatar_url = COALESCE(p_avatar_url, avatar_url)
    WHERE reddit_id = p_reddit_id
    RETURNING * INTO player_record;
  ELSE
    -- Create new player with starting balance and meta_minutes
    INSERT INTO players (reddit_id, reddit_username, points, avatar_url, meta_minutes)
    VALUES (p_reddit_id, p_reddit_username, 1000, p_avatar_url, 0)
    RETURNING * INTO player_record;
  END IF;

  RETURN player_record;
END;
$$;
