import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Add error handling for missing environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  })
  throw new Error('Supabase configuration is incomplete. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type GameRound = {
  id: string;
  created_at: string;
  status: "active" | "pending_payout" | "finished";
  post_a_id: string;
  post_a_title: string;
  post_a_author: string;
  post_a_subreddit: string;
  post_a_initial_score: number;
  post_a_final_score?: number;
  post_b_id: string;
  post_b_title: string;
  post_b_author: string;
  post_b_subreddit: string;
  post_b_initial_score: number;
  post_b_final_score?: number;
  winner?: "A" | "B";
};

export type Player = {
  id: string;
  reddit_username: string;
  points: number;
  meta_minutes: number;
  created_at: string;
};

export type HotPotatoRound = {
  id: string;
  post_id: string;
  post_title: string;
  post_author: string;
  post_subreddit: string;
  post_url: string;
  created_at: string;
  expires_at: string;
  status: "active" | "deleted" | "survived" | "expired";
  controversy_score: number;
  initial_score: number;
  final_score?: number;
  actual_deletion_time?: string;
};

export type HotPotatoBet = {
  id: string;
  round_id: string;
  player_id: string;
  predicted_hours: number;
  bet_amount: number;
  created_at: string;
};

export type Bet = {
  id: string;
  round_id: string;
  player_id: string;
  bet_on: "A" | "B";
  amount: number;
  created_at: string;
};