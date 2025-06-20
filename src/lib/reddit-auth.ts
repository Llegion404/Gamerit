// Reddit OAuth configuration and utilities
const REDDIT_CLIENT_ID = import.meta.env.VITE_REDDIT_CLIENT_ID;
const REDDIT_REDIRECT_URI = import.meta.env.VITE_REDDIT_REDIRECT_URI || `${window.location.origin}/`;

// Debug logging
console.log("Reddit Auth Config:", {
  clientId: REDDIT_CLIENT_ID ? "✓ Set" : "✗ Missing",
  redirectUri: REDDIT_REDIRECT_URI,
});

export interface RedditUser {
  id: string;
  name: string;
  icon_img: string;
  created_utc: number;
  link_karma: number;
  comment_karma: number;
}

export class RedditAuth {
  private static instance: RedditAuth;
  private accessToken: string | null = null;
  private user: RedditUser | null = null;

  static getInstance(): RedditAuth {
    if (!RedditAuth.instance) {
      RedditAuth.instance = new RedditAuth();
    }
    return RedditAuth.instance;
  }

  // Generate Reddit OAuth URL
  getAuthUrl(): string {
    const state = this.generateState();
    localStorage.setItem("reddit_oauth_state", state);

    const params = new URLSearchParams({
      client_id: REDDIT_CLIENT_ID,
      response_type: "code",
      state: state,
      redirect_uri: REDDIT_REDIRECT_URI,
      duration: "permanent",
      scope: "identity",
    });

    return `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
  }

  // Handle OAuth callback
  async handleCallback(code: string, state: string): Promise<RedditUser> {
    console.log("Starting OAuth callback with:", { code: code.substring(0, 10) + "...", state });

    const savedState = localStorage.getItem("reddit_oauth_state");
    console.log("State validation:", { received: state, saved: savedState, match: state === savedState });

    if (state !== savedState) {
      console.error("OAuth state mismatch!");
      throw new Error("Invalid OAuth state - possible security issue");
    }

    // Check if this code has already been processed (prevent duplicate processing)
    const lastProcessedCode = localStorage.getItem("reddit_last_processed_code");
    if (lastProcessedCode === code) {
      console.log("Code already processed, skipping...");
      throw new Error("Authorization code already used");
    }

    try {
      // Use the Supabase edge function to exchange the code for tokens
      console.log("Calling Supabase edge function for Reddit OAuth...");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reddit-oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          code,
          state,
          redirect_uri: REDDIT_REDIRECT_URI,
        }),
      });

      console.log("Edge function response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Edge function error response:", errorData);

        // Include more detailed error information
        const errorMessage = errorData.details
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || "Failed to exchange authorization code";

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Edge function success response:", data);

      if (!data.user) {
        throw new Error("No user data received from Reddit");
      }

      // Store the user and access token
      this.user = {
        id: data.user.id,
        name: data.user.name,
        icon_img: data.user.icon_img || "",
        created_utc: data.user.created_utc || Date.now() / 1000,
        link_karma: data.user.link_karma || 0,
        comment_karma: data.user.comment_karma || 0,
      };

      this.accessToken = data.access_token;

      // Store in localStorage
      if (this.accessToken) {
        localStorage.setItem("reddit_access_token", this.accessToken);
      }
      localStorage.setItem("reddit_user", JSON.stringify(this.user));
      localStorage.setItem("reddit_last_processed_code", code); // Mark this code as processed
      localStorage.removeItem("reddit_oauth_state"); // Clean up

      return this.user;
    } catch (error) {
      console.error("OAuth callback error:", error);
      localStorage.removeItem("reddit_oauth_state"); // Clean up on error
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to complete Reddit authentication: ${errorMessage}`);
    }
  }

  // Get current user
  getCurrentUser(): RedditUser | null {
    if (this.user) return this.user;

    const savedUser = localStorage.getItem("reddit_user");
    if (savedUser) {
      this.user = JSON.parse(savedUser);
      this.accessToken = localStorage.getItem("reddit_access_token");
    }

    return this.user;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null && this.accessToken !== null;
  }

  // Logout
  logout(): void {
    this.user = null;
    this.accessToken = null;
    localStorage.removeItem("reddit_access_token");
    localStorage.removeItem("reddit_user");
    localStorage.removeItem("reddit_oauth_state");
    localStorage.removeItem("reddit_auth_code");
    localStorage.removeItem("reddit_last_processed_code");
  }

  // Generate random state for OAuth
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

export const redditAuth = RedditAuth.getInstance();
