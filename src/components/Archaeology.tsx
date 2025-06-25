import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProgression } from "../hooks/useProgression";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface Challenge {
  id: string;
  reddit_thread_id: string;
  subreddit: string;
  thread_title: string;
  thread_url?: string;
  comment_count?: number;
  score?: number;
  author?: string;
}

interface Submission {
  player_id: string;
  chain_length: number;
  submitted_at: string;
}

export default function Archaeology() {
  const { player, redditUser } = useAuth();
  const { awardXP } = useProgression(redditUser?.name || null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission | null>>({});
  const [leaderboards, setLeaderboards] = useState<Record<string, Submission[]>>({});
  const [inputUrls, setInputUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [fetchingNewPosts, setFetchingNewPosts] = useState(false);

  useEffect(() => {
    const fetchChallenges = async () => {
      const { data } = await supabase.from("archaeology_challenges").select("*").eq("is_active", true);
      setChallenges(data || []);
      if (data) {
        data.forEach((c: Challenge) => {
          fetchLeaderboard(c.id);
          fetchPersonalBest(c.id);
        });
      }
    };

    fetchChallenges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLeaderboard(challengeId: string) {
    const { data } = await supabase
      .from("archaeology_submissions")
      .select("player_id, chain_length, submitted_at")
      .eq("challenge_id", challengeId)
      .order("chain_length", { ascending: false })
      .limit(10);
    setLeaderboards((prev) => ({ ...prev, [challengeId]: data || [] }));
  }

  async function fetchPersonalBest(challengeId: string) {
    if (!player) return;
    const { data } = await supabase
      .from("archaeology_submissions")
      .select("player_id, chain_length, submitted_at")
      .eq("challenge_id", challengeId)
      .eq("player_id", player.id)
      .single();
    setSubmissions((prev) => ({ ...prev, [challengeId]: data || null }));
  }

  async function handleSubmit(challengeId: string) {
    if (!player || !redditUser) return;

    setStatus((prev) => ({ ...prev, [challengeId]: "Verifying..." }));
    const comment_url = inputUrls[challengeId];

    try {
      const { data, error } = await supabase.functions.invoke("verify-comment-chain", {
        body: {
          player_id: player.id,
          challenge_id: challengeId,
          comment_url,
        },
      });

      if (error) {
        setStatus((prev) => ({ ...prev, [challengeId]: `Error: ${error.message}` }));
      } else {
        setStatus((prev) => ({
          ...prev,
          [challengeId]: `Success! Chain length: ${data.chain_length}, Prize: ${data.prize} Karma Chips (+${Math.floor(
            data.chain_length / 2
          )} XP)`,
        }));
        fetchLeaderboard(challengeId);
        fetchPersonalBest(challengeId);

        // Award XP based on chain length found
        if (redditUser?.name) {
          try {
            const xpAmount = Math.max(5, Math.floor(data.chain_length / 2)); // Minimum 5 XP, bonus for longer chains
            await awardXP(xpAmount, "Discovered comment chain in Archaeology", {
              challengeId,
              chainLength: data.chain_length,
              prize: data.prize,
              commentUrl: comment_url,
              timestamp: new Date().toISOString(),
            });
          } catch (xpError) {
            console.error("Failed to award XP for archaeology submission:", xpError);
          }
        }
      }
    } catch {
      setStatus((prev) => ({ ...prev, [challengeId]: `Error: Failed to connect to server` }));
    }
  }

  // Fetch new high-engagement posts for archaeology
  const fetchNewArchaeologyPosts = async () => {
    setFetchingNewPosts(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-archaeology-posts");

      if (error) throw error;

      if (data?.success) {
        toast.success(`Found ${data.posts_with_100_plus_comments} new high-engagement posts!`);
        // Refresh challenges after fetching new posts
        const { data: newChallenges } = await supabase.from("archaeology_challenges").select("*").eq("is_active", true);
        setChallenges(newChallenges || []);
        if (newChallenges) {
          newChallenges.forEach((c: Challenge) => {
            fetchLeaderboard(c.id);
            fetchPersonalBest(c.id);
          });
        }
      } else {
        throw new Error(data?.error || "Failed to fetch new posts");
      }
    } catch (error) {
      console.error("Error fetching new archaeology posts:", error);
      toast.error("Failed to fetch new posts");
    } finally {
      setFetchingNewPosts(false);
    }
  };

  if (!player || !redditUser) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">🦴 Archaeology Dig Sites</h1>
        <div className="text-center py-8">
          <p className="text-lg text-muted-foreground">Please log in to participate in archaeological expeditions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">🦴 Archaeology Dig Sites</h1>
        <button
          onClick={fetchNewArchaeologyPosts}
          disabled={fetchingNewPosts}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${fetchingNewPosts ? "animate-spin" : ""}`} />
          {fetchingNewPosts ? "Finding Posts..." : "Find New Posts"}
        </button>
      </div>
      <p className="text-muted-foreground mb-6">
        Discover the longest comment chains in Reddit threads! Find the deepest reply chain and earn Karma Chips.
      </p>

      {challenges.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg text-muted-foreground">No active dig sites available. Check back later!</p>
        </div>
      ) : (
        challenges.map((c) => (
          <div key={c.id} className="border rounded-lg p-6 mb-6 bg-card shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold text-lg">{c.thread_title}</h3>
              <div className="flex items-center gap-4 text-muted-foreground text-sm">
                <span className="font-medium">r/{c.subreddit}</span>
                {c.comment_count && (
                  <span className="flex items-center gap-1">💬 {c.comment_count.toLocaleString()} comments</span>
                )}
                {c.score && <span className="flex items-center gap-1">⬆️ {c.score.toLocaleString()} upvotes</span>}
                {c.author && <span>by u/{c.author}</span>}
              </div>
            </div>

            <a
              href={c.thread_url || `https://reddit.com/comments/${c.reddit_thread_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm mb-4 inline-block"
            >
              🔗 View Thread on Reddit
            </a>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste Reddit comment URL here..."
                  className="border border-border px-3 py-2 flex-1 rounded-md bg-background"
                  value={inputUrls[c.id] || ""}
                  onChange={(e) => setInputUrls((prev) => ({ ...prev, [c.id]: e.target.value }))}
                />
                <button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleSubmit(c.id)}
                  disabled={!inputUrls[c.id] || !inputUrls[c.id].trim()}
                >
                  Submit
                </button>
              </div>

              {status[c.id] && (
                <div
                  className={`mt-2 text-sm p-2 rounded ${
                    status[c.id].includes("Success")
                      ? "bg-green-100 text-green-700 border border-green-200"
                      : status[c.id].includes("Error")
                      ? "bg-red-100 text-red-700 border border-red-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`}
                >
                  {status[c.id]}
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">🏆 Leaderboard</h4>
                {(leaderboards[c.id] || []).length === 0 ? (
                  <p className="text-muted-foreground text-sm">No submissions yet</p>
                ) : (
                  <ol className="space-y-1">
                    {(leaderboards[c.id] || []).map((s, i) => (
                      <li key={s.player_id + i} className="text-sm flex justify-between">
                        <span>
                          #{i + 1} Player {s.player_id.slice(0, 8)}...
                        </span>
                        <span className="font-medium">{s.chain_length} links</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-2">📊 Your Best</h4>
                <div className="text-sm">
                  {submissions[c.id]?.chain_length ? (
                    <p className="text-primary font-medium">{submissions[c.id]?.chain_length} links deep</p>
                  ) : (
                    <p className="text-muted-foreground">No submission yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
