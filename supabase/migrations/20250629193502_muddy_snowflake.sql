/*
  # Update Leaderboard to Track Bets

  1. New Tables
    - `bet_leaderboard` - View that aggregates bet amounts by player
    
  2. Changes
    - Create a view to track total bet amounts
    - Update the Leaderboard component to use bet data
*/

-- Create a view to track total bet amounts by player
CREATE OR REPLACE VIEW bet_leaderboard AS
SELECT 
  p.id AS player_id,
  p.reddit_username,
  p.points,
  COALESCE(SUM(b.amount), 0) AS total_bet_amount,
  COUNT(b.id) AS total_bets
FROM 
  players p
LEFT JOIN 
  bets b ON p.id = b.player_id
GROUP BY 
  p.id, p.reddit_username, p.points
ORDER BY 
  total_bet_amount DESC, p.points DESC;

-- Add a comment to explain the view
COMMENT ON VIEW bet_leaderboard IS 'Aggregated view of players ranked by their total bet amounts';