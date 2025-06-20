-- Create a function to check if we need a new round and trigger creation
CREATE OR REPLACE FUNCTION check_and_create_round()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_round_count INTEGER;
  last_round_time TIMESTAMPTZ;
  result TEXT;
BEGIN
  -- Check if there's already an active round
  SELECT COUNT(*) INTO active_round_count
  FROM game_rounds
  WHERE status = 'active';
  
  IF active_round_count > 0 THEN
    RETURN 'Active round already exists';
  END IF;
  
  -- Check when the last round was created
  SELECT MAX(created_at) INTO last_round_time
  FROM game_rounds;
  
  -- If no rounds exist or last round was more than 23 hours ago, we need a new round
  IF last_round_time IS NULL OR last_round_time < (NOW() - INTERVAL '23 hours') THEN
    -- Here we would trigger the edge function
    -- For now, just return that a round should be created
    RETURN 'New round needed - call create-auto-round edge function';
  ELSE
    RETURN 'Recent round exists, no new round needed';
  END IF;
END;
$$;

-- Create a simple trigger function that can be called manually or by external schedulers
-- This allows flexibility in how the scheduling is implemented
COMMENT ON FUNCTION check_and_create_round() IS 'Checks if a new round is needed and returns instruction';
