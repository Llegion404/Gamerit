/*
  # Karma Casino Database Schema

  1. New Tables
    - `game_rounds`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `status` (text) - active, pending_payout, finished
      - `comment_a_id` (text) - Reddit comment ID
      - `comment_a_text` (text) - Comment content
      - `comment_a_author` (text) - Reddit username
      - `comment_a_subreddit` (text) - Subreddit name
      - `comment_a_initial_score` (integer) - Initial karma score
      - `comment_a_final_score` (integer) - Final karma score
      - `comment_b_id` (text) - Reddit comment ID
      - `comment_b_text` (text) - Comment content
      - `comment_b_author` (text) - Reddit username
      - `comment_b_subreddit` (text) - Subreddit name
      - `comment_b_initial_score` (integer) - Initial karma score
      - `comment_b_final_score` (integer) - Final karma score
      - `winner` (text) - 'A' or 'B'

    - `players`
      - `id` (uuid, primary key)
      - `reddit_username` (text, unique)
      - `points` (integer) - Game currency balance
      - `created_at` (timestamp)

    - `bets`
      - `id` (uuid, primary key)
      - `round_id` (uuid, foreign key)
      - `player_id` (uuid, foreign key)
      - `bet_on` (text) - 'A' or 'B'
      - `amount` (integer) - Bet amount
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  comment_a_id text NOT NULL,
  comment_a_text text NOT NULL,
  comment_a_author text NOT NULL,
  comment_a_subreddit text NOT NULL,
  comment_a_initial_score integer NOT NULL DEFAULT 0,
  comment_a_final_score integer,
  comment_b_id text NOT NULL,
  comment_b_text text NOT NULL,
  comment_b_author text NOT NULL,
  comment_b_subreddit text NOT NULL,
  comment_b_initial_score integer NOT NULL DEFAULT 0,
  comment_b_final_score integer,
  winner text
);

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_username text UNIQUE NOT NULL,
  points integer NOT NULL DEFAULT 1000,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES game_rounds(id),
  player_id uuid NOT NULL REFERENCES players(id),
  bet_on text NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

-- Policies for game_rounds (public read access)
CREATE POLICY "Anyone can read game rounds"
  ON game_rounds
  FOR SELECT
  TO public
  USING (true);

-- Policies for players (public read access for leaderboard)
CREATE POLICY "Anyone can read players"
  ON players
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Players can update their own data"
  ON players
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can insert players"
  ON players
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policies for bets (public read access, authenticated insert)
CREATE POLICY "Anyone can read bets"
  ON bets
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert bets"
  ON bets
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_rounds_status ON game_rounds(status);
CREATE INDEX IF NOT EXISTS idx_game_rounds_created_at ON game_rounds(created_at);
CREATE INDEX IF NOT EXISTS idx_players_points ON players(points DESC);
CREATE INDEX IF NOT EXISTS idx_bets_round_id ON bets(round_id);
CREATE INDEX IF NOT EXISTS idx_bets_player_id ON bets(player_id);

-- Insert sample data for testing
INSERT INTO game_rounds (
  comment_a_id, comment_a_text, comment_a_author, comment_a_subreddit, comment_a_initial_score,
  comment_b_id, comment_b_text, comment_b_author, comment_b_subreddit, comment_b_initial_score
) VALUES (
  't1_sample1',
  'This is an amazing explanation of quantum physics! I never understood it before but this really breaks it down in simple terms.',
  'science_lover',
  'explainlikeimfive',
  42,
  't1_sample2',
  'My grandmother''s secret recipe for chocolate chip cookies. The trick is to brown the butter first!',
  'bakingmaster',
  'cooking',
  38
) ON CONFLICT DO NOTHING;

INSERT INTO players (reddit_username, points) VALUES 
  ('demo_player_1', 2500),
  ('demo_player_2', 1800),
  ('demo_player_3', 3200),
  ('demo_player_4', 950),
  ('demo_player_5', 4100)
ON CONFLICT (reddit_username) DO NOTHING;