/*
  # Remove Productivity Paradox Feature

  1. Database Changes
    - Remove meta_minutes column from players table
    - Drop related functions for meta minutes
    - Clean up any productivity paradox related data

  2. Security
    - No changes to RLS policies needed
*/

-- Remove meta_minutes column from players table
ALTER TABLE players DROP COLUMN IF EXISTS meta_minutes;

-- Drop the meta minutes update function
DROP FUNCTION IF EXISTS update_meta_minutes(uuid, integer);

-- Remove any productivity paradox related comments
COMMENT ON TABLE players IS 'Player accounts with Reddit OAuth integration and karma chip balance';