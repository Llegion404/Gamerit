import { useState, useEffect, useCallback } from "react";
import { Clock, Flame, TrendingDown, DollarSign, ExternalLink, AlertTriangle, Timer } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Player } from "../lib/supabase";
import { RedditUser } from "../lib/reddit-auth";
import { useProgression } from "../hooks/useProgression";
import toast from "react-hot-toast";

interface HotPotatoRound {
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
}

interface HotPotatoBet {
  id: string;
  round_id: string;
  player_id: string;
  predicted_hours: number;
  bet_amount: number;
  created_at: string;
}

interface HotPotatoBettingProps {
  player: Player | null;
  redditUser: RedditUser | null;
  onRefreshPlayer: () => void;
}

export function HotPotatoBetting({ player, redditUser, onRefreshPlayer }: HotPotatoBettingProps) {
  const { awardXP } = useProgression(redditUser?.name || null);
  const [activeRounds, setActiveRounds] = useState<HotPotatoRound[]>([]);
  const [completedRounds, setCompletedRounds] = useState<HotPotatoRound[]>([]);
  const [userBets, setUserBets] = useState<Record<string, HotPotatoBet>>({});
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [predictedHours, setPredictedHours] = useState(12);
  const [betAmount, setBetAmount] = useState(100);
  const [placingBet, setPlacingBet] = useState(false);

  // Listen for automatic round creation events
  useEffect(() => {
    const handleHotPotatoRoundCreated = (event: CustomEvent) => {
      console.log("Hot potato round created event received:", event.detail);
      fetchRounds();
      toast.success("New hot potato round created! 🔥", { duration: 3000 });
    };

    const handleHotPotatoPostsUpdated = (event: CustomEvent) => {
      console.log("Hot potato posts updated event received:", event.detail);
      fetchRounds();
      if (event.detail?.deleted_posts > 0) {
        toast.info(`${event.detail.deleted_posts} post(s) were deleted!`, { duration: 4000 });
      }
    };

    window.addEventListener('hotPotatoRoundCreated', handleHotPotatoRoundCreated as EventListener);
    window.addEventListener('hotPotatoPostsUpdated', handleHotPotatoPostsUpdated as EventListener);

    return () => {
      window.removeEventListener('hotPotatoRoundCreated', handleHotPotatoRoundCreated as EventListener);
      window.removeEventListener('hotPotatoPostsUpdated', handleHotPotatoPostsUpdated as EventListener);
    };
  }, [fetchRounds]);

  const fetchRounds = useCallback(async () => {
    try {
      // Fetch active rounds
      const { data: active, error: activeError } = await supabase
        .from("hot_potato_rounds")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (activeError) throw activeError;

      // Fetch completed rounds
      const { data: completed, error: completedError } = await supabase
        .from("hot_potato_rounds")
        .select("*")
        .in("status", ["deleted", "survived", "expired"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (completedError) throw completedError;

      setActiveRounds(active || []);
      setCompletedRounds(completed || []);
    } catch (error) {
      console.error("Error fetching hot potato rounds:", error);
      toast.error("Failed to load hot potato rounds");
    }
  }, []);

  const fetchUserBets = useCallback(async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from("hot_potato_bets")
        .select("*")
        .eq("player_id", player.id);

      if (error) throw error;

      const betsMap: Record<string, HotPotatoBet> = {};
      data?.forEach((bet) => {
        betsMap[bet.round_id] = bet;
      });
      setUserBets(betsMap);
    } catch (error) {
      console.error("Error fetching user bets:", error);
    }
  }, [player]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRounds(), fetchUserBets()]);
      setLoading(false);
    };

    loadData();

    // Set up real-time subscriptions
    const roundsSubscription = supabase
      .channel("hot_potato_rounds_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hot_potato_rounds" }, () => {
        fetchRounds();
      })
      .subscribe();

    const betsSubscription = supabase
      .channel("hot_potato_bets_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hot_potato_bets" }, () => {
        fetchUserBets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roundsSubscription);
      supabase.removeChannel(betsSubscription);
    };
  }, [fetchRounds, fetchUserBets]);

  const createNewRound = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-hot-potato-round");

      if (error) throw error;

      if (data?.success) {
        toast.success("New hot potato round created! 🔥");
        fetchRounds();
      } else {
        throw new Error(data?.error || "Failed to create round");
      }
    } catch (error) {
      console.error("Error creating hot potato round:", error);
      toast.error("Failed to create new round");
    }
  };

  const placeBet = async () => {
    if (!player || !redditUser || !selectedRound) return;

    setPlacingBet(true);
    try {
      const { data, error } = await supabase.rpc("place_hot_potato_bet", {
        p_round_id: selectedRound,
        p_reddit_id: redditUser.id,
        p_predicted_hours: predictedHours,
        p_bet_amount: betAmount,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Hot potato bet placed! 🔥 (+5 XP)");
        setSelectedRound(null);
        setPredictedHours(12);
        setBetAmount(100);
        onRefreshPlayer();
        fetchUserBets();

        // Award XP for placing bet
        if (redditUser?.name) {
          try {
            await awardXP(5, "Placed hot potato bet", {
              roundId: selectedRound,
              predictedHours,
              betAmount,
              timestamp: new Date().toISOString(),
            });
          } catch (xpError) {
            console.error("Failed to award XP:", xpError);
          }
        }
      } else {
        throw new Error(data?.error || "Failed to place bet");
      }
    } catch (error) {
      console.error("Error placing bet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to place bet");
    } finally {
      setPlacingBet(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const remaining = expires.getTime() - now.getTime();

    if (remaining <= 0) return "Expired";

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const getControversyLevel = (score: number) => {
    if (score >= 80) return { level: "EXTREME", color: "text-red-600", bg: "bg-red-100 dark:bg-red-950" };
    if (score >= 60) return { level: "HIGH", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-950" };
    if (score >= 40) return { level: "MODERATE", color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-950" };
    return { level: "LOW", color: "text-green-600", bg: "bg-green-100 dark:bg-green-950" };
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Flame className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Loading hot potato rounds...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-500" />
            <div>
              <h2 className="text-2xl font-bold">Hot Potato Betting</h2>
              <p className="text-muted-foreground">
                Bet on how long controversial posts will survive before deletion
              </p>
            </div>
          </div>
          <button
            onClick={createNewRound}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            Manual Create
          </button>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          <p>🤖 Hot potato rounds are created automatically every 10 minutes</p>
          <p>🔥 Controversial posts are selected based on Reddit engagement patterns</p>
        </div>
      </div>

      {/* Active Rounds */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Timer className="w-5 h-5 text-orange-500" />
          Active Hot Potato Rounds
        </h3>

        {activeRounds.length === 0 ? (
          <div className="text-center py-8">
            <Flame className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-semibold mb-2">No Active Rounds</h4>
            <p className="text-muted-foreground mb-4">Create a new hot potato round to start betting!</p>
            <button
              onClick={createNewRound}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              Create Round Now
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              Or wait for automatic creation (every 10 minutes)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeRounds.map((round) => {
              const userBet = userBets[round.id];
              const controversy = getControversyLevel(round.controversy_score);
              const timeRemaining = formatTimeRemaining(round.expires_at);

              return (
                <div
                  key={round.id}
                  className={`border rounded-lg p-4 transition-all ${
                    selectedRound === round.id
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                      : "border-border hover:border-orange-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-primary font-medium">r/{round.post_subreddit}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${controversy.bg} ${controversy.color}`}>
                          {controversy.level} CONTROVERSY
                        </span>
                        <span className="text-xs text-muted-foreground">{timeRemaining}</span>
                      </div>
                      <h4 className="font-medium mb-2 line-clamp-2">{round.post_title}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>by u/{round.post_author}</span>
                        <span>{round.final_score || round.initial_score} upvotes</span>
                        <span>Score: {round.controversy_score}</span>
                      </div>
                    </div>
                    <a
                      href={round.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {userBet ? (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Your Prediction</span>
                          <p className="text-sm text-blue-600 dark:text-blue-400">
                            {userBet.predicted_hours} hours until deletion • {userBet.bet_amount} chips wagered
                          </p>
                        </div>
                        <Clock className="w-4 h-4 text-blue-500" />
                      </div>
                    </div>
                  ) : player && redditUser ? (
                    <div className="border-t border-border pt-3">
                      {selectedRound === round.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">Hours until deletion</label>
                              <input
                                type="range"
                                min="1"
                                max="48"
                                value={predictedHours}
                                onChange={(e) => setPredictedHours(Number(e.target.value))}
                                className="w-full"
                              />
                              <div className="text-center text-sm text-muted-foreground mt-1">
                                {predictedHours} hours
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Bet amount</label>
                              <input
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(Number(e.target.value))}
                                min="10"
                                max={player?.points || 0}
                                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedRound(null)}
                              className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={placeBet}
                              disabled={placingBet || betAmount > (player?.points || 0) || betAmount < 10}
                              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                              {placingBet ? "Placing..." : "Place Bet"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedRound(round.id)}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                        >
                          <DollarSign className="w-4 h-4" />
                          Bet on Deletion Time
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="border-t border-border pt-3">
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-sm text-muted-foreground">Login to place bets on deletion timing</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Rounds */}
      {completedRounds.length > 0 && (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-muted-foreground" />
            Recent Results
          </h3>
          <div className="space-y-3">
            {completedRounds.slice(0, 5).map((round) => {
              const userBet = userBets[round.id];
              const isDeleted = round.status === "deleted";
              const hoursLived = round.actual_deletion_time
                ? (new Date(round.actual_deletion_time).getTime() - new Date(round.created_at).getTime()) / (1000 * 60 * 60)
                : 48; // If survived, it lived the full 48 hours

              return (
                <div key={round.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">r/{round.post_subreddit}</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isDeleted
                            ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400"
                            : "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400"
                        }`}
                      >
                        {isDeleted ? "DELETED" : "SURVIVED"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isDeleted ? `${hoursLived.toFixed(1)}h` : "48h+"}
                      </span>
                    </div>
                    {userBet && (
                      <div className="text-xs text-muted-foreground">
                        Your bet: {userBet.predicted_hours}h • {userBet.bet_amount} chips
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{round.post_title}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* How it Works */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          How Hot Potato Betting Works
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• Controversial posts are selected based on low upvote ratios and high comment activity</p>
          <p>• Predict how many hours until the post gets deleted (1-48 hours)</p>
          <p>• If the post gets deleted, the closest prediction(s) win the entire pot</p>
          <p>• If the post survives 48 hours, predictions closest to 48 hours win</p>
          <p>• Higher controversy scores indicate posts more likely to be deleted</p>
        </div>
      </div>
    </div>
  );
}