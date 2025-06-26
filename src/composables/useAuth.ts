import { ref, onMounted } from "vue";
import { supabase, Player } from "../lib/supabase";
import { redditAuth, RedditUser } from "../lib/reddit-auth";
import { useToast } from "vue-toastification";

export function useAuth() {
  const toast = useToast();
  const player = ref<Player | null>(null);
  const loading = ref(true);
  const redditUser = ref<RedditUser | null>(null);
  const isProcessingCallback = ref(false);

  const login = async () => {
    try {
      const authUrl = redditAuth.getAuthUrl();
      window.location.href = authUrl;
    } catch {
      toast.error("Failed to initiate Reddit login");
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    // Prevent duplicate processing
    if (isProcessingCallback.value) {
      console.log("OAuth callback already being processed, skipping...");
      return;
    }

    try {
      isProcessingCallback.value = true;
      loading.value = true;

      console.log("Processing OAuth callback...");
      const user = await redditAuth.handleCallback(code, state);
      redditUser.value = user;

      // Get or create player in Supabase
      const { data, error } = await supabase.rpc("get_or_create_player", {
        p_reddit_id: user.id,
        p_reddit_username: user.name,
        p_avatar_url: user.icon_img,
      });

      if (error) throw error;

      player.value = data;
      toast.success("Successfully logged in! 🎉");
    } catch (error) {
      // More detailed error message
      let errorMessage = "Failed to complete Reddit login";
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }

      toast.error(errorMessage);
    } finally {
      loading.value = false;
      isProcessingCallback.value = false;
    }
  };

  const logout = () => {
    redditAuth.logout();
    player.value = null;
    redditUser.value = null;
  };

  const refreshPlayer = async () => {
    if (!redditUser.value) return;

    try {
      const { data, error } = await supabase.from("players").select("*").eq("reddit_id", redditUser.value.id).single();

      if (error) throw error;
      player.value = data;
    } catch (error) {
      console.error("Failed to refresh player:", error);
    }
  };

  const claimWelfareChips = async () => {
    if (!redditUser.value) return;

    try {
      const { data, error } = await supabase.rpc("claim_welfare_chips", {
        p_reddit_id: redditUser.value.id,
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

  const initAuth = async () => {
    try {
      loading.value = true;

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
        redditUser.value = user;

        try {
          const { data, error } = await supabase.from("players").select("*").eq("reddit_id", user.id).single();

          if (!error && data) {
            player.value = data;
          }
        } catch (error) {
          console.error("Failed to load player:", error);
          // Don't throw here, just log the error to avoid breaking the app
        }
      }
    } catch (error) {
      console.error("Error initializing auth:", error);
      // Reset states on error
      redditUser.value = null;
      player.value = null;
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    initAuth();
  });

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
