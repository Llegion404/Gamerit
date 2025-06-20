/*
  # Meme Stock Trader Feature

  1. New Tables
    - `meme_stocks` - Tracks tradable meme keywords and their values
    - `player_portfolios` - Tracks player stock ownership

  2. Security
    - Enable RLS on both tables
    - Add appropriate policies for read/write access
*/

-- Create meme_stocks table
CREATE TABLE IF NOT EXISTS meme_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meme_keyword text UNIQUE NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  history jsonb DEFAULT '[]'::jsonb
);

-- Create player_portfolios table
CREATE TABLE IF NOT EXISTS player_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  stock_id uuid NOT NULL REFERENCES meme_stocks(id) ON DELETE CASCADE,
  shares_owned integer NOT NULL DEFAULT 0,
  average_buy_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(player_id, stock_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meme_stocks_keyword ON meme_stocks(meme_keyword);
CREATE INDEX IF NOT EXISTS idx_meme_stocks_active ON meme_stocks(is_active);
CREATE INDEX IF NOT EXISTS idx_meme_stocks_updated_at ON meme_stocks(updated_at);
CREATE INDEX IF NOT EXISTS idx_player_portfolios_player_id ON player_portfolios(player_id);
CREATE INDEX IF NOT EXISTS idx_player_portfolios_stock_id ON player_portfolios(stock_id);
CREATE INDEX IF NOT EXISTS idx_player_portfolios_shares ON player_portfolios(shares_owned);

-- Enable Row Level Security
ALTER TABLE meme_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_portfolios ENABLE ROW LEVEL SECURITY;

-- Policies for meme_stocks (public read access)
CREATE POLICY "Anyone can read meme stocks"
  ON meme_stocks
  FOR SELECT
  TO public
  USING (true);

-- Policies for player_portfolios (public read access for transparency)
CREATE POLICY "Anyone can read player portfolios"
  ON player_portfolios
  FOR SELECT
  TO public
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_meme_stocks_updated_at
  BEFORE UPDATE ON meme_stocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_portfolios_updated_at
  BEFORE UPDATE ON player_portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to safely add to history
CREATE OR REPLACE FUNCTION add_to_stock_history(
  stock_id_param uuid,
  new_value integer
)
RETURNS void AS $$
BEGIN
  UPDATE meme_stocks 
  SET history = history || jsonb_build_object(
    'timestamp', now(),
    'value', new_value
  )
  WHERE id = stock_id_param;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample meme stocks for testing
INSERT INTO meme_stocks (meme_keyword, current_value, history) VALUES 
  ('stonks', 1000, '[{"timestamp": "2025-06-20T00:00:00Z", "value": 950}]'::jsonb),
  ('doge', 750, '[{"timestamp": "2025-06-20T00:00:00Z", "value": 800}]'::jsonb),
  ('pigeon', 500, '[{"timestamp": "2025-06-20T00:00:00Z", "value": 450}]'::jsonb),
  ('wojak', 1200, '[{"timestamp": "2025-06-20T00:00:00Z", "value": 1150}]'::jsonb),
  ('chad', 900, '[{"timestamp": "2025-06-20T00:00:00Z", "value": 850}]'::jsonb)
ON CONFLICT (meme_keyword) DO NOTHING;
