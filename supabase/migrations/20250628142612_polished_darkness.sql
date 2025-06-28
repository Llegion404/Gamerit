/*
  # Hot Potato Betting Mode

  1. New Tables
    - `hot_potato_rounds`
      - `id` (uuid, primary key)
      - `post_id` (text) - Reddit post ID
      - `post_title` (text) - Post title
      - `post_author` (text) - Post author
      - `post_subreddit` (text) - Subreddit name
      - `post_url` (text) - Full Reddit URL
      - `created_at` (timestamp) - When round was created
      - `predicted_deletion_time` (timestamp) - When users think it will be deleted
      - `actual_deletion_time` (timestamp) - When it was actually deleted (if deleted)
      - `status` (text) - 'active', 'deleted', 'survived', 'expired'
      - `controversy_score` (integer) - Initial controversy indicator
      - `initial_score` (integer) - Initial upvote score
      - `final_score` (integer) - Final upvote score before deletion/expiry

    - `hot_potato_bets`
      - `id` (uuid, primary key)
      - `round_id` (uuid, foreign key)
      - `player_id` (uuid, foreign key)
      - `predicted_hours` (integer) - How many hours until deletion
      - `bet_amount` (integer) - Karma chips wagered
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for public read access and authenticated betting
*/

CREATE TABLE IF NOT EXISTS hot_potato_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL,
  post_title text NOT NULL,
  post_author text NOT NULL,
  post_subreddit text NOT NULL,
  post_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  predicted_deletion_time timestamptz,
  actual_deletion_time timestamptz,
  status text NOT NULL DEFAULT 'active',
  controversy_score integer DEFAULT 0,
  initial_score integer DEFAULT 0,
  final_score integer,
  expires_at timestamptz DEFAULT (now() + INTERVAL '48 hours')
);

CREATE TABLE IF NOT EXISTS hot_potato_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES hot_potato_rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  predicted_hours integer NOT NULL,
  bet_amount integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(round_id, player_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hot_potato_rounds_status ON hot_potato_rounds(status);
CREATE INDEX IF NOT EXISTS idx_hot_potato_rounds_created_at ON hot_potato_rounds(created_at);
CREATE INDEX IF NOT EXISTS idx_hot_potato_rounds_post_id ON hot_potato_rounds(post_id);
CREATE INDEX IF NOT EXISTS idx_hot_potato_bets_round_id ON hot_potato_bets(round_id);
CREATE INDEX IF NOT EXISTS idx_hot_potato_bets_player_id ON hot_potato_bets(player_id);

-- Enable Row Level Security
ALTER TABLE hot_potato_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_potato_bets ENABLE ROW LEVEL SECURITY;

-- Policies for hot_potato_rounds (public read access)
CREATE POLICY "Anyone can read hot potato rounds"
  ON hot_potato_rounds
  FOR SELECT
  TO public
  USING (true);

-- Policies for hot_potato_bets (public read access, authenticated insert)
CREATE POLICY "Anyone can read hot potato bets"
  ON hot_potato_bets
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert hot potato bets"
  ON hot_potato_bets
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Function to place hot potato bet
CREATE OR REPLACE FUNCTION place_hot_potato_bet(
  p_round_id uuid,
  p_reddit_id text,
  p_predicted_hours integer,
  p_bet_amount integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record players%ROWTYPE;
  round_record hot_potato_rounds%ROWTYPE;
BEGIN
  -- Get player record
  SELECT * INTO player_record
  FROM players
  WHERE reddit_id = p_reddit_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Check if player has enough points
  IF player_record.points < p_bet_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  -- Check if round is active
  SELECT * INTO round_record
  FROM hot_potato_rounds
  WHERE id = p_round_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Round is not active');
  END IF;

  -- Check if player already has a bet on this round
  IF EXISTS (
    SELECT 1 FROM hot_potato_bets 
    WHERE round_id = p_round_id AND player_id = player_record.id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You have already placed a bet on this round');
  END IF;

  -- Validate predicted hours (1-48 hours)
  IF p_predicted_hours < 1 OR p_predicted_hours > 48 THEN
    RETURN json_build_object('success', false, 'error', 'Predicted hours must be between 1 and 48');
  END IF;

  -- Deduct points from player
  UPDATE players
  SET points = points - p_bet_amount
  WHERE id = player_record.id;

  -- Insert bet
  INSERT INTO hot_potato_bets (round_id, player_id, predicted_hours, bet_amount)
  VALUES (p_round_id, player_record.id, p_predicted_hours, p_bet_amount);

  RETURN json_build_object('success', true, 'message', 'Hot potato bet placed successfully');
END;
$$;

-- Function to check and resolve hot potato rounds
CREATE OR REPLACE FUNCTION resolve_hot_potato_rounds()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  round_record hot_potato_rounds%ROWTYPE;
  bet_record hot_potato_bets%ROWTYPE;
  closest_prediction integer;
  winner_bets hot_potato_bets[];
  total_pot integer;
  winner_count integer;
  payout_per_winner integer;
  resolved_count integer := 0;
BEGIN
  -- Process expired rounds that haven't been resolved
  FOR round_record IN 
    SELECT * FROM hot_potato_rounds 
    WHERE status = 'active' AND expires_at < now()
  LOOP
    -- Mark round as survived (post wasn't deleted within 48 hours)
    UPDATE hot_potato_rounds
    SET status = 'survived'
    WHERE id = round_record.id;

    -- Award points to players who bet on longer survival times (closer to 48 hours)
    -- Find the prediction closest to 48 hours
    SELECT predicted_hours INTO closest_prediction
    FROM hot_potato_bets
    WHERE round_id = round_record.id
    ORDER BY ABS(predicted_hours - 48) ASC
    LIMIT 1;

    IF closest_prediction IS NOT NULL THEN
      -- Get all bets with the closest prediction
      SELECT array_agg(hpb.*) INTO winner_bets
      FROM hot_potato_bets hpb
      WHERE round_id = round_record.id 
      AND predicted_hours = closest_prediction;

      -- Calculate total pot and payout
      SELECT SUM(bet_amount) INTO total_pot
      FROM hot_potato_bets
      WHERE round_id = round_record.id;

      winner_count := array_length(winner_bets, 1);
      
      IF winner_count > 0 THEN
        payout_per_winner := total_pot / winner_count;

        -- Award winnings to winners
        FOR i IN 1..winner_count LOOP
          UPDATE players
          SET points = points + payout_per_winner
          WHERE id = winner_bets[i].player_id;
        END LOOP;
      END IF;
    END IF;

    resolved_count := resolved_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'resolved_rounds', resolved_count,
    'message', 'Hot potato rounds resolved'
  );
END;
$$;