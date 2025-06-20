-- Add additional fields to archaeology_challenges table for better tracking

ALTER TABLE archaeology_challenges 
ADD COLUMN IF NOT EXISTS thread_url text,
ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS author text,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_archaeology_challenges_active ON archaeology_challenges(is_active);
CREATE INDEX IF NOT EXISTS idx_archaeology_challenges_comment_count ON archaeology_challenges(comment_count);
CREATE INDEX IF NOT EXISTS idx_archaeology_challenges_subreddit ON archaeology_challenges(subreddit);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_archaeology_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_archaeology_challenges_updated_at ON archaeology_challenges;
CREATE TRIGGER trigger_update_archaeology_challenges_updated_at
  BEFORE UPDATE ON archaeology_challenges
  FOR EACH ROW EXECUTE FUNCTION update_archaeology_challenges_updated_at();
