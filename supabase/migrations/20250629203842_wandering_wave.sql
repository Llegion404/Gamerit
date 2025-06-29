/*
  # Update Bet Leaderboard View

  1. Changes
    - Replace total_bet_amount with highest_bet_amount
    - Show the highest single bet a player has made instead of the sum of all bets
    - Keep other statistics like win rate and total bets

  2. Security
    - No changes to RLS policies needed
*/

-- Drop the existing view
DROP VIEW IF EXISTS bet_leaderboard;

-- Create an improved version of the bet leaderboard view
CREATE OR REPLACE VIEW bet_leaderboard AS
SELECT 
  p.id AS player_id,
  p.reddit_username,
  p.points,
  COALESCE(MAX(b.amount), 0) AS highest_bet_amount,
  COUNT(b.id) AS total_bets,
  COUNT(DISTINCT b.round_id) AS unique_rounds_bet,
  COALESCE(SUM(CASE WHEN gr.winner = b.bet_on THEN b.amount * 2 ELSE 0 END), 0) AS total_winnings,
  COALESCE(SUM(CASE WHEN gr.winner = b.bet_on THEN 1 ELSE 0 END), 0) AS winning_bets,
  CASE 
    WHEN COUNT(b.id) > 0 THEN 
      ROUND((COALESCE(SUM(CASE WHEN gr.winner = b.bet_on THEN 1 ELSE 0 END), 0)::numeric / COUNT(b.id) * 100), 1)
    ELSE 0
  END AS win_rate
FROM 
  players p
LEFT JOIN 
  bets b ON p.id = b.player_id
LEFT JOIN
  game_rounds gr ON b.round_id = gr.id
GROUP BY 
  p.id, p.reddit_username, p.points
ORDER BY 
  highest_bet_amount DESC, total_bets DESC, p.points DESC;

-- Add a comment to explain the view
COMMENT ON VIEW bet_leaderboard IS 'Comprehensive leaderboard of players ranked by their highest bet amount, with detailed betting statistics';