-- Clear old test data and ensure new rounds use post fields

-- Delete old test data that uses comment fields without post fields
DELETE FROM bets 
WHERE round_id IN (
  SELECT id FROM game_rounds 
  WHERE post_a_title IS NULL OR post_b_title IS NULL
);

DELETE FROM game_rounds 
WHERE post_a_title IS NULL OR post_b_title IS NULL;

-- The application will now create new rounds using the post-based system
-- with proper post titles and data
