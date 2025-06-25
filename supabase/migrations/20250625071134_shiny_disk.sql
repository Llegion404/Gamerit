/*
  # Add voice_id to radio_stations table

  1. Changes
    - Add `voice_id` column to `radio_stations` table for storing ElevenLabs voice selection
    - Set default voice to Rachel (21m00Tcm4TlvDq8ikWAM)

  2. Security
    - No changes to RLS policies needed
*/

-- Add voice_id column to radio_stations table
ALTER TABLE radio_stations 
ADD COLUMN IF NOT EXISTS voice_id text DEFAULT '21m00Tcm4TlvDq8ikWAM';

-- Update existing stations to have the default voice
UPDATE radio_stations 
SET voice_id = '21m00Tcm4TlvDq8ikWAM' 
WHERE voice_id IS NULL;