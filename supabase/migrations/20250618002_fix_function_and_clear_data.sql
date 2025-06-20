-- Fix function return type issue and add post columns

-- Drop the existing function to allow recreation with new return type
DROP FUNCTION IF EXISTS place_bet_transaction(uuid, text, text, integer);

-- Add post columns to game_rounds table
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_a_id text;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_a_title text;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_a_author text;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_a_subreddit text;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_a_initial_score integer DEFAULT 0;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_a_final_score integer;

ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_b_id text;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_b_title text;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_b_author text;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_b_subreddit text;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_b_initial_score integer DEFAULT 0;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS post_b_final_score integer;

-- Clear old test data that uses comment fields without post fields
DELETE FROM bets 
WHERE round_id IN (
  SELECT id FROM game_rounds 
  WHERE post_a_title IS NULL OR post_b_title IS NULL
);

DELETE FROM game_rounds 
WHERE post_a_title IS NULL OR post_b_title IS NULL;

-- Recreate the place_bet_transaction function with correct return type
CREATE OR REPLACE FUNCTION place_bet_transaction(
  p_round_id uuid,
  p_reddit_id text,
  p_bet_on text,
  p_amount integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record players%ROWTYPE;
  round_record game_rounds%ROWTYPE;
  result json;
BEGIN
  -- Get player record
  SELECT * INTO player_record
  FROM players
  WHERE reddit_id = p_reddit_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Check if player has enough points
  IF player_record.points < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  -- Check if round is active
  SELECT * INTO round_record
  FROM game_rounds
  WHERE id = p_round_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Round is not active');
  END IF;

  -- Check if player already has a bet on this round
  IF EXISTS (
    SELECT 1 FROM bets 
    WHERE round_id = p_round_id AND player_id = player_record.id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You have already placed a bet on this round');
  END IF;

  -- Deduct points from player
  UPDATE players
  SET points = points - p_amount
  WHERE id = player_record.id;

  -- Insert bet
  INSERT INTO bets (round_id, player_id, bet_on, amount)
  VALUES (p_round_id, player_record.id, p_bet_on, p_amount);

  RETURN json_build_object('success', true, 'message', 'Bet placed successfully');
END;
$$;
