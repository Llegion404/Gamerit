import { useState, useEffect, useCallback } from "react";
import { supabase, Player } from "../lib/supabase";
import { redditAuth, RedditUser } from "../lib/reddit-auth";
import toast from "react-hot-toast";

export function useAuth() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [redditUser, setRedditUser] = useState<RedditUser | null>(null);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  const login = async () => {
    try {
      const authUrl = redditAuth.getAuthUrl();
      window.location.href = authUrl;
    } catch {
      toast.error("Failed to initiate Reddit login");
    }
  };

  const handleOAuthCallback = useCallback(
    async (code: string, state: string) => {
      // Prevent duplicate processing
      if (isProcessingCallback) {
        console.log("OAuth callback already being processed, skipping...");
        return;
      }

      try {
        setIsProcessingCallback(true);
        setLoading(true);

        console.log("Processing OAuth callback...");
        const user = await redditAuth.handleCallback(code, state);
        setRedditUser(user);

        // Get or create player in Supabase
        const { data, error } = await supabase.rpc("get_or_create_player", {
          p_reddit_id: user.id,
          p_reddit_username: user.name,
          p_avatar_url: user.icon_img,
        });

        if (error) throw error;

        setPlayer(data);
        toast.success("Successfully logged in! 🎉");
      } catch (error) {
        // More detailed error message
        let errorMessage = "Failed to complete Reddit login";
        if (error instanceof Error) {
          errorMessage += `: ${error.message}`;
        }

        toast.error(errorMessage);
      } finally {
        setLoading(false);
        setIsProcessingCallback(false);
      }
    },
    [isProcessingCallback]
  );

  const logout = () => {
    redditAuth.logout();
    setPlayer(null);
    setRedditUser(null);
  };

  const refreshPlayer = async () => {
    if (!redditUser) return;

    try {
      const { data, error } = await supabase.from("players").select("*").eq("reddit_id", redditUser.id).single();

      if (error) throw error;
      setPlayer(data);
    } catch (error) {
      console.error("Failed to refresh player:", error);
    }
  };

  const claimWelfareChips = async () => {
    if (!redditUser) return;

    try {
      const { data, error } = await supabase.rpc("claim_welfare_chips", {
        p_reddit_id: redditUser.id,
      });

      if (error) throw error;

      if (data.success) {
        await refreshPlayer();
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Welfare claim error:", error);
      return { success: false, error: "Failed to claim welfare chips" };
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);

      // Check for OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");

      if (code && state) {
        // Clean up URL immediately to prevent re-processing
        window.history.replaceState({}, document.title, "/");
        await handleOAuthCallback(code, state);
        return;
      }

      // Check for existing session
      const user = redditAuth.getCurrentUser();
      if (user) {
        setRedditUser(user);

        try {
          const { data, error } = await supabase.from("players").select("*").eq("reddit_id", user.id).single();

          if (!error && data) {
            setPlayer(data);
          }
        } catch (error) {
          console.error("Failed to load player:", error);
        }
      }

      setLoading(false);
    };

    initAuth();
  }, [handleOAuthCallback]);

  return {
    player,
    redditUser,
    loading,
    login,
    logout,
    refreshPlayer,
    claimWelfareChips,
  };
}
