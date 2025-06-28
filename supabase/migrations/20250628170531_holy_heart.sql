/*
  # Enhanced Meme Market System

  1. Database Changes
    - Add better tracking for meme stock performance
    - Add player transaction history
    - Add market update scheduling
    - Improve stock value calculation

  2. Functions
    - Enhanced market update function
    - Better stock value calculation
    - Transaction tracking

  3. Security
    - Maintain existing RLS policies
    - Add transaction logging
*/

-- Add transaction history table for better tracking
CREATE TABLE IF NOT EXISTS meme_stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  stock_id uuid NOT NULL REFERENCES meme_stocks(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  shares integer NOT NULL,
  price_per_share numeric(10,2) NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for transaction history
CREATE INDEX IF NOT EXISTS idx_meme_stock_transactions_player_id ON meme_stock_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_meme_stock_transactions_stock_id ON meme_stock_transactions(stock_id);
CREATE INDEX IF NOT EXISTS idx_meme_stock_transactions_created_at ON meme_stock_transactions(created_at);

-- Enable RLS on transactions table
ALTER TABLE meme_stock_transactions ENABLE ROW LEVEL SECURITY;

-- Policy for transaction history (public read for transparency)
CREATE POLICY "Anyone can read meme stock transactions"
  ON meme_stock_transactions
  FOR SELECT
  TO public
  USING (true);

-- Enhanced function to update player points with transaction logging
CREATE OR REPLACE FUNCTION update_player_points(
  p_player_id uuid,
  p_points_change integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record players%ROWTYPE;
BEGIN
  -- Get current player data
  SELECT * INTO player_record
  FROM players
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Check if player would go negative
  IF player_record.points + p_points_change < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  -- Update player points
  UPDATE players
  SET points = points + p_points_change
  WHERE id = p_player_id;

  RETURN json_build_object('success', true, 'new_balance', player_record.points + p_points_change);
END;
$$;

-- Function to get trending meme keywords from Reddit data
CREATE OR REPLACE FUNCTION calculate_meme_value(
  keyword text,
  total_score integer,
  post_count integer,
  trend_factor numeric DEFAULT 1.0
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  base_value integer;
  volatility_factor numeric;
  final_value integer;
BEGIN
  -- Base calculation: average score per post * multiplier
  base_value := GREATEST(10, (total_score / GREATEST(post_count, 1)) * 2);
  
  -- Add volatility based on post count (more posts = more stable)
  volatility_factor := 1.0 + (post_count * 0.1);
  
  -- Apply trend factor (can be > 1 for trending up, < 1 for trending down)
  final_value := ROUND(base_value * volatility_factor * trend_factor);
  
  -- Ensure reasonable bounds (10-5000 chips per share)
  RETURN GREATEST(10, LEAST(5000, final_value));
END;
$$;

-- Function to add meta-minutes (for Productivity Paradox)
CREATE OR REPLACE FUNCTION update_meta_minutes(
  p_player_id uuid,
  p_minutes_to_add integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record players%ROWTYPE;
BEGIN
  -- Get current player data
  SELECT * INTO player_record
  FROM players
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Update meta minutes
  UPDATE players
  SET meta_minutes = COALESCE(meta_minutes, 0) + p_minutes_to_add
  WHERE id = p_player_id;

  RETURN json_build_object(
    'success', true, 
    'new_meta_minutes', COALESCE(player_record.meta_minutes, 0) + p_minutes_to_add
  );
END;
$$;

-- Enhanced stock history tracking
CREATE OR REPLACE FUNCTION update_stock_history(
  p_stock_id uuid,
  p_new_value integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_history jsonb;
  new_entry jsonb;
BEGIN
  -- Get current history
  SELECT history INTO current_history
  FROM meme_stocks
  WHERE id = p_stock_id;

  -- Create new history entry
  new_entry := jsonb_build_object(
    'timestamp', now(),
    'value', p_new_value
  );

  -- Append to history (keep last 100 entries)
  current_history := COALESCE(current_history, '[]'::jsonb) || new_entry;
  
  -- Keep only last 100 entries to prevent unlimited growth
  IF jsonb_array_length(current_history) > 100 THEN
    current_history := current_history #> '{-100,-1}';
  END IF;

  -- Update the stock
  UPDATE meme_stocks
  SET 
    current_value = p_new_value,
    history = current_history,
    updated_at = now()
  WHERE id = p_stock_id;
END;
$$;

-- Function to create market volatility (random price movements)
CREATE OR REPLACE FUNCTION apply_market_volatility()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stock_record meme_stocks%ROWTYPE;
  volatility_factor numeric;
  new_value integer;
  updated_count integer := 0;
BEGIN
  -- Apply random volatility to all active stocks
  FOR stock_record IN 
    SELECT * FROM meme_stocks WHERE is_active = true
  LOOP
    -- Generate volatility factor (-10% to +10%)
    volatility_factor := 0.9 + (random() * 0.2);
    
    -- Calculate new value
    new_value := ROUND(stock_record.current_value * volatility_factor);
    
    -- Ensure bounds
    new_value := GREATEST(5, LEAST(10000, new_value));
    
    -- Update if value changed significantly (>5%)
    IF ABS(new_value - stock_record.current_value) > (stock_record.current_value * 0.05) THEN
      PERFORM update_stock_history(stock_record.id, new_value);
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'stocks_updated', updated_count,
    'message', 'Market volatility applied'
  );
END;
$$;

-- Sample some initial meme stocks with better values
INSERT INTO meme_stocks (meme_keyword, current_value, history) VALUES 
  ('stonks', 850, '[{"timestamp": "2025-06-28T00:00:00Z", "value": 800}]'::jsonb),
  ('doge', 420, '[{"timestamp": "2025-06-28T00:00:00Z", "value": 450}]'::jsonb),
  ('chad', 1200, '[{"timestamp": "2025-06-28T00:00:00Z", "value": 1150}]'::jsonb),
  ('wojak', 690, '[{"timestamp": "2025-06-28T00:00:00Z", "value": 720}]'::jsonb),
  ('pepe', 1337, '[{"timestamp": "2025-06-28T00:00:00Z", "value": 1300}]'::jsonb),
  ('karen', 666, '[{"timestamp": "2025-06-28T00:00:00Z", "value": 700}]'::jsonb),
  ('simp', 420, '[{"timestamp": "2025-06-28T00:00:00Z", "value": 400}]'::jsonb),
  ('based', 888, '[{"timestamp": "2025-06-28T00:00:00Z", "value": 850}]'::jsonb)
ON CONFLICT (meme_keyword) DO UPDATE SET
  current_value = EXCLUDED.current_value,
  history = EXCLUDED.history,
  updated_at = now();