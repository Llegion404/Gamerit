/*
  # Subreddit Reigns Game Schema

  1. New Tables
    - `subreddit_campaigns` - Tracks available subreddit campaigns
    - `player_campaigns` - Tracks player progress in campaigns
    - `subreddit_dilemmas` - Stores dilemmas fetched from Reddit

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for read/write access
*/

-- Create subreddit_campaigns table
CREATE TABLE IF NOT EXISTS subreddit_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit text NOT NULL,
  name text NOT NULL,
  description text,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create player_campaigns table
CREATE TABLE IF NOT EXISTS player_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES subreddit_campaigns(id) ON DELETE CASCADE,
  highest_day_reached integer NOT NULL DEFAULT 0,
  highest_influence integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(player_id, campaign_id)
);

-- Create subreddit_dilemmas table
CREATE TABLE IF NOT EXISTS subreddit_dilemmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit text NOT NULL,
  post_id text NOT NULL,
  post_title text NOT NULL,
  post_author text NOT NULL,
  choice_a_text text NOT NULL,
  choice_a_score integer NOT NULL,
  choice_a_author text NOT NULL,
  choice_b_text text NOT NULL,
  choice_b_score integer NOT NULL,
  choice_b_author text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subreddit_campaigns_subreddit ON subreddit_campaigns(subreddit);
CREATE INDEX IF NOT EXISTS idx_subreddit_campaigns_difficulty ON subreddit_campaigns(difficulty);
CREATE INDEX IF NOT EXISTS idx_player_campaigns_player_id ON player_campaigns(player_id);
CREATE INDEX IF NOT EXISTS idx_player_campaigns_completed ON player_campaigns(completed);
CREATE INDEX IF NOT EXISTS idx_subreddit_dilemmas_subreddit ON subreddit_dilemmas(subreddit);

-- Enable Row Level Security
ALTER TABLE subreddit_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE subreddit_dilemmas ENABLE ROW LEVEL SECURITY;

-- Policies for subreddit_campaigns (public read access)
CREATE POLICY "Anyone can read subreddit campaigns"
  ON subreddit_campaigns
  FOR SELECT
  TO public
  USING (true);

-- Policies for player_campaigns (player-specific access)
CREATE POLICY "Players can read their own campaign progress"
  ON player_campaigns
  FOR SELECT
  TO public
  USING (player_id = auth.uid() OR player_id IN (
    SELECT id FROM players WHERE reddit_id = auth.uid()::text
  ));

CREATE POLICY "Players can update their own campaign progress"
  ON player_campaigns
  FOR UPDATE
  TO public
  USING (player_id = auth.uid() OR player_id IN (
    SELECT id FROM players WHERE reddit_id = auth.uid()::text
  ))
  WITH CHECK (player_id = auth.uid() OR player_id IN (
    SELECT id FROM players WHERE reddit_id = auth.uid()::text
  ));

CREATE POLICY "Players can insert their own campaign progress"
  ON player_campaigns
  FOR INSERT
  TO public
  WITH CHECK (player_id = auth.uid() OR player_id IN (
    SELECT id FROM players WHERE reddit_id = auth.uid()::text
  ));

-- Policies for subreddit_dilemmas (public read access)
CREATE POLICY "Anyone can read subreddit dilemmas"
  ON subreddit_dilemmas
  FOR SELECT
  TO public
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_karma_rush_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER trigger_update_subreddit_campaigns_updated_at
  BEFORE UPDATE ON subreddit_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_karma_rush_stats_updated_at();

CREATE TRIGGER trigger_update_player_campaigns_updated_at
  BEFORE UPDATE ON player_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_karma_rush_stats_updated_at();

-- Insert initial campaigns
INSERT INTO subreddit_campaigns (subreddit, name, description, difficulty) VALUES 
  ('AmItheAsshole', 'Am I The Asshole?', 'Judge interpersonal conflicts and moral dilemmas', 'easy'),
  ('relationship_advice', 'Relationship Guru', 'Navigate complex relationship scenarios', 'medium'),
  ('wallstreetbets', 'Diamond Hands', 'Survive the chaotic world of meme stocks and YOLO investments', 'hard')
ON CONFLICT DO NOTHING;

-- Function to update player campaign progress
CREATE OR REPLACE FUNCTION update_player_campaign_progress(
  p_player_id uuid,
  p_subreddit text,
  p_day_reached integer,
  p_influence integer,
  p_completed boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign_id uuid;
  v_existing_record player_campaigns%ROWTYPE;
BEGIN
  -- Get campaign ID
  SELECT id INTO v_campaign_id
  FROM subreddit_campaigns
  WHERE subreddit = p_subreddit;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Campaign not found');
  END IF;
  
  -- Check if player already has a record for this campaign
  SELECT * INTO v_existing_record
  FROM player_campaigns
  WHERE player_id = p_player_id AND campaign_id = v_campaign_id;
  
  IF FOUND THEN
    -- Update existing record if new progress is better
    UPDATE player_campaigns
    SET 
      highest_day_reached = GREATEST(highest_day_reached, p_day_reached),
      highest_influence = GREATEST(highest_influence, p_influence),
      completed = completed OR p_completed,
      updated_at = now()
    WHERE id = v_existing_record.id;
  ELSE
    -- Insert new record
    INSERT INTO player_campaigns (
      player_id, campaign_id, highest_day_reached, highest_influence, completed
    ) VALUES (
      p_player_id, v_campaign_id, p_day_reached, p_influence, p_completed
    );
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function to fetch a random dilemma
CREATE OR REPLACE FUNCTION get_random_dilemma(p_subreddit text)
RETURNS subreddit_dilemmas
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  dilemma_record subreddit_dilemmas%ROWTYPE;
BEGIN
  -- Get a random dilemma for the specified subreddit
  SELECT * INTO dilemma_record
  FROM subreddit_dilemmas
  WHERE subreddit = p_subreddit
  ORDER BY random()
  LIMIT 1;
  
  RETURN dilemma_record;
END;
$$;