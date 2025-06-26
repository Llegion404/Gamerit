export interface SubredditSuggestion {
  name: string;
  title: string;
  description: string;
  subscribers: number;
  over18: boolean;
}

interface RedditSubredditData {
  display_name: string;
  title: string;
  public_description: string;
  subscribers: number;
  over18: boolean;
}

interface RedditResponse {
  data: {
    children: Array<{
      data: RedditSubredditData;
    }>;
  };
}

/**
 * Search for subreddits using Reddit's public API
 * @param query - Search query (minimum 2 characters)
 * @param limit - Maximum number of results (default: 10)
 * @returns Promise<SubredditSuggestion[]>
 */
export async function searchSubreddits(query: string, limit?: number): Promise<SubredditSuggestion[]> {
  const actualLimit = limit ?? 10;
  if (!query || query.trim().length < 2) {
    throw new Error("Query must be at least 2 characters long");
  }

  if (actualLimit < 1 || actualLimit > 25) {
    throw new Error("Limit must be between 1 and 25");
  }

  const searchUrl = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(
    query.trim()
  )}&limit=${actualLimit}&type=sr&sort=relevance`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "KarmaCasino/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    const data: RedditResponse = await response.json();

    if (!data?.data?.children) {
      return [];
    }

    // Transform Reddit API response to our format
    const subreddits: SubredditSuggestion[] = data.data.children
      .map((child) => ({
        name: child.data.display_name,
        title: child.data.title || child.data.display_name,
        description: child.data.public_description || "No description available",
        subscribers: child.data.subscribers || 0,
        over18: child.data.over18 || false,
      }))
      // Filter out NSFW subreddits
      .filter((sub) => !sub.over18)
      // Sort by subscriber count (descending)
      .sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));

    return subreddits;
  } catch (error) {
    console.error("Error searching subreddits:", error);
    throw new Error(`Failed to search subreddits: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
