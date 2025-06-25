/*
  # Reddit Radio Database Schema

  1. New Tables
    - `radio_stations`
      - `id` (uuid, primary key)
      - `name` (text, station name)
      - `subreddits` (text[], list of subreddit names)
      - `player_id` (uuid, foreign key to players)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `radio_stations` table
    - Add policies for users to manage their own stations
*/

CREATE TABLE IF NOT EXISTS radio_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subreddits text[] NOT NULL DEFAULT '{}',
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE radio_stations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own radio stations"
  ON radio_stations
  FOR SELECT
  TO public
  USING (player_id = auth.uid() OR player_id IN (
    SELECT id FROM players WHERE reddit_id = auth.uid()::text
  ));

CREATE POLICY "Users can create radio stations"
  ON radio_stations
  FOR INSERT
  TO public
  WITH CHECK (player_id IN (
    SELECT id FROM players WHERE reddit_id = auth.uid()::text
  ));

CREATE POLICY "Users can update own radio stations"
  ON radio_stations
  FOR UPDATE
  TO public
  USING (player_id IN (
    SELECT id FROM players WHERE reddit_id = auth.uid()::text
  ))
  WITH CHECK (player_id IN (
    SELECT id FROM players WHERE reddit_id = auth.uid()::text
  ));

CREATE POLICY "Users can delete own radio stations"
  ON radio_stations
  FOR DELETE
  TO public
  USING (player_id IN (
    SELECT id FROM players WHERE reddit_id = auth.uid()::text
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_radio_stations_player_id ON radio_stations(player_id);
CREATE INDEX IF NOT EXISTS idx_radio_stations_created_at ON radio_stations(created_at);

-- Update trigger
CREATE OR REPLACE FUNCTION update_radio_stations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_radio_stations_updated_at
  BEFORE UPDATE ON radio_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_radio_stations_updated_at();