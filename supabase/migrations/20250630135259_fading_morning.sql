-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS award_xp(text, integer, text, jsonb);
DROP FUNCTION IF EXISTS check_achievements(text);
DROP FUNCTION IF EXISTS get_player_progression(text);

-- Ensure XP transactions table exists with proper structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'xp_transactions') THEN
    CREATE TABLE xp_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      amount integer NOT NULL,
      reason text NOT NULL,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now()
    );
    
    CREATE INDEX idx_xp_transactions_player_id ON xp_transactions(player_id);
    CREATE INDEX idx_xp_transactions_created_at ON xp_transactions(created_at);
  END IF;
END $$;

-- Ensure players table has XP and level columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'xp') THEN
    ALTER TABLE players ADD COLUMN xp integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'level') THEN
    ALTER TABLE players ADD COLUMN level integer DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'total_karma_chips_earned') THEN
    ALTER TABLE players ADD COLUMN total_karma_chips_earned integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'total_karma_chips_lost') THEN
    ALTER TABLE players ADD COLUMN total_karma_chips_lost integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'lowest_karma_chips') THEN
    ALTER TABLE players ADD COLUMN lowest_karma_chips integer DEFAULT 1000;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'highest_karma_chips') THEN
    ALTER TABLE players ADD COLUMN highest_karma_chips integer DEFAULT 1000;
  END IF;
END $$;

-- Function to award XP to a player
CREATE OR REPLACE FUNCTION award_xp(
  player_reddit_username text,
  xp_amount integer,
  reason text,
  metadata_json jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  success boolean,
  old_level integer,
  new_level integer,
  total_xp integer,
  level_up boolean,
  player_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_player players%ROWTYPE;
  old_xp integer;
  new_xp integer;
  old_level integer;
  new_level integer;
  level_up_occurred boolean := false;
  total_xp_needed integer;
BEGIN
  -- Get the player
  SELECT * INTO target_player
  FROM players
  WHERE reddit_username = player_reddit_username;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found: %', player_reddit_username;
  END IF;

  -- Store old values
  old_xp := COALESCE(target_player.xp, 0);
  old_level := COALESCE(target_player.level, 1);
  
  -- Calculate new XP
  new_xp := old_xp + xp_amount;
  
  -- Calculate new level
  -- Level progression: Level 2 = 100 XP total, Level 3 = 300 XP total, etc.
  new_level := 1;
  total_xp_needed := 0;
  
  WHILE total_xp_needed <= new_xp LOOP
    new_level := new_level + 1;
    total_xp_needed := total_xp_needed + ((new_level - 1) * 100);
  END LOOP;
  
  new_level := new_level - 1; -- Adjust back to correct level
  
  -- Check if level up occurred
  level_up_occurred := new_level > old_level;
  
  -- Update player
  UPDATE players
  SET 
    xp = new_xp,
    level = new_level
  WHERE id = target_player.id;
  
  -- Record XP transaction
  INSERT INTO xp_transactions (player_id, amount, reason, metadata)
  VALUES (target_player.id, xp_amount, reason, metadata_json);
  
  -- Return results
  RETURN QUERY SELECT 
    true as success,
    old_level,
    new_level,
    new_xp as total_xp,
    level_up_occurred as level_up,
    target_player.id as player_id;
END;
$$;

-- Function to check and update achievements
CREATE OR REPLACE FUNCTION check_achievements(
  player_reddit_username text
)
RETURNS TABLE(
  achievement_name text,
  newly_completed boolean,
  progress integer,
  requirement_value integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_player players%ROWTYPE;
  achievement_record achievements%ROWTYPE;
  current_progress integer;
  player_achievement_record player_achievements%ROWTYPE;
  newly_completed_flag boolean;
BEGIN
  -- Get the player
  SELECT * INTO target_player
  FROM players
  WHERE reddit_username = player_reddit_username;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found: %', player_reddit_username;
  END IF;

  -- Check each achievement
  FOR achievement_record IN 
    SELECT * FROM achievements ORDER BY requirement_value ASC
  LOOP
    -- Calculate current progress based on achievement type
    CASE achievement_record.requirement_type
      WHEN 'total_xp' THEN
        current_progress := COALESCE(target_player.xp, 0);
      WHEN 'level' THEN
        current_progress := COALESCE(target_player.level, 1);
      WHEN 'karma_chips_earned' THEN
        current_progress := COALESCE(target_player.total_karma_chips_earned, 0);
      WHEN 'bets_placed' THEN
        SELECT COUNT(*) INTO current_progress
        FROM bets
        WHERE player_id = target_player.id;
      WHEN 'rounds_won' THEN
        SELECT COUNT(*) INTO current_progress
        FROM bets b
        JOIN game_rounds gr ON b.round_id = gr.id
        WHERE b.player_id = target_player.id 
        AND gr.winner = b.bet_on
        AND gr.status = 'finished';
      ELSE
        current_progress := 0;
    END CASE;

    -- Get or create player achievement record
    SELECT * INTO player_achievement_record
    FROM player_achievements
    WHERE player_id = target_player.id 
    AND achievement_id = achievement_record.id;

    newly_completed_flag := false;

    IF NOT FOUND THEN
      -- Create new player achievement record
      INSERT INTO player_achievements (
        player_id, 
        achievement_id, 
        progress, 
        completed,
        completed_at
      )
      VALUES (
        target_player.id,
        achievement_record.id,
        current_progress,
        current_progress >= achievement_record.requirement_value,
        CASE WHEN current_progress >= achievement_record.requirement_value THEN now() ELSE NULL END
      );
      
      newly_completed_flag := current_progress >= achievement_record.requirement_value;
      
      -- Award rewards if completed
      IF newly_completed_flag THEN
        UPDATE players
        SET 
          xp = xp + achievement_record.xp_reward,
          points = points + achievement_record.karma_chips_reward
        WHERE id = target_player.id;
      END IF;
    ELSE
      -- Update existing record
      IF NOT player_achievement_record.completed AND current_progress >= achievement_record.requirement_value THEN
        newly_completed_flag := true;
        
        UPDATE player_achievements
        SET 
          progress = current_progress,
          completed = true,
          completed_at = now()
        WHERE id = player_achievement_record.id;
        
        -- Award rewards
        UPDATE players
        SET 
          xp = xp + achievement_record.xp_reward,
          points = points + achievement_record.karma_chips_reward
        WHERE id = target_player.id;
      ELSE
        -- Just update progress
        UPDATE player_achievements
        SET progress = current_progress
        WHERE id = player_achievement_record.id;
      END IF;
    END IF;

    -- Return achievement info
    RETURN QUERY SELECT 
      achievement_record.name as achievement_name,
      newly_completed_flag as newly_completed,
      current_progress as progress,
      achievement_record.requirement_value;
  END LOOP;
END;
$$;

-- Function to get player progression data
CREATE OR REPLACE FUNCTION get_player_progression(
  player_reddit_username text
)
RETURNS TABLE(
  player_id uuid,
  xp integer,
  level integer,
  total_karma_chips_earned integer,
  total_karma_chips_lost integer,
  lowest_karma_chips integer,
  highest_karma_chips integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as player_id,
    COALESCE(p.xp, 0) as xp,
    COALESCE(p.level, 1) as level,
    COALESCE(p.total_karma_chips_earned, 0) as total_karma_chips_earned,
    COALESCE(p.total_karma_chips_lost, 0) as total_karma_chips_lost,
    COALESCE(p.lowest_karma_chips, 1000) as lowest_karma_chips,
    COALESCE(p.highest_karma_chips, 1000) as highest_karma_chips
  FROM players p
  WHERE p.reddit_username = player_reddit_username;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_xp ON players(xp DESC);
CREATE INDEX IF NOT EXISTS idx_players_level ON players(level DESC);

-- Add RLS policies for XP transactions
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read xp transactions" ON xp_transactions;
CREATE POLICY "Anyone can read xp transactions" ON xp_transactions
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert xp transactions" ON xp_transactions;
CREATE POLICY "Authenticated users can insert xp transactions" ON xp_transactions
  FOR INSERT TO authenticated WITH CHECK (true);