import { useState, useEffect } from "react";
import { Italic as Crystal, Sparkles, RefreshCw, MessageCircle, Zap, Eye } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProgression } from "../hooks/useProgression";
import toast from "react-hot-toast";

interface OracleResponse {
  id: string;
  question: string;
  answer: string;
  source_permalink?: string;
  source_subreddit: string;
  source_author: string;
  timestamp: string;
}

interface OracleStats {
  total_questions: number;
  favorite_subreddit: string;
  wisdom_level: number;
}

interface RedditOracleProps {
  onConsultingStateChange?: (isConsulting: boolean) => void;
}

export function RedditOracle({ onConsultingStateChange }: RedditOracleProps) {
  const { player, redditUser } = useAuth();
  const { awardXP } = useProgression(redditUser?.name || null);
  const [question, setQuestion] = useState("");
  const [currentResponse, setCurrentResponse] = useState<OracleResponse | null>(null);
  const [recentResponses, setRecentResponses] = useState<OracleResponse[]>([]);
  const [isConsulting, setIsConsulting] = useState(false);
  const [oracleStats, setOracleStats] = useState<OracleStats | null>(null);
  const [animationPhase, setAnimationPhase] = useState<"idle" | "consulting" | "revealing">("idle");

  // Track consulting state and notify parent
  useEffect(() => {
    onConsultingStateChange?.(isConsulting);
  }, [isConsulting, onConsultingStateChange]);

  // Reset state when component mounts (when switching to oracle)
  useEffect(() => {
    setAnimationPhase("idle");
    setIsConsulting(false);
    setCrystalGlow(false);
    setMysticalText("");
  }, []);

  // Oracle animation states
  const [crystalGlow, setCrystalGlow] = useState(false);
  const [mysticalText, setMysticalText] = useState("");

  const mysticalPhrases = [
    "The cosmic threads are aligning...",
    "Consulting the digital spirits...",
    "Peering through the veil of Reddit...",
    "The oracle awakens from slumber...",
    "Ancient wisdom flows through fiber optic cables...",
    "The universe whispers through upvotes...",
    "Channeling the collective consciousness...",
    "The sacred algorithms are processing...",
  ];

  useEffect(() => {
    loadRecentResponses();
    loadOracleStats();
  }, []);

  const loadRecentResponses = async () => {
    // In a real implementation, you'd store oracle responses in the database
    // For now, we'll use localStorage for demo purposes
    const stored = localStorage.getItem("oracle_responses");
    if (stored) {
      setRecentResponses(JSON.parse(stored).slice(0, 5));
    }
  };

  const loadOracleStats = async () => {
    const stored = localStorage.getItem("oracle_stats");
    if (stored) {
      setOracleStats(JSON.parse(stored));
    } else {
      setOracleStats({
        total_questions: 0,
        favorite_subreddit: "AskReddit",
        wisdom_level: 1,
      });
    }
  };

  const saveResponse = (response: OracleResponse) => {
    const stored = localStorage.getItem("oracle_responses");
    const responses = stored ? JSON.parse(stored) : [];
    responses.unshift(response);
    localStorage.setItem("oracle_responses", JSON.stringify(responses.slice(0, 20)));
    setRecentResponses(responses.slice(0, 5));

    // Update stats
    if (oracleStats) {
      const newStats = {
        ...oracleStats,
        total_questions: oracleStats.total_questions + 1,
        wisdom_level: Math.floor(oracleStats.total_questions / 10) + 1,
      };
      setOracleStats(newStats);
      localStorage.setItem("oracle_stats", JSON.stringify(newStats));
    }
  };

  const consultOracle = async () => {
    if (!question.trim()) {
      toast.error("The oracle requires a question to divine an answer");
      return;
    }

    // Prevent multiple simultaneous consultations
    if (isConsulting) {
      return;
    }

    setIsConsulting(true);
    setAnimationPhase("consulting");
    setCrystalGlow(true);

    // Show mystical loading text
    const randomPhrase = mysticalPhrases[Math.floor(Math.random() * mysticalPhrases.length)];
    setMysticalText(randomPhrase);

    try {
      // Call the oracle function to get a random comment
      const { data, error } = await supabase.functions.invoke("consult-reddit-oracle", {
        body: {
          question: question.trim(),
          player_id: player?.id,
        },
      });

      if (error) throw error;

      if (data?.success && data.answer) {
        // Animation sequence
        setTimeout(() => {
          setAnimationPhase("revealing");
          setMysticalText("The oracle has spoken...");
        }, 2000);

        setTimeout(() => {
          const response: OracleResponse = {
            id: Date.now().toString(),
            question: question.trim(),
            answer: data.answer.text,
            source_permalink: data.answer.permalink,
            source_subreddit: data.answer.subreddit,
            source_author: data.answer.author,
            timestamp: new Date().toISOString(),
          };

          setCurrentResponse(response);
          saveResponse(response);
          setQuestion("");
          setAnimationPhase("idle");
          setCrystalGlow(false);
          setMysticalText("");
          setIsConsulting(false);

          // Award XP for consulting the oracle
          if (redditUser?.name) {
            try {
              awardXP(3, "Consulted the Reddit Oracle", {
                question: question.trim(),
                sourceSubreddit: data.answer.subreddit,
                timestamp: new Date().toISOString(),
              });
            } catch (xpError) {
              console.error("Failed to award XP:", xpError);
            }
          }

          toast.success("The oracle has revealed ancient wisdom! (+3 XP)", {
            duration: 4000,
            style: {
              background: "linear-gradient(45deg, #8B5CF6, #A855F7)",
              color: "white",
            },
          });
        }, 4000);
      } else {
        throw new Error(data?.error || "The oracle remains silent");
      }
    } catch (error) {
      console.error("Error consulting oracle:", error);
      toast.error("The oracle is temporarily unavailable. Try again later.");
      setAnimationPhase("idle");
      setCrystalGlow(false);
      setMysticalText("");
      setIsConsulting(false);
    } finally {
      // Ensure consulting state is always reset
      setTimeout(() => {
        setIsConsulting(false);
        onConsultingStateChange?.(false);
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isConsulting && question.trim()) {
      consultOracle();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      onConsultingStateChange?.(false);
    };
  }, [onConsultingStateChange]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
          </div>
          <div className="relative">
            <Crystal className={`w-16 h-16 mx-auto text-purple-500 mb-4 transition-all duration-1000 ${
              crystalGlow ? "animate-pulse scale-110 drop-shadow-lg" : ""
            }`} />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              The Reddit Oracle
            </h1>
          </div>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Ask any question and receive mystical wisdom from the depths of Reddit's collective consciousness
        </p>
        {oracleStats && (
          <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{oracleStats.total_questions} questions answered</span>
            </div>
            <div className="flex items-center space-x-1">
              <Zap className="w-4 h-4" />
              <span>Wisdom Level {oracleStats.wisdom_level}</span>
            </div>
          </div>
        )}
      </div>

      {/* Oracle Interface */}
      <div className="bg-card rounded-xl border border-border shadow-lg p-4 sm:p-8">
        <div className="space-y-6">
          {/* Question Input */}
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-center">
              Pose your question to the Oracle
            </label>
            <div className="relative">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Will I find love this year? Should I quit my job? What's the meaning of life?"
                className="w-full px-6 py-4 text-lg border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                disabled={isConsulting}
                maxLength={200}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <Sparkles className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <button
              onClick={consultOracle}
              disabled={isConsulting || !question.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
            >
              {isConsulting ? (
                <div className="flex items-center justify-center space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Consulting the Oracle...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Crystal className="w-5 h-5" />
                  <span>Consult the Oracle</span>
                </div>
              )}
            </button>
          </div>

          {/* Mystical Loading State */}
          {mysticalText && (
            <div className="text-center py-8">
              <div className="inline-flex items-center space-x-2 text-purple-600 dark:text-purple-400 font-medium">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <span className="animate-pulse">{mysticalText}</span>
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
            </div>
          )}

          {/* Current Response */}
          {currentResponse && animationPhase === "idle" && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-6 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-2">
                  The Oracle Speaks
                </h3>
                <div className="text-sm text-muted-foreground mb-4">
                  Your question: "{currentResponse.question}"
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-purple-200 dark:border-purple-700">
                <blockquote className="text-lg italic text-center leading-relaxed mb-4">
                  "{currentResponse.answer}"
                </blockquote>
                <div className="text-center text-sm text-muted-foreground flex flex-col items-center gap-1">
                  <div className="flex items-center justify-center space-x-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Wisdom from r/{currentResponse.source_subreddit}</span>
                    <span>•</span>
                    <span>by u/{currentResponse.source_author}</span>
                  </div>
                  {currentResponse.source_permalink && (
                    <a 
                      href={`https://reddit.com${currentResponse.source_permalink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 mt-1"
                    >
                      <span>View original comment</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Consultations */}
      {recentResponses.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-lg p-4 sm:p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center space-x-2">
            <Crystal className="w-5 h-5 text-purple-500" />
            <span>Recent Oracle Consultations</span>
          </h3>
          <div className="space-y-4">
            {recentResponses.map((response) => (
              <div
                key={response.id}
                className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    Q: {response.question}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(response.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  A: "{response.answer}"
                </div>
                <div className="text-xs text-muted-foreground">
                  Source: r/{response.source_subreddit} • u/{response.source_author}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-card rounded-xl border border-border shadow-lg p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <span>How the Oracle Works</span>
        </h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>• Ask any question that weighs on your mind or heart</p>
          <p>• The Oracle searches through random Reddit comments from various subreddits</p>
          <p>• Receive an out-of-context comment that may surprisingly fit your situation</p>
          <p>• The humor comes from the absurd yet sometimes profound connections</p>
          <p>• Each consultation grants you 3 XP and increases your Wisdom Level</p>
          <p>• The Oracle draws from subreddits like r/gardening, r/cooking, r/showerthoughts, and more</p>
        </div>
      </div>

      {!player && (
        <div className="bg-card rounded-xl border border-border shadow-lg p-4 sm:p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Unlock the Oracle's Full Power</h3>
          <p className="text-muted-foreground mb-4">
            Login to track your consultations, earn XP, and build your Wisdom Level
          </p>
        </div>
      )}
    </div>
  );
}