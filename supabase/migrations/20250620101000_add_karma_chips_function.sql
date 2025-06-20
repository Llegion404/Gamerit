-- Function: add_karma_chips
-- Adds the specified amount of karma chips to a player's balance

CREATE OR REPLACE FUNCTION add_karma_chips(player_id uuid, amount integer)
RETURNS void AS $$
BEGIN
  UPDATE players
  SET balance = balance + amount
  WHERE id = player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
