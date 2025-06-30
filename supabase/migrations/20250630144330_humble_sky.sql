/*
  # Meme Stock Value Calculator

  1. New Functions
    - `calculate_meme_value`: Calculates meme stock value based on Reddit metrics
    - `simulate_reddit_metrics`: Generates realistic Reddit metrics for testing
    - `update_meme_stock_with_metrics`: Updates a meme stock with provided metrics

  2. Security
    - All functions are SECURITY DEFINER to ensure proper access control
    - RLS policies remain unchanged
*/

-- Function to calculate meme stock value based on Reddit metrics
CREATE OR REPLACE FUNCTION calculate_meme_value(
  keyword text,
  mention_count integer,
  sentiment_score numeric,
  comment_count integer,
  upvote_ratio numeric,
  volatility_factor numeric DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_value integer;
  sentiment_multiplier numeric;
  engagement_multiplier numeric;
  volatility numeric;
  final_value integer;
BEGIN
  -- Base value from mentions (10-500)
  base_value := greatest(10, least(500, mention_count / 2));
  
  -- Sentiment affects price direction (-1.0 to 1.0)
  -- Convert to multiplier range (0.7 to 1.3)
  sentiment_multiplier := 1.0 + (sentiment_score * 0.3);
  
  -- Engagement multiplier based on comments and upvote ratio
  engagement_multiplier := 1.0 + (comment_count::numeric / 1000) * upvote_ratio;
  
  -- Volatility - either provided or random (0.8 to 1.2)
  volatility := COALESCE(volatility_factor, 0.8 + random() * 0.4);
  
  -- Calculate final value with all factors
  final_value := greatest(5, least(10000, 
    floor((base_value * sentiment_multiplier * engagement_multiplier * volatility)::numeric)::integer
  ));
  
  RETURN final_value;
END;
$$;

-- Function to simulate realistic Reddit metrics for testing
CREATE OR REPLACE FUNCTION simulate_reddit_metrics(
  keyword text,
  base_mentions integer DEFAULT NULL,
  base_sentiment numeric DEFAULT NULL
)
RETURNS TABLE (
  mention_count integer,
  sentiment_score numeric,
  comment_count integer,
  upvote_ratio numeric,
  volatility numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Keyword characteristics affect simulation
  keyword_length integer := length(keyword);
  is_trending boolean := random() < 0.3; -- 30% chance any keyword is trending
  mentions integer;
  sentiment numeric;
BEGIN
  -- Base mentions - either provided or generated based on keyword characteristics
  mentions := COALESCE(base_mentions, 
    CASE 
      WHEN is_trending THEN floor(random() * 800 + 200)::integer -- Trending: 200-1000
      WHEN keyword_length < 5 THEN floor(random() * 300 + 50)::integer -- Short keywords get more mentions
      ELSE floor(random() * 200 + 20)::integer -- Normal range: 20-220
    END
  );
  
  -- Sentiment - either provided or generated
  -- Shorter keywords tend to have more positive sentiment
  sentiment := COALESCE(base_sentiment,
    CASE
      WHEN is_trending THEN (random() * 1.6 - 0.8) -- Trending: -0.8 to 0.8 (more volatile)
      WHEN keyword_length < 5 THEN (random() * 1.2) - 0.2 -- Short: -0.2 to 1.0 (more positive)
      ELSE (random() * 2) - 1 -- Full range: -1.0 to 1.0
    END
  );
  
  -- Comment count correlates with mentions
  comment_count := floor(mentions * (0.5 + random() * 1.5))::integer;
  
  -- Upvote ratio correlates with sentiment
  -- Convert sentiment from -1...1 to 0.5...0.95
  upvote_ratio := 0.5 + ((sentiment + 1) / 2) * 0.45;
  
  -- Volatility - trending keywords are more volatile
  volatility := CASE
    WHEN is_trending THEN 0.3 + random() * 0.5 -- 0.3 to 0.8
    ELSE 0.1 + random() * 0.3 -- 0.1 to 0.4
  END;
  
  RETURN QUERY SELECT 
    mentions, 
    sentiment, 
    comment_count, 
    upvote_ratio, 
    volatility;
END;
$$;

-- Function to update a meme stock with provided metrics
CREATE OR REPLACE FUNCTION update_meme_stock_with_metrics(
  p_stock_id uuid,
  p_mention_count integer,
  p_sentiment_score numeric,
  p_comment_count integer,
  p_upvote_ratio numeric,
  p_volatility numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stock_record meme_stocks%ROWTYPE;
  new_value integer;
  old_value integer;
  metrics_json jsonb;
BEGIN
  -- Get the stock
  SELECT * INTO stock_record
  FROM meme_stocks
  WHERE id = p_stock_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Stock not found'
    );
  END IF;
  
  -- Store old value for comparison
  old_value := stock_record.current_value;
  
  -- Calculate new value based on metrics
  new_value := calculate_meme_value(
    stock_record.meme_keyword,
    p_mention_count,
    p_sentiment_score,
    p_comment_count,
    p_upvote_ratio,
    p_volatility
  );
  
  -- Store metrics in JSON for history
  metrics_json := jsonb_build_object(
    'mention_count', p_mention_count,
    'sentiment_score', p_sentiment_score,
    'comment_count', p_comment_count,
    'upvote_ratio', p_upvote_ratio,
    'volatility', p_volatility,
    'timestamp', now()
  );
  
  -- Update the stock with new value and metrics
  -- Use the existing update_stock_history function to handle history updates
  PERFORM update_stock_history(p_stock_id, new_value);
  
  -- Return result
  RETURN json_build_object(
    'success', true,
    'stock_id', p_stock_id,
    'keyword', stock_record.meme_keyword,
    'old_value', old_value,
    'new_value', new_value,
    'change_percentage', ((new_value - old_value)::numeric / old_value) * 100,
    'metrics', metrics_json
  );
END;
$$;

-- Add comments to functions
COMMENT ON FUNCTION calculate_meme_value(text, integer, numeric, integer, numeric, numeric) IS 
  'Calculates meme stock value based on Reddit metrics including mentions, sentiment, engagement and volatility';

COMMENT ON FUNCTION simulate_reddit_metrics(text, integer, numeric) IS 
  'Generates realistic Reddit metrics for testing meme stock calculations';

COMMENT ON FUNCTION update_meme_stock_with_metrics(uuid, integer, numeric, integer, numeric, numeric) IS 
  'Updates a meme stock with provided Reddit metrics and calculates new value';

-- Test the functions with a few stocks
DO $$
DECLARE
  stock_record meme_stocks%ROWTYPE;
  metrics record;
  result json;
BEGIN
  -- Update a few stocks with simulated metrics
  FOR stock_record IN 
    SELECT * FROM meme_stocks WHERE is_active = true LIMIT 5
  LOOP
    -- Generate simulated metrics for this keyword
    SELECT * INTO metrics FROM simulate_reddit_metrics(stock_record.meme_keyword);
    
    -- Update the stock with these metrics
    SELECT update_meme_stock_with_metrics(
      stock_record.id,
      metrics.mention_count,
      metrics.sentiment_score,
      metrics.comment_count,
      metrics.upvote_ratio,
      metrics.volatility
    ) INTO result;
    
    RAISE NOTICE 'Updated stock %: %', stock_record.meme_keyword, result;
  END LOOP;
END;
$$;