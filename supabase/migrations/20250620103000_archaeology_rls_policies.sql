-- Enable RLS and create policies for archaeology tables

-- Enable RLS on archaeology_challenges
ALTER TABLE archaeology_challenges ENABLE ROW LEVEL SECURITY;

-- Enable RLS on archaeology_submissions  
ALTER TABLE archaeology_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active challenges
CREATE POLICY "Anyone can read active challenges" ON archaeology_challenges
FOR SELECT USING (is_active = true);

-- Policy: Anyone can read submissions
CREATE POLICY "Anyone can read submissions" ON archaeology_submissions
FOR SELECT USING (true);

-- Policy: Authenticated users can insert submissions
CREATE POLICY "Authenticated users can insert submissions" ON archaeology_submissions
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own submissions
CREATE POLICY "Users can update own submissions" ON archaeology_submissions
FOR UPDATE USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());
