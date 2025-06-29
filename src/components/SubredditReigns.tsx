import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useProgression } from "../hooks/useProgression";
import { ArrowLeft, ArrowRight, Trophy, Zap, AlertTriangle, Crown, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface SubredditReignsProps {
  player: any;
  onRefreshPlayer: () => void;
  redditUsername?: string;
}

interface Dilemma {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  choiceA: {
    text: string;
    score: number;
    author: string;
  };
  choiceB: {
    text: string;
    score: number;
    author: string;
  };
}

interface Campaign {
  id: string;
  name: string;
  subreddit: string;
  difficulty: "easy" | "medium" | "hard";
  description: string;
  unlocked: boolean;
  completed: boolean;
}

export function SubredditReigns({ player, onRefreshPlayer, redditUsername }: SubredditReignsProps) {
  const { awardXP } = useProgression(redditUsername || null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: "aita",
      name: "Am I The Asshole?",
      subreddit: "AmItheAsshole",
      difficulty: "easy",
      description: "Judge interpersonal conflicts and moral dilemmas",
      unlocked: true,
      completed: false,
    },
    {
      id: "relationship_advice",
      name: "Relationship Guru",
      subreddit: "relationship_advice",
      difficulty: "medium",
      description: "Navigate complex relationship scenarios",
      unlocked: false,
      completed: false,
    },
    {
      id: "wallstreetbets",
      name: "Diamond Hands",
      subreddit: "wallstreetbets",
      difficulty: "hard",
      description: "Survive the chaotic world of meme stocks and YOLO investments",
      unlocked: false,
      completed: false,
    },
  ]);
  
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [influence, setInfluence] = useState(50);
  const [day, setDay] = useState(1);
  const [currentDilemma, setCurrentDilemma] = useState<Dilemma | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastChoice, setLastChoice] = useState<"A" | "B" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDilemma, setLoadingDilemma] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "reset" | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Load player campaigns from database
  useEffect(() => {
    if (!player || !redditUsername) return;
    
    const loadCampaigns = async () => {
      try {
        // Get campaign data from database
        const { data: campaignData, error: campaignError } = await supabase
          .from("subreddit_campaigns")
          .select("*")
          .order("difficulty", { ascending: true });
          
        if (campaignError) throw campaignError;
        
        // Get player progress
        const { data: progressData, error: progressError } = await supabase
          .from("player_campaigns")
          .select(`
            campaign_id,
            highest_day_reached,
            highest_influence,
            completed
          `)
          .eq("player_id", player.id);
          
        if (progressError) throw progressError;
        
        // Map progress to campaigns
        const progressMap = new Map();
        progressData?.forEach(progress => {
          progressMap.set(progress.campaign_id, progress);
        });
        
        // Create campaign list with progress
        const campaignList = campaignData?.map((campaign, index) => {
          const progress = progressMap.get(campaign.id);
          return {
            id: campaign.id,
            name: campaign.name,
            subreddit: campaign.subreddit,
            difficulty: campaign.difficulty,
            description: campaign.description || "",
            unlocked: index === 0 || (progressMap.has(campaignData[index-1]?.id) && progressMap.get(campaignData[index-1]?.id).completed),
            completed: progress?.completed || false,
            highestDay: progress?.highest_day_reached || 0,
            highestInfluence: progress?.highest_influence || 0
          };
        });
        
        if (campaignList?.length) {
          setCampaigns(campaignList);
        }
      } catch (error) {
        console.error("Error loading campaigns:", error);
      }
    };
    
    loadCampaigns();
  }, [player, redditUsername]);

  // For touch swipe detection
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      handleChoice("B");
    } else if (isRightSwipe) {
      handleChoice("A");
    }
  }, [touchStart, touchEnd]);

  // Fetch a new dilemma from the selected subreddit
  const fetchDilemma = useCallback(async () => {
    if (!selectedCampaign) return;
    
    setLoadingDilemma(true);
    try {
      // Call the Supabase function to fetch from Reddit API
      // For now, we'll simulate with mock data
      
      // This would be replaced with a real API call:
      // const { data, error } = await supabase.functions.invoke("fetch-subreddit-dilemma", {
      //   body: { subreddit: selectedCampaign.subreddit }
      // });
      
      // Simulate API delay for now
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate a simulated dilemma based on the subreddit
      const dilemmas: Record<string, Dilemma[]> = {
        "AmItheAsshole": [
          {
            id: "aita1",
            title: "AITA for uninviting my sister from my wedding after she announced her pregnancy there?",
            subreddit: "AmItheAsshole",
            author: "wedding_drama_throwaway",
            choiceA: {
              text: "NTA. It was your day, and she deliberately stole your spotlight. She should have waited for another occasion to share her news.",
              score: 15420,
              author: "wedding_etiquette_pro"
            },
            choiceB: {
              text: "YTA. You're punishing her for being happy during a happy event. Family celebrations should be about sharing joy, not hoarding attention.",
              score: -2340,
              author: "family_first_always"
            }
          },
          {
            id: "aita2",
            title: "AITA for refusing to let my mother-in-law be in the delivery room?",
            subreddit: "AmItheAsshole",
            author: "pregnant_and_stressed",
            choiceA: {
              text: "NTA. Your birth, your choice. No one has the right to be there except who YOU want.",
              score: 22150,
              author: "boundaries_matter"
            },
            choiceB: {
              text: "YTA. She's just excited to be a grandmother and wants to support you. You're creating unnecessary family drama.",
              score: -4210,
              author: "respect_your_elders"
            }
          }
        ],
        "relationship_advice": [
          {
            id: "rel1",
            title: "My (28F) boyfriend (30M) of 5 years won't propose because he 'doesn't believe in marriage'",
            subreddit: "relationship_advice",
            author: "waiting_forever_28",
            choiceA: {
              text: "This is a fundamental incompatibility. If marriage is important to you and he's unwilling to compromise, you need to decide if this is a dealbreaker. Don't waste more years hoping he'll change.",
              score: 8740,
              author: "relationship_therapist"
            },
            choiceB: {
              text: "Marriage is just a piece of paper. If he loves you and is committed, why ruin a good relationship over a ceremony? You're being shallow.",
              score: -1230,
              author: "marriage_is_outdated"
            }
          }
        ],
        "wallstreetbets": [
          {
            id: "wsb1",
            title: "Should I YOLO my life savings into $GME calls?",
            subreddit: "wallstreetbets",
            author: "rocket_emoji_guy",
            choiceA: {
              text: "This is the way. Diamond hands to the moon! 🚀🚀🚀 Not financial advice.",
              score: 42069,
              author: "tendies_collector"
            },
            choiceB: {
              text: "Please don't. Diversify your portfolio and only invest what you can afford to lose. Consider index funds for long-term growth.",
              score: -6942,
              author: "responsible_investor"
            }
          }
        ]
      };
      
      // Get dilemmas for the selected subreddit
      const subredditDilemmas = dilemmas[selectedCampaign.subreddit] || [];
      
      if (subredditDilemmas.length === 0) {
        // Fallback dilemma if none exist for the subreddit
        setCurrentDilemma({
          id: "generic",
          title: `A hot post from r/${selectedCampaign.subreddit} appears on your feed. What's your take?`,
          subreddit: selectedCampaign.subreddit,
          author: "random_user",
          choiceA: {
            text: "The hivemind-approved response that aligns with the subreddit's values.",
            score: 5000 + Math.floor(Math.random() * 10000),
            author: "popular_opinion"
          },
          choiceB: {
            text: "A controversial take that challenges the subreddit's conventional wisdom.",
            score: -500 - Math.floor(Math.random() * 2000),
            author: "downvoted_truth"
          }
        });
      } else {
        // Pick a random dilemma from the available ones
        const randomIndex = Math.floor(Math.random() * subredditDilemmas.length);
        setCurrentDilemma(subredditDilemmas[randomIndex]);
      }
      
    } catch (error) {
      console.error("Error fetching dilemma:", error);
      toast.error("Failed to fetch dilemma");
    } finally {
      setLoadingDilemma(false);
    }
  }, [selectedCampaign]);

  // Start a new game
  const startGame = async () => {
    if (!selectedCampaign) return;
    
    setLoading(true);
    try {
      setGameActive(true);
      setInfluence(50);
      setDay(1);
      setGameOver(false);
      setGameWon(false);
      setShowResult(false);
      setLastChoice(null);
      
      await fetchDilemma();
    } catch (error) {
      console.error("Error starting game:", error);
      toast.error("Failed to start game");
    } finally {
      setLoading(false);
    }
  };

  // Handle player choice
  const handleChoice = useCallback(async (choice: "A" | "B") => {
    if (!currentDilemma || showResult || gameOver || gameWon) return;
    
    // Set swipe animation direction
    setSwipeDirection(choice === "A" ? "right" : "left");
    
    // Record the choice
    setLastChoice(choice);
    
    // Show the result
    setShowResult(true);
    
    if (!selectedCampaign) return;
    if (!player) return;
    
    // Play sound effect
    const isCorrectChoice = 
      (choice === "A" && currentDilemma.choiceA.score > Math.abs(currentDilemma.choiceB.score)) ||
      (choice === "B" && Math.abs(currentDilemma.choiceB.score) > currentDilemma.choiceA.score);
    
    // Update influence based on choice
    const influenceChange = isCorrectChoice ? 10 : -15;
    const newInfluence = Math.max(0, Math.min(100, influence + influenceChange));
    setInfluence(newInfluence);
    
    // Check for game over
    if (newInfluence <= 0) {
      setGameOver(true);
      
      // Update player campaign progress
      await supabase.rpc("update_player_campaign_progress", {
        p_player_id: player.id,
        p_subreddit: selectedCampaign.subreddit,
        p_day_reached: day,
        p_influence: influence,
        p_completed: false
      });
      
      // Show toast
      toast.error("You've been downvoted into oblivion!");
      
      // Award XP for the attempt
      if (redditUsername) {
        try {
          await awardXP(day, "Played Subreddit Reigns", {
            subreddit: selectedCampaign?.subreddit,
            days_survived: day,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Failed to award XP:", error);
        }
      }
      
      return;
    }
    
    // Check for win condition (30 days)
    if (day >= 30) {
      setGameWon(true);
      
      // Update player campaign progress
      await supabase.rpc("update_player_campaign_progress", {
        p_player_id: player.id,
        p_subreddit: selectedCampaign.subreddit,
        p_day_reached: day,
        p_influence: newInfluence,
        p_completed: true
      });
      toast.success("You've conquered the subreddit! You are now King of r/" + selectedCampaign?.subreddit);
      
      // Award XP for winning
      if (redditUsername) {
        try {
          await awardXP(50, "Conquered a subreddit in Subreddit Reigns", {
            subreddit: selectedCampaign?.subreddit,
            days_survived: day,
            final_influence: newInfluence,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Failed to award XP:", error);
        }
      }
      
      // Unlock next campaign if available
      setCampaigns(prev => {
        const currentIndex = prev.findIndex(c => c.id === selectedCampaign?.id);
        if (currentIndex >= 0 && currentIndex < prev.length - 1) {
          const updated = [...prev];
          updated[currentIndex].completed = true;
          updated[currentIndex + 1].unlocked = true;
          return updated;
        }
        return prev;
      });
      
      return;
    }
    
    // Wait a moment to show the result, then move to next day
    setTimeout(() => {
      setDay(day + 1);
      // Reset card position with a different animation class
      setSwipeDirection("reset");
      
      // After the card returns, fetch new dilemma and reset states
      setTimeout(() => {
        setShowResult(false);
        setSwipeDirection(null);
        fetchDilemma();
      }, 300);
    }, 2500);
  }, [currentDilemma, showResult, gameOver, gameWon, selectedCampaign, player, day, influence, redditUsername, awardXP, fetchDilemma]);

  // Reset the game selection
  const resetGame = () => {
    setSelectedCampaign(null);
    setGameActive(false);
    setCurrentDilemma(null);
  };

  // Update campaign progress periodically during gameplay
  useEffect(() => {
    if (gameActive && player && selectedCampaign && day > 1 && !gameOver && !gameWon) {
      // Could add periodic progress saving here
    }
  }, [gameActive, player, selectedCampaign, day, gameOver, gameWon, influence]);

  if (!player) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-card rounded-lg border p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Subreddit Reigns</h2>
          <p className="text-muted-foreground">Please log in to play Subreddit Reigns.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Subreddit Reigns</h1>
              <p className="text-muted-foreground">Master the hivemind and become King of the Sub</p>
            </div>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-card rounded-lg border p-6">
        {!selectedCampaign ? (
          /* Campaign Selection Screen */
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Choose Your Campaign</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className={`border rounded-lg p-4 ${
                    campaign.unlocked 
                      ? "cursor-pointer hover:border-primary transition-colors"
                      : "opacity-50 cursor-not-allowed"
                  } ${campaign.completed ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : ""}`}
                  onClick={() => campaign.unlocked && setSelectedCampaign(campaign)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{campaign.name}</h3>
                    {campaign.completed && (
                      <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded-full">
                        Completed
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">r/{campaign.subreddit}</p>
                  <p className="text-sm mb-2">{campaign.description}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div
                      className={`text-xs px-2 py-1 rounded-full ${
                        campaign.difficulty === "easy"
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : campaign.difficulty === "medium"
                          ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                          : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {campaign.difficulty.toUpperCase()}
                    </div>
                    {!campaign.unlocked && (
                      <div className="text-xs text-muted-foreground">
                        Complete previous campaign to unlock
                      </div>
                    )}
                  </div>
                  {campaign.highestDay > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Best run: Day {campaign.highestDay}/30</span>
                        <span>Max influence: {campaign.highestInfluence}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : !gameActive ? (
          /* Campaign Details & Start Game */
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={resetGame}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-xl font-semibold">r/{selectedCampaign.subreddit}</h2>
            </div>
            
            <div className="bg-secondary/50 rounded-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Campaign Briefing</h3>
              <p className="mb-4">
                You're a new user in r/{selectedCampaign.subreddit}. Your goal is to gain influence by correctly
                predicting which comments the subreddit will upvote or downvote.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Each day, you'll face a dilemma based on a real post from the subreddit</li>
                <li>• Swipe right/left or tap to choose between two possible responses</li>
                <li>• Choose what the hivemind would upvote to gain influence</li>
                <li>• Choose against the grain and lose influence</li>
                <li>• If your influence hits 0, you're downvoted into oblivion</li>
                <li>• Survive for 30 days to become King of the Sub</li>
              </ul>
            </div>
            
            <button
              onClick={startGame}
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Starting Campaign...
                </div>
              ) : (
                "Start Campaign"
              )}
            </button>
          </div>
        ) : (
          /* Active Game */
          <div className="space-y-4 sm:space-y-6">
            {/* Game Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to quit? Your progress will be lost.")) {
                      resetGame();
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg font-semibold">r/{selectedCampaign.subreddit}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground hidden sm:block">Day {day}/30</div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <div className="font-semibold">{influence} Influence</div>
                </div>
              </div>
            </div>
            
            {/* Mobile Day Counter */}
            <div className="text-sm text-muted-foreground text-center sm:hidden">Day {day}/30</div>
            
            {/* Influence Meter */}
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  influence > 75
                    ? "bg-green-500"
                    : influence > 50
                    ? "bg-blue-500"
                    : influence > 25
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${influence}%` }}
              />
            </div>
            
            {/* Game Over or Victory Screen */}
            {(gameOver || gameWon) && (
              <div className={`text-center p-4 sm:p-8 rounded-lg border ${
                gameWon 
                  ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
                  : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
              }`}>
                <div className="text-5xl mb-4">
                  {gameWon ? "👑" : "💀"}
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  {gameWon ? "Victory!" : "Game Over"}
                </h3>
                <p className="text-lg mb-4">
                  {gameWon 
                    ? `You've mastered r/${selectedCampaign.subreddit} and become King of the Sub!` 
                    : "You've been downvoted into oblivion!"}
                </p>
                <p className="text-muted-foreground mb-6">
                  {gameWon 
                    ? "You survived 30 days and successfully predicted what the hivemind would upvote." 
                    : `You survived ${day} days before losing all your influence.`}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
                  <button
                    onClick={resetGame}
                    className="px-6 py-2 border border-input rounded-md hover:bg-accent transition-colors"
                  >
                    Back to Campaigns
                  </button>
                  <button
                    onClick={startGame}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
            
            {/* Dilemma Card */}
            {!gameOver && !gameWon && currentDilemma && (
              <div 
                className={`relative bg-card border-2 rounded-xl p-4 sm:p-6 shadow-lg max-w-2xl mx-auto transition-transform duration-300 ${
                  swipeDirection === "reset"
                    ? "translate-x-0 transition-transform duration-300"
                    : swipeDirection === "left" 
                    ? "translate-x-[-100vw]" 
                    : swipeDirection === "right" 
                    ? "translate-x-[100vw]" 
                    : ""
                }`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {/* Dilemma Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2 text-sm sm:text-base">
                    <div className="text-primary font-medium">r/{currentDilemma.subreddit}</div>
                    <div className="text-sm text-muted-foreground">u/{currentDilemma.author}</div>
                  </div>
                  <h3 className="text-xl font-semibold">{currentDilemma.title}</h3>
                </div>
                
                {/* Choices */}
                <div className="space-y-4 mt-4 sm:mt-8">
                  {/* Choice A */}
                  <div 
                    className={`border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors ${
                      showResult && lastChoice === "A" 
                        ? currentDilemma.choiceA.score > Math.abs(currentDilemma.choiceB.score)
                          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                        : ""
                    }`}
                    onClick={() => !showResult && handleChoice("A")}
                  >
                    <div className="flex justify-between items-start mb-2 text-sm sm:text-base">
                      <div className="font-medium flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        Swipe Right
                      </div>
                      {showResult && (
                        <div className="text-sm font-medium">
                          {currentDilemma.choiceA.score > 0 ? "+" : ""}{currentDilemma.choiceA.score}
                        </div>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{currentDilemma.choiceA.text}</p>
                    {showResult && (
                      <div className="text-xs text-muted-foreground mt-2">
                        u/{currentDilemma.choiceA.author}
                      </div>
                    )}
                  </div>
                  
                  {/* Choice B */}
                  <div 
                    className={`border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors ${
                      showResult && lastChoice === "B" 
                        ? Math.abs(currentDilemma.choiceB.score) > currentDilemma.choiceA.score
                          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                        : ""
                    }`}
                    onClick={() => !showResult && handleChoice("B")}
                  >
                    <div className="flex justify-between items-start mb-2 text-sm sm:text-base">
                      <div className="font-medium flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Swipe Left
                      </div>
                      {showResult && (
                        <div className="text-sm font-medium">
                          {currentDilemma.choiceB.score > 0 ? "+" : ""}{currentDilemma.choiceB.score}
                        </div>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{currentDilemma.choiceB.text}</p>
                    {showResult && (
                      <div className="text-xs text-muted-foreground mt-2">
                        u/{currentDilemma.choiceB.author}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Result Overlay */}
                {showResult && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                    <div className={`text-4xl font-bold ${
                      (lastChoice === "A" && currentDilemma.choiceA.score > Math.abs(currentDilemma.choiceB.score)) ||
                      (lastChoice === "B" && Math.abs(currentDilemma.choiceB.score) > currentDilemma.choiceA.score)
                        ? "text-green-500"
                        : "text-red-500"
                    }`}>
                      {(lastChoice === "A" && currentDilemma.choiceA.score > Math.abs(currentDilemma.choiceB.score)) ||
                       (lastChoice === "B" && Math.abs(currentDilemma.choiceB.score) > currentDilemma.choiceA.score)
                        ? "+10 Influence"
                        : "-15 Influence"}
                    </div>
                  </div>
                )}
                
                {/* Loading Overlay */}
                {loadingDilemma && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                    <div className="flex flex-col items-center gap-2 text-white">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Loading dilemma for day {day}...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Swipe Instructions */}
            {!gameOver && !gameWon && currentDilemma && !showResult && (
              <div className="text-center text-xs sm:text-sm text-muted-foreground mt-2">
                Swipe right to agree with the first comment, left for the second.
                <br />
                Or tap/click on your preferred response.
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* How to Play */}
      {!gameActive && (
        <div className="bg-card rounded-lg border p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">How to Play Subreddit Reigns</h3>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Each card presents a real post from the subreddit</p>
            <p>• You must choose between two comments - one highly upvoted, one controversial</p>
            <p>• Swipe right or left (or tap) to make your choice</p>
            <p>• Correctly predicting the hivemind's favorite increases your Influence</p>
            <p>• Going against the grain decreases your Influence</p>
            <p>• If your Influence hits 0, you're "downvoted into oblivion"</p>
            <p>• Survive 30 days to become King of the Sub and unlock harder campaigns</p>
          </div>
        </div>
      )}
    </div>
  );
}