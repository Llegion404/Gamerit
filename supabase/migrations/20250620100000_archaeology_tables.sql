-- Migration: Add archaeology_challenges and archaeology_submissions tables

CREATE TABLE IF NOT EXISTS archaeology_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reddit_thread_id text NOT NULL,
    subreddit text NOT NULL,
    thread_title text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS archaeology_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id uuid NOT NULL REFERENCES archaeology_challenges(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    chain_length integer NOT NULL,
    submitted_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (challenge_id, player_id)
);
