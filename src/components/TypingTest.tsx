import { useState, useEffect, useRef, useCallback } from "react";
import { Keyboard, RefreshCw, Clock, Trophy, Smile, Check, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProgression } from "../hooks/useProgression";
import toast from "react-hot-toast";

interface DadJoke {
  id: string;
  joke: string;
  score: number;
  author: string;
  subreddit: string;
}

export default function TypingTest() {
  const { player, redditUser } = useAuth();
  const { awardXP } = useProgression(redditUser?.name || null);
  const [jokes, setJokes] = useState<DadJoke[]>([]);
  const [currentJoke, setCurrentJoke] = useState<DadJoke | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [errors, setErrors] = useState(0);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [recentScores, setRecentScores] = useState<{wpm: number, date: string}[]>([]);
  const [fetchingJokes, setFetchingJokes] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch dad jokes from Reddit
  const fetchJokes = useCallback(async () => {
    if (fetchingJokes) return;
    
    setIsLoading(true);
    setFetchingJokes(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("fetch-dad-jokes");
      
      if (error) throw error;
      
      if (data?.jokes && data.jokes.length > 0) {
        setJokes(data.jokes);
        setCurrentJoke(data.jokes[0]);
      } else {
        throw new Error("No jokes returned from API");
      }
    } catch (error) {
      console.error("Error fetching dad jokes:", error);
      toast.error("Failed to load dad jokes");
    } finally {
      setIsLoading(false);
      setFetchingJokes(false);
    }
  }, [fetchingJokes]);

  // Initial data load
  useEffect(() => {
    fetchJokes();
    
    // Fetch personal best if logged in
    if (player && redditUser) {
      fetchPersonalBest();
    }
  }, [player, redditUser, fetchJokes]);

  const fetchPersonalBest = async () => {
    if (!player) return;
    
    try {
      // This would be replaced with a real database query in production
      // For now, we'll use localStorage as a simple demo
      const storedBest = localStorage.getItem(`typing_best_${player.id}`);
      if (storedBest) {
        setPersonalBest(parseInt(storedBest));
      }
      
      // Get recent scores
      const storedScores = localStorage.getItem(`typing_scores_${player.id}`);
      if (storedScores) {
        setRecentScores(JSON.parse(storedScores));
      }
    } catch (error) {
      console.error("Error fetching personal best:", error);
    }
  };

  const saveScore = async (newWpm: number) => {
    if (!player) return;
    
    try {
      // Update personal best if needed
      if (!personalBest || newWpm > personalBest) {
        setPersonalBest(newWpm);
        localStorage.setItem(`typing_best_${player.id}`, newWpm.toString());
        
        // Award XP for new personal best
        if (redditUser?.name) {
          try {
            await awardXP(10, "New typing speed personal best", {
              wpm: newWpm,
              previous_best: personalBest,
              timestamp: new Date().toISOString(),
            });
            toast.success("New personal best! (+10 XP)");
          } catch (error) {
            console.error("Failed to award XP:", error);
          }
        }
      } else {
        // Award smaller XP for completing a test
        if (redditUser?.name) {
          try {
            await awardXP(2, "Completed typing test", {
              wpm: newWpm,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.error("Failed to award XP:", error);
          }
        }
      }
      
      // Save to recent scores
      const newScore = { wpm: newWpm, date: new Date().toISOString() };
      const updatedScores = [...(recentScores || []), newScore].slice(-5); // Keep last 5 scores
      setRecentScores(updatedScores);
      localStorage.setItem(`typing_scores_${player.id}`, JSON.stringify(updatedScores));
    } catch (error) {
      console.error("Error saving score:", error);
    }
  };

  const startTest = () => {
    if (!currentJoke) return;
    
    setIsTyping(true);
    setStartTime(Date.now());
    setEndTime(null);
    setWpm(null);
    setAccuracy(null);
    setErrors(0);
    setInput("");
    
    // Focus the input field
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const getNextJoke = () => {
    if (jokes.length <= 1) {
      // If we only have one joke or none, fetch more
      fetchJokes();
      return;
    }
    
    const currentIndex = jokes.findIndex(joke => joke.id === currentJoke?.id);
    const nextIndex = (currentIndex + 1) % jokes.length;
    setCurrentJoke(jokes[nextIndex]);
    setInput("");
    setIsTyping(false);
    setStartTime(null);
    setEndTime(null);
    setWpm(null);
    setAccuracy(null);
    setErrors(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isTyping || !currentJoke) return;
    
    const newInput = e.target.value;
    setInput(newInput);
    
    // Count errors (simple character-by-character comparison)
    let errorCount = 0;
    for (let i = 0; i < newInput.length; i++) {
      if (i >= currentJoke.joke.length || newInput[i] !== currentJoke.joke[i]) {
        errorCount++;
      }
    }
    setErrors(errorCount);
    
    // Check if completed
    if (newInput === currentJoke.joke) {
      const endTimeMs = Date.now();
      setEndTime(endTimeMs);
      setIsTyping(false);
      
      // Calculate WPM: (characters / 5) / minutes
      const minutes = (endTimeMs - (startTime || 0)) / 60000;
      const words = currentJoke.joke.length / 5; // Standard: 5 chars = 1 word
      const calculatedWpm = Math.round(words / minutes);
      setWpm(calculatedWpm);
      
      // Calculate accuracy
      const totalChars = currentJoke.joke.length;
      const errorRate = errorCount / totalChars;
      const calculatedAccuracy = Math.round((1 - errorRate) * 100);
      setAccuracy(calculatedAccuracy);
      
      // Save score
      saveScore(calculatedWpm);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Keyboard className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Typing Test</h1>
              <p className="text-muted-foreground">Test your typing speed with Reddit dad jokes</p>
            </div>
          </div>
          {personalBest && (
            <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                <span className="font-semibold">Personal Best: {personalBest} WPM</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Game Area */}
      <div className="bg-card rounded-lg border p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Joke Display */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Smile className="w-4 h-4" />
                  <span>r/{currentJoke?.subreddit} • u/{currentJoke?.author}</span>
                </div>
                <button
                  onClick={getNextJoke}
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                  disabled={isTyping}
                >
                  <RefreshCw className="w-3 h-3" />
                  Next Joke
                </button>
              </div>
              
              <div className={`p-6 rounded-lg ${isTyping ? 'bg-primary/5 border border-primary/20' : 'bg-secondary/50 border border-border'}`}>
                <p className="text-lg font-medium leading-relaxed">
                  {currentJoke?.joke.split('').map((char, index) => {
                    let className = "";
                    
                    if (index < input.length) {
                      className = input[index] === char ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400";
                    }
                    
                    return (
                      <span key={index} className={className}>
                        {char}
                      </span>
                    );
                  })}
                </p>
              </div>
            </div>

            {/* Input Area */}
            <div className="space-y-4">
              {!isTyping && !endTime ? (
                <button
                  onClick={startTest}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                >
                  Start Typing Test
                </button>
              ) : isTyping ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Timer running...</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {errors > 0 ? (
                        <>
                          <X className="w-4 h-4 text-red-500" />
                          <span className="text-red-500">{errors} errors</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-green-500">No errors</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="Type the joke exactly as shown above..."
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-green-700 dark:text-green-300 mb-4 text-center">Test Complete!</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary">{wpm}</div>
                        <div className="text-sm text-muted-foreground">Words Per Minute</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary">{accuracy}%</div>
                        <div className="text-sm text-muted-foreground">Accuracy</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={startTest}
                        className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={getNextJoke}
                        className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-lg font-medium hover:bg-secondary/80 transition-colors"
                      >
                        Next Joke
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Recent Scores */}
      {recentScores && recentScores.length > 0 && (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Recent Scores
          </h3>
          
          <div className="space-y-2">
            {recentScores.map((score, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                <div className="text-sm text-muted-foreground">
                  {new Date(score.date).toLocaleDateString()} {new Date(score.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
                <div className="font-semibold">{score.wpm} WPM</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">How It Works</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• Type the dad joke exactly as shown, including punctuation and capitalization</p>
          <p>• Your typing speed is measured in Words Per Minute (WPM)</p>
          <p>• Accuracy is calculated based on the number of errors made</p>
          <p>• Set a new personal best to earn 10 XP</p>
          <p>• Complete any typing test to earn 2 XP</p>
          <p>• All jokes are sourced from Reddit's r/dadjokes</p>
        </div>
      </div>
    </div>
  );
}