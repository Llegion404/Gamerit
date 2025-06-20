import { useState, useEffect } from "react";
import { Clock, TrendingUp, DollarSign, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { GameRound as GameRoundType, Player } from "../lib/supabase";
import { RedditUser } from "../lib/reddit-auth";
import { useScoreUpdater } from "../hooks/useScoreUpdater";
import toast from "react-hot-toast";

interface UserBet {
  id: string;
  bet_on: "A" | "B";
  amount: number;
}

interface RedditPost {
  id?: string;
  author: string;
  title: string;
  score?: number;
  initial_score: number;
  current_score: number;
  subreddit: string;
  permalink?: string;
}

interface GameRoundProps {
  round: GameRoundType;
  player: Player | null;
  redditUser: RedditUser | null;
  onPlaceBet: (roundId: string, betOn: "A" | "B", amount: number) => Promise<void>;
  getUserBets: (playerId: string, roundId: string) => Promise<UserBet[]>;
  refreshData: () => void;
}

export function GameRound({ round, player, redditUser, onPlaceBet, getUserBets, refreshData }: GameRoundProps) {
  const [selectedPost, setSelectedPost] = useState<"A" | "B" | null>(null);
  const [existingBet, setExistingBet] = useState<UserBet | null>(null);
  const [isLoadingBets, setIsLoadingBets] = useState(false);

  // Use the score updater hook to update scores every minute
  useScoreUpdater(round?.id, refreshData);

  // Reset states when round changes
  useEffect(() => {
    setSelectedPost(null);
    setExistingBet(null);
    setIsLoadingBets(true); // Start loading when round changes
  }, [round?.id]);

  useEffect(() => {
    const checkExistingBet = async () => {
      if (player && round) {
        setIsLoadingBets(true);
        try {
          const bets = await getUserBets(player.id, round.id);
          if (bets.length > 0) {
            setExistingBet(bets[0]);
          } else {
            // Reset existing bet if no bets found for this round
            setExistingBet(null);
          }
        } catch {
          toast.error("Failed to check existing bets");
          // Reset on error as well
          setExistingBet(null);
        } finally {
          setIsLoadingBets(false);
        }
      } else {
        // Reset if no player or round
        setExistingBet(null);
        setIsLoadingBets(false);
      }
    };

    checkExistingBet();
  }, [player, round, getUserBets]); // Include full round object

  const PostCard = ({
    post,
    type,
    selected,
    onSelect,
    isWinningBet = false,
    hasExistingBet = false,
    canBet = false,
    player,
    roundId,
    onPlaceBet,
  }: {
    post: RedditPost;
    type: "A" | "B";
    selected: boolean;
    onSelect: () => void;
    isWinningBet?: boolean;
    hasExistingBet?: boolean;
    canBet?: boolean;
    player?: Player | null;
    roundId?: string;
    onPlaceBet?: (roundId: string, betOn: "A" | "B", amount: number) => Promise<void>;
  }) => {
    const [localBetAmount, setLocalBetAmount] = useState(100);
    const [showBetting, setShowBetting] = useState(false);
    const [localLoading, setLocalLoading] = useState(false);
    const [titleExpanded, setTitleExpanded] = useState(false);

    const handleBetClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent parent card click
      if (canBet && !hasExistingBet) {
        setShowBetting(!showBetting);
      }
    };

    const handlePlaceBet = async () => {
      if (!onPlaceBet || !player || !roundId) return;

      setLocalLoading(true);
      try {
        await onPlaceBet(roundId, type, localBetAmount);
        setShowBetting(false);
        setLocalBetAmount(100);
        // Trigger a page refresh or callback to parent to refresh bet status
        window.location.reload();
      } catch {
        toast.error("Failed to place bet. Please try again.");
      } finally {
        setLocalLoading(false);
      }
    };

    const toggleTitle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setTitleExpanded(!titleExpanded);
    };

    // Check if title is long enough to need expansion
    const isLongTitle = post.title.length > 120;

    return (
      <div
        className={`relative border rounded-xl p-3 sm:p-4 transition-all min-h-[320px] flex flex-col ${
          hasExistingBet
            ? isWinningBet
              ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 shadow-sm"
              : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 shadow-sm"
            : selected
            ? "bg-primary/5 border-primary shadow-sm"
            : "bg-card border-border hover:border-primary/50 hover:shadow-md"
        } ${canBet && !hasExistingBet ? "cursor-pointer" : ""}`}
        onClick={canBet && !hasExistingBet && !showBetting ? onSelect : undefined}
      >
        {/* Header with Subreddit Name and External Link */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                hasExistingBet
                  ? isWinningBet
                    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                    : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                  : selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {type}
            </div>
            <div className="text-primary font-medium text-sm sm:text-base">r/{post.subreddit}</div>
          </div>
          {post.id && (
            <a
              href={`https://reddit.com/r/${post.subreddit}/comments/${post.id}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors shrink-0"
              title="View on Reddit"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Upvotes and Author Info */}
        <div className="flex items-center justify-between mb-3 text-xs sm:text-sm">
          <div className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="font-medium">{post.current_score}</span>
            {post.current_score !== post.initial_score && (
              <span className="text-xs text-green-600 dark:text-green-400">
                ({post.current_score > post.initial_score ? "+" : ""}
                {post.current_score - post.initial_score})
              </span>
            )}
          </div>
          <div className="flex justify-end w-1/2 min-w-0 text-muted-foreground">
            <span>u/{post.author}</span>
          </div>
        </div>

        {/* Title Section - flexible to fill available space */}
        <div className="bg-secondary/50 rounded-md p-3 sm:p-4 mb-3 flex-1 flex flex-col justify-center min-h-[120px]">
          <h3
            className={`font-medium leading-relaxed text-sm sm:text-base ${
              titleExpanded || !isLongTitle ? "" : "line-clamp-3"
            }`}
          >
            {post.title}
          </h3>
          {isLongTitle && (
            <button
              onClick={toggleTitle}
              className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center space-x-1 transition-colors"
            >
              {titleExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Show less</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Show more</span>
                </>
              )}
            </button>
          )}
        </div>

        {selected && !existingBet && !showBetting && (
          <div className="absolute inset-0 rounded-xl border-2 border-primary animate-pulse pointer-events-none" />
        )}

        {/* Betting UI */}
        {canBet && !hasExistingBet && (
          <div className="mt-3 pt-3 border-t border-border">
            {!showBetting ? (
              <button
                onClick={handleBetClick}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center space-x-2"
              >
                <DollarSign className="w-4 h-4" />
                <span>Bet on Post {type}</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium text-center">Bet on Post {type}</div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted-foreground">Bet Amount (Karma Chips)</label>
                  <input
                    type="number"
                    value={localBetAmount}
                    onChange={(e) => setLocalBetAmount(Number(e.target.value))}
                    min="10"
                    max={player?.points || 0}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter amount..."
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  Potential winnings:{" "}
                  <span className="text-primary font-medium">{(localBetAmount * 2).toLocaleString()}</span> chips
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowBetting(false)}
                    className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium py-2 px-3 rounded-md transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePlaceBet}
                    disabled={localLoading || localBetAmount > (player?.points || 0) || localBetAmount < 10}
                    className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium py-2 px-3 rounded-md transition-colors text-sm"
                  >
                    {localLoading ? "Placing..." : "Place Bet"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Show loading skeleton while checking for existing bets
  if (isLoadingBets) {
    return <BattleLoadingSkeleton />;
  }

  if (existingBet) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2">
            r/{round.post_a_subreddit} vs r/{round.post_b_subreddit}
          </h2>
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <TimeDisplay timestamp={round.created_at} />
          </div>

          <p className="text-muted-foreground mt-2">
            You bet <span className="text-primary font-semibold">{existingBet.amount} chips</span> on Post{" "}
            <span className="text-primary font-semibold">{existingBet.bet_on}</span>
          </p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 max-w-7xl mx-auto items-stretch">
            <div className="w-full lg:w-[calc(50%-1rem)]">
              <PostCard
                post={{
                  id: round.post_a_id,
                  subreddit: round.post_a_subreddit,
                  title: round.post_a_title,
                  author: round.post_a_author,
                  initial_score: round.post_a_initial_score,
                  current_score: round.post_a_final_score || round.post_a_initial_score,
                }}
                type="A"
                selected={false}
                onSelect={() => {}}
                hasExistingBet={existingBet.bet_on === "A"}
                isWinningBet={existingBet.bet_on === "A"}
                canBet={false}
                player={player}
                roundId={round.id}
              />
            </div>

            <div className="flex items-center justify-center py-1 lg:py-0 lg:w-8">
              <div className="text-2xl sm:text-3xl font-bold text-muted-foreground">VS</div>
            </div>

            <div className="w-full lg:w-[calc(50%-1rem)]">
              <PostCard
                post={{
                  id: round.post_b_id,
                  subreddit: round.post_b_subreddit,
                  title: round.post_b_title,
                  author: round.post_b_author,
                  initial_score: round.post_b_initial_score,
                  current_score: round.post_b_final_score || round.post_b_initial_score,
                }}
                type="B"
                selected={false}
                onSelect={() => {}}
                hasExistingBet={existingBet.bet_on === "B"}
                isWinningBet={existingBet.bet_on === "B"}
                canBet={false}
                player={player}
                roundId={round.id}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2">
          r/{round.post_a_subreddit} vs r/{round.post_b_subreddit}
        </h2>
        <div className="flex items-center justify-center space-x-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <TimeDisplay timestamp={round.created_at} />
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 max-w-7xl mx-auto items-stretch">
          <div className="w-full lg:w-[calc(50%-1rem)]">
            <PostCard
              post={{
                id: round.post_a_id,
                subreddit: round.post_a_subreddit,
                title: round.post_a_title,
                author: round.post_a_author,
                initial_score: round.post_a_initial_score,
                current_score: round.post_a_final_score || round.post_a_initial_score,
              }}
              type="A"
              selected={selectedPost === "A"}
              onSelect={() => setSelectedPost(selectedPost === "A" ? null : "A")}
              canBet={Boolean(player && redditUser)}
              player={player}
              roundId={round.id}
              onPlaceBet={onPlaceBet}
            />
          </div>

          <div className="flex items-center justify-center py-1 lg:py-0 lg:w-8">
            <div className="text-2xl sm:text-3xl font-bold text-muted-foreground">VS</div>
          </div>

          <div className="w-full lg:w-[calc(50%-1rem)]">
            <PostCard
              post={{
                id: round.post_b_id,
                subreddit: round.post_b_subreddit,
                title: round.post_b_title,
                author: round.post_b_author,
                initial_score: round.post_b_initial_score,
                current_score: round.post_b_final_score || round.post_b_initial_score,
              }}
              type="B"
              selected={selectedPost === "B"}
              onSelect={() => setSelectedPost(selectedPost === "B" ? null : "B")}
              canBet={Boolean(player && redditUser)}
              player={player}
              roundId={round.id}
              onPlaceBet={onPlaceBet}
            />
          </div>
        </div>
      </div>

      {!player && (
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Ready to Bet?</h3>
          <p className="text-muted-foreground">Login with Reddit to start betting with 1,000 free Karma Chips!</p>
        </div>
      )}
    </div>
  );
}

// Separate component for real-time timer display to avoid unnecessary re-renders
function TimeDisplay({ timestamp }: { timestamp: string }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (timestamp: string) => {
    const created = new Date(timestamp);
    const roundDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const elapsed = currentTime.getTime() - created.getTime();
    const remaining = roundDuration - elapsed;

    if (remaining <= 0) {
      return "Ending soon";
    }

    const remainingHours = Math.floor(remaining / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const remainingSeconds = Math.floor((remaining % (1000 * 60)) / 1000);

    // If less than 10 minutes remaining, show seconds too
    if (remainingHours === 0 && remainingMinutes < 10) {
      if (remainingMinutes === 0) {
        return `${remainingSeconds}s remaining`;
      }
      return `${remainingMinutes}m ${remainingSeconds}s remaining`;
    }

    // If less than 1 hour remaining, show minutes
    if (remainingHours === 0) {
      return `${remainingMinutes}m remaining`;
    }

    // Show hours and minutes
    if (remainingMinutes === 0) {
      return `${remainingHours}h remaining`;
    }

    return `${remainingHours}h ${remainingMinutes}m remaining`;
  };

  return <span className="text-sm">{formatTime(timestamp)}</span>;
}

// Skeleton loader component for loading state
function BattleLoadingSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <div className="h-8 bg-secondary rounded-md w-48 mx-auto mb-2 animate-pulse"></div>
        <div className="h-5 bg-secondary rounded-md w-32 mx-auto animate-pulse"></div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 max-w-7xl mx-auto items-stretch">
          {/* Post A Skeleton */}
          <div className="w-full lg:w-[calc(50%-1rem)]">
            <div className="relative border rounded-xl p-3 sm:p-4 bg-card border-border min-h-[320px] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-secondary animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded w-20 animate-pulse"></div>
                </div>
                <div className="w-8 h-8 rounded-md bg-secondary animate-pulse"></div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="h-4 bg-secondary rounded w-16 animate-pulse"></div>
                <div className="h-4 bg-secondary rounded w-20 animate-pulse"></div>
              </div>

              {/* Title skeleton - flexible to fill space */}
              <div className="bg-secondary/50 rounded-md p-3 sm:p-4 mb-3 flex-1 flex flex-col justify-center min-h-[120px]">
                <div className="space-y-2">
                  <div className="h-4 bg-secondary rounded animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded w-4/5 animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded w-3/5 animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded w-2/5 animate-pulse"></div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <div className="h-10 bg-secondary rounded-lg animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* VS divider */}
          <div className="flex items-center justify-center py-1 lg:py-0 lg:w-8">
            <div className="text-2xl sm:text-3xl font-bold text-muted-foreground">VS</div>
          </div>

          {/* Post B Skeleton */}
          <div className="w-full lg:w-[calc(50%-1rem)]">
            <div className="relative border rounded-xl p-3 sm:p-4 bg-card border-border min-h-[320px] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-secondary animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded w-20 animate-pulse"></div>
                </div>
                <div className="w-8 h-8 rounded-md bg-secondary animate-pulse"></div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="h-4 bg-secondary rounded w-16 animate-pulse"></div>
                <div className="h-4 bg-secondary rounded w-20 animate-pulse"></div>
              </div>

              {/* Title skeleton - flexible to fill space */}
              <div className="bg-secondary/50 rounded-md p-3 sm:p-4 mb-3 flex-1 flex flex-col justify-center min-h-[120px]">
                <div className="space-y-2">
                  <div className="h-4 bg-secondary rounded animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded w-4/5 animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded w-3/5 animate-pulse"></div>
                  <div className="h-4 bg-secondary rounded w-2/5 animate-pulse"></div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <div className="h-10 bg-secondary rounded-lg animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
