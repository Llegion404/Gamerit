/*
  # Database Functions for Karma Casino

  1. Functions
    - `place_bet_transaction` - Atomically place bet and deduct points
    - `add_points_to_player` - Add points to player account
*/

-- Function to handle bet placement transaction
CREATE OR REPLACE FUNCTION place_bet_transaction(
  p_round_id uuid,
  p_player_username text,
  p_bet_on text,
  p_amount integer
) RETURNS void AS $$
DECLARE
  v_player_id uuid;
  v_current_points integer;
BEGIN
  -- Get player ID and current points
  SELECT id, points INTO v_player_id, v_current_points
  FROM players 
  WHERE reddit_username = p_player_username;
  
  -- Check if player exists and has enough points
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;
  
  IF v_current_points < p_amount THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;
  
  -- Deduct points from player
  UPDATE players 
  SET points = points - p_amount
  WHERE id = v_player_id;
  
  -- Insert bet record
  INSERT INTO bets (round_id, player_id, bet_on, amount)
  VALUES (p_round_id, v_player_id, p_bet_on, p_amount);
END;
$$ LANGUAGE plpgsql;

-- Function to add points to player
CREATE OR REPLACE FUNCTION add_points_to_player(
  p_player_id uuid,
  p_points integer
) RETURNS void AS $$
BEGIN
  UPDATE players 
  SET points = points + p_points
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;