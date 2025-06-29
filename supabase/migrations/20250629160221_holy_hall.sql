/*
  # Subreddit Reigns Feature

  1. New Tables
    - `subreddit_dilemmas` - Stores the post and comment pairs for the game
    - `subreddit_campaigns` - Defines the available subreddit campaigns
    - `player_campaigns` - Tracks player progress in each campaign

  2. Security
    - Enable RLS on all tables
    - Add policies for proper data access
*/

-- Create subreddit_dilemmas table if it doesn't exist
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
  created_at timestamptz DEFAULT now()
);

-- Create unique index on post_id if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS subreddit_dilemmas_post_id_key ON subreddit_dilemmas(post_id);

-- Create subreddit_campaigns table if it doesn't exist
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

-- Create player_campaigns table if it doesn't exist
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

-- Create indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_subreddit_campaigns_subreddit ON subreddit_campaigns(subreddit);
CREATE INDEX IF NOT EXISTS idx_subreddit_campaigns_difficulty ON subreddit_campaigns(difficulty);
CREATE INDEX IF NOT EXISTS idx_player_campaigns_player_id ON player_campaigns(player_id);
CREATE INDEX IF NOT EXISTS idx_player_campaigns_completed ON player_campaigns(completed);
CREATE INDEX IF NOT EXISTS idx_subreddit_dilemmas_subreddit ON subreddit_dilemmas(subreddit);

-- Enable Row Level Security if not already enabled
ALTER TABLE subreddit_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE subreddit_dilemmas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can read subreddit campaigns" ON subreddit_campaigns;
DROP POLICY IF EXISTS "Players can read their own campaign progress" ON player_campaigns;
DROP POLICY IF EXISTS "Players can update their own campaign progress" ON player_campaigns;
DROP POLICY IF EXISTS "Players can insert their own campaign progress" ON player_campaigns;
DROP POLICY IF EXISTS "Anyone can read subreddit dilemmas" ON subreddit_dilemmas;

-- Recreate policies
CREATE POLICY "Anyone can read subreddit campaigns"
  ON subreddit_campaigns
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Players can read their own campaign progress"
  ON player_campaigns
  FOR SELECT
  TO public
  USING ((player_id = auth.uid()) OR (player_id IN ( SELECT players.id
   FROM players
  WHERE (players.reddit_id = (auth.uid())::text))));

CREATE POLICY "Players can update their own campaign progress"
  ON player_campaigns
  FOR UPDATE
  TO public
  USING ((player_id = auth.uid()) OR (player_id IN ( SELECT players.id
   FROM players
  WHERE (players.reddit_id = (auth.uid())::text))))
  WITH CHECK ((player_id = auth.uid()) OR (player_id IN ( SELECT players.id
   FROM players
  WHERE (players.reddit_id = (auth.uid())::text))));

CREATE POLICY "Players can insert their own campaign progress"
  ON player_campaigns
  FOR INSERT
  TO public
  WITH CHECK ((player_id = auth.uid()) OR (player_id IN ( SELECT players.id
   FROM players
  WHERE (players.reddit_id = (auth.uid())::text))));

CREATE POLICY "Anyone can read subreddit dilemmas"
  ON subreddit_dilemmas
  FOR SELECT
  TO public
  USING (true);

-- Function to update updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION update_karma_rush_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at if they don't exist
DROP TRIGGER IF EXISTS trigger_update_subreddit_campaigns_updated_at ON subreddit_campaigns;
CREATE TRIGGER trigger_update_subreddit_campaigns_updated_at
  BEFORE UPDATE ON subreddit_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_karma_rush_stats_updated_at();

DROP TRIGGER IF EXISTS trigger_update_player_campaigns_updated_at ON player_campaigns;
CREATE TRIGGER trigger_update_player_campaigns_updated_at
  BEFORE UPDATE ON player_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_karma_rush_stats_updated_at();

-- Insert initial campaigns if they don't exist
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

-- Insert some sample dilemmas for testing
INSERT INTO subreddit_dilemmas (
  subreddit, post_id, post_title, post_author, 
  choice_a_text, choice_a_score, choice_a_author,
  choice_b_text, choice_b_score, choice_b_author
) VALUES 
  (
    'AmItheAsshole', 
    'aita1', 
    'AITA for uninviting my sister from my wedding after she announced her pregnancy there?', 
    'wedding_drama_throwaway',
    'NTA. It was your day, and she deliberately stole your spotlight. She should have waited for another occasion to share her news.',
    15420,
    'wedding_etiquette_pro',
    'YTA. You''re punishing her for being happy during a happy event. Family celebrations should be about sharing joy, not hoarding attention.',
    -2340,
    'family_first_always'
  ),
  (
    'relationship_advice',
    'rel1',
    'My (28F) boyfriend (30M) of 5 years won''t propose because he ''doesn''t believe in marriage''',
    'waiting_forever_28',
    'This is a fundamental incompatibility. If marriage is important to you and he''s unwilling to compromise, you need to decide if this is a dealbreaker. Don''t waste more years hoping he''ll change.',
    8740,
    'relationship_therapist',
    'Marriage is just a piece of paper. If he loves you and is committed, why ruin a good relationship over a ceremony? You''re being shallow.',
    -1230,
    'marriage_is_outdated'
  ),
  (
    'wallstreetbets',
    'wsb1',
    'Should I YOLO my life savings into $GME calls?',
    'rocket_emoji_guy',
    'This is the way. Diamond hands to the moon! 🚀🚀🚀 Not financial advice.',
    42069,
    'tendies_collector',
    'Please don''t. Diversify your portfolio and only invest what you can afford to lose. Consider index funds for long-term growth.',
    -6942,
    'responsible_investor'
  )
ON CONFLICT (post_id) DO NOTHING;