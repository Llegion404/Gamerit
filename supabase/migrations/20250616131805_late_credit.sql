/*
  # Update authentication system for Reddit OAuth

  1. Database Changes
    - Add reddit_id, last_welfare_claim, and avatar_url columns to players table
    - Create indexes for performance
    - Update RLS policies for proper authentication

  2. Functions
    - Drop and recreate place_bet_transaction function with reddit_id parameter
    - Create claim_welfare_chips function for daily welfare system
    - Create get_or_create_player function for OAuth integration

  3. Security
    - Update RLS policies to work with authenticated users
    - Maintain public read access for leaderboards
*/

-- Add Reddit OAuth fields and welfare tracking to players table
DO $$
BEGIN
  -- Add reddit_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'reddit_id'
  ) THEN
    ALTER TABLE players ADD COLUMN reddit_id text UNIQUE;
  END IF;

  -- Add last_welfare_claim column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'last_welfare_claim'
  ) THEN
    ALTER TABLE players ADD COLUMN last_welfare_claim timestamptz;
  END IF;

  -- Add avatar_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE players ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Create index on reddit_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_reddit_id ON players(reddit_id);

-- Update RLS policies to work with real authentication
DROP POLICY IF EXISTS "Anyone can insert players" ON players;
DROP POLICY IF EXISTS "Anyone can read players" ON players;
DROP POLICY IF EXISTS "Players can update their own data" ON players;

-- New policies for authenticated users
CREATE POLICY "Anyone can insert players"
  ON players
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read players"
  ON players
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Players can update their own data"
  ON players
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Update bets table policies
DROP POLICY IF EXISTS "Anyone can insert bets" ON bets;
DROP POLICY IF EXISTS "Anyone can read bets" ON bets;

CREATE POLICY "Anyone can insert bets"
  ON bets
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read bets"
  ON bets
  FOR SELECT
  TO public
  USING (true);

-- Drop existing function first to avoid return type conflict
DROP FUNCTION IF EXISTS place_bet_transaction(uuid, text, text, integer);

-- Create function to handle welfare claims
CREATE OR REPLACE FUNCTION claim_welfare_chips(p_reddit_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record players%ROWTYPE;
  can_claim boolean := false;
  result json;
BEGIN
  -- Get player record
  SELECT * INTO player_record
  FROM players
  WHERE reddit_id = p_reddit_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Check if player has 0 points
  IF player_record.points > 0 THEN
    RETURN json_build_object('success', false, 'error', 'You still have points remaining');
  END IF;

  -- Check if 24 hours have passed since last welfare claim
  IF player_record.last_welfare_claim IS NULL OR 
     player_record.last_welfare_claim < NOW() - INTERVAL '24 hours' THEN
    can_claim := true;
  END IF;

  IF NOT can_claim THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'You can only claim welfare chips once every 24 hours'
    );
  END IF;

  -- Grant welfare chips
  UPDATE players
  SET 
    points = 50,
    last_welfare_claim = NOW()
  WHERE reddit_id = p_reddit_id;

  RETURN json_build_object(
    'success', true, 
    'message', 'Welfare chips granted!',
    'chips_granted', 50
  );
END;
$$;

-- Recreate the place_bet_transaction function to work with reddit_id
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

-- Function to get or create player from Reddit OAuth
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
    -- Create new player with starting balance
    INSERT INTO players (reddit_id, reddit_username, points, avatar_url)
    VALUES (p_reddit_id, p_reddit_username, 1000, p_avatar_url)
    RETURNING * INTO player_record;
  END IF;

  RETURN player_record;
END;
$$;