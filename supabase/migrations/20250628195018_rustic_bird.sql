/*
  # Update Meme Market to Use Only Real Data

  1. Changes
    - Remove market volatility function
    - Enhance stock value calculation based on real Reddit data
    - Update stock history tracking to focus on real data changes
    - Add comments explaining the real-data approach

  2. Security
    - No changes to RLS policies needed
*/

-- Drop the market volatility function as we're moving to real data only
DROP FUNCTION IF EXISTS apply_market_volatility();

-- Enhance the stock value calculation to focus on real Reddit data
CREATE OR REPLACE FUNCTION calculate_meme_value(
  keyword text,
  total_score integer,
  post_count integer,
  comment_count integer,
  upvote_ratio numeric DEFAULT 0.75
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  base_value integer;
  engagement_factor numeric;
  final_value integer;
BEGIN
  -- Base calculation: weighted average of post scores
  base_value := GREATEST(50, (total_score / GREATEST(post_count, 1)) * 2);
  
  -- Engagement factor based on comments and upvote ratio
  -- Higher comment count and better upvote ratio = more valuable
  engagement_factor := (comment_count * 0.05) * upvote_ratio;
  
  -- Calculate final value with engagement
  final_value := ROUND(base_value * (1 + engagement_factor));
  
  -- Ensure reasonable bounds (10-5000 chips per share)
  RETURN GREATEST(10, LEAST(5000, final_value));
END;
$$;

-- Update the stock history tracking function to focus on real data
CREATE OR REPLACE FUNCTION update_stock_history(
  p_stock_id uuid,
  p_new_value integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_history jsonb;
  current_value integer;
  new_entry jsonb;
  significant_change boolean;
BEGIN
  -- Get current history and value
  SELECT history, current_value INTO current_history, current_value
  FROM meme_stocks
  WHERE id = p_stock_id;
  
  -- Only update if there's a significant change (>3%)
  -- This prevents minor fluctuations and focuses on real trend changes
  significant_change := ABS(p_new_value - current_value) > (current_value * 0.03);
  
  IF significant_change THEN
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
  END IF;
END;
$$;

-- Add a comment explaining the real-data approach
COMMENT ON TABLE meme_stocks IS 'Meme stocks with values based on real Reddit engagement metrics. Prices update based on actual post performance, upvotes, and viral momentum.';

-- Update the update_meme_market function description
COMMENT ON FUNCTION update_stock_history IS 'Updates meme stock history based on real Reddit data changes. Only records significant changes (>3%) to focus on meaningful trends.';