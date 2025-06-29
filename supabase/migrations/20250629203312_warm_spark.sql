/*
  # Portfolio Leaderboard View

  1. New View
    - `portfolio_leaderboard` - Aggregates player portfolio values for the meme market leaderboard
    
  2. Security
    - No changes to RLS policies needed as views inherit from underlying tables
*/

-- Create a view to track portfolio values by player
CREATE OR REPLACE VIEW portfolio_leaderboard AS
SELECT 
  p.id AS player_id,
  p.reddit_username,
  SUM(pp.shares_owned * ms.current_value) AS portfolio_value,
  SUM(pp.shares_owned) AS total_shares,
  SUM(pp.shares_owned * ms.current_value) - SUM(pp.shares_owned * pp.average_buy_price) AS profit_loss,
  COUNT(DISTINCT pp.stock_id) AS unique_stocks
FROM 
  players p
LEFT JOIN 
  player_portfolios pp ON p.id = pp.player_id
LEFT JOIN
  meme_stocks ms ON pp.stock_id = ms.id
WHERE
  pp.shares_owned > 0
GROUP BY 
  p.id, p.reddit_username
ORDER BY 
  portfolio_value DESC;

-- Add a comment to explain the view
COMMENT ON VIEW portfolio_leaderboard IS 'Aggregated view of players ranked by their meme stock portfolio value';