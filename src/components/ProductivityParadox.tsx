import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Clock, Zap, MousePointer2, X, Play, Square } from "lucide-react";
import { Player } from "../lib/supabase";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

interface ProductivityParadoxProps {
  player: Player | null;
  onRefreshPlayer: () => void;
}

interface Modal {
  id: string;
  title: string;
  message: string;
  buttons: { text: string; action?: () => void }[];
}

const modalMessages = [
  {
    title: "Productivity Insight",
    message: "Productivity is a cage built from the bars of your own to-do list.",
    buttons: [{ text: "OK" }],
  },
  {
    title: "Time Reflection",
    message: "Are you tracking your time, or is your time tracking you?",
    buttons: [{ text: "Ponder..." }],
  },
  {
    title: "Synergy Alert",
    message: "Your paradigms have not shifted in 3.7 minutes. Please reconsider your workflow.",
    buttons: [{ text: "Reconsidering" }],
  },
  {
    title: "Life Optimization",
    message: "You have spent 0.01% of your life on this page. Was this an optimal use of resources?",
    buttons: [{ text: "Yes" }, { text: "No" }],
  },
  {
    title: "Performance Review",
    message: "Remember: if you're not moving forward, you're a potential cost center.",
    buttons: [{ text: "Understood" }],
  },
  {
    title: "Workflow Analysis",
    message: "Your current productivity metrics indicate a 47% deviation from optimal synergy parameters.",
    buttons: [{ text: "Optimizing" }],
  },
  {
    title: "Strategic Realignment",
    message: "The paradigm matrix requires immediate recalibration to maintain peak efficiency vectors.",
    buttons: [{ text: "Recalibrating" }],
  },
];

export function ProductivityParadox({ player, onRefreshPlayer }: ProductivityParadoxProps) {
  const [isInSession, setIsInSession] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [synergyCountdown, setSynergyCountdown] = useState(300); // 5 minutes
  const [paradigmProgress, setParadigmProgress] = useState(0);
  const [procrastinationTime, setProcrastinationTime] = useState(0);
  const [isMouseMoving, setIsMouseMoving] = useState(true);
  const [sessionScore, setSessionScore] = useState(0);
  const [currentModal, setCurrentModal] = useState<Modal | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const mouseTimeoutRef = useRef<NodeJS.Timeout>();
  const lastMouseMoveRef = useRef<number>(Date.now());

  // Mouse tracking for procrastination clock
  const handleMouseMove = useCallback(() => {
    setIsMouseMoving(true);
    lastMouseMoveRef.current = Date.now();

    if (mouseTimeoutRef.current) {
      clearTimeout(mouseTimeoutRef.current);
    }

    mouseTimeoutRef.current = setTimeout(() => {
      setIsMouseMoving(false);
    }, 2000); // 2 seconds of no movement = procrastinating
  }, []);

  // Show random modal
  const showRandomModal = useCallback(() => {
    if (currentModal) return; // Don't show if modal already open

    const randomMessage = modalMessages[Math.floor(Math.random() * modalMessages.length)];
    const modal: Modal = {
      id: Date.now().toString(),
      title: randomMessage.title,
      message: randomMessage.message,
      buttons: randomMessage.buttons.map((btn) => ({
        ...btn,
        action: () => {
          setCurrentModal(null);
          setIsPaused(false);
          // Small bonus for dismissing modal
          setSessionScore((prev) => prev + 1);
        },
      })),
    };

    setCurrentModal(modal);
    setIsPaused(true);
  }, [currentModal]);

  // Start synergy session
  const startSession = async () => {
    if (!player || player.points < 25) {
      toast.error("Need 25 Karma Chips to enter Focus Mode!");
      return;
    }

    try {
      // Deduct 25 karma chips
      const { error } = await supabase.rpc("update_player_points", {
        p_player_id: player.id,
        p_points_change: -25,
      });
      if (error) throw error;

      setIsInSession(true);
      setSessionStartTime(Date.now());
      setSessionTime(0);
      setSynergyCountdown(300);
      setParadigmProgress(0);
      setProcrastinationTime(0);
      setSessionScore(0);
      setIsPaused(false);

      onRefreshPlayer();
      toast.success("Focus Mode activated! 🎯");

      // Show first modal after 10-30 seconds
      setTimeout(showRandomModal, Math.random() * 20000 + 10000);
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error("Failed to start session. Please try again.");
    }
  };

  // End synergy session
  const endSession = async () => {
    if (!player || !isInSession) return;

    try {
      // Award meta-minutes based on session score
      const { error } = await supabase.rpc("update_meta_minutes", {
        p_player_id: player.id,
        p_minutes_to_add: sessionScore,
      });
      if (error) throw error;

      setIsInSession(false);
      setSessionStartTime(null);
      setCurrentModal(null);
      setIsPaused(false);

      onRefreshPlayer();
      toast.success(`Session complete! Earned ${sessionScore} Meta-Minutes! 🏆`);
    } catch (error) {
      console.error("Error ending session:", error);
      toast.error("Failed to save session. Please try again.");
    }
  };

  // Main session timer effect
  useEffect(() => {
    if (!isInSession || isPaused || !sessionStartTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - sessionStartTime) / 1000);
      setSessionTime(elapsed);

      // Award points based on elapsed time (1 point per 10 seconds)
      const newScore = Math.floor(elapsed / 10);
      if (!isMouseMoving) {
        // Bonus for procrastination
        const procrastinationBonus = Math.floor((now - lastMouseMoveRef.current) / 1000 / 5);
        setSessionScore(newScore + procrastinationBonus);
        setProcrastinationTime(Math.floor((now - lastMouseMoveRef.current) / 1000));
      } else {
        setSessionScore(newScore);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isInSession, isPaused, sessionStartTime, isMouseMoving]);

  // Synergy countdown effect
  useEffect(() => {
    if (!isInSession || isPaused) return;

    const interval = setInterval(() => {
      setSynergyCountdown((prev) => {
        if (prev <= 1) {
          showRandomModal();
          return 300; // Reset to 5 minutes
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isInSession, isPaused, showRandomModal]);

  // Paradigm shift progress effect
  useEffect(() => {
    if (!isInSession || isPaused) return;

    const interval = setInterval(() => {
      setParadigmProgress((prev) => {
        if (prev >= 100) {
          // Paradigm shift complete!
          setSessionScore((current) => current + 5);
          toast.success("🎉 PARADIGM SHIFT COMPLETE! +5 Meta-Minutes!", {
            style: {
              background: "linear-gradient(45deg, #ff6b6b, #4ecdc4)",
              color: "white",
            },
          });
          return 0;
        }
        return prev + 100 / 180; // Fill over 3 minutes
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isInSession, isPaused]);

  // Mouse move listener
  useEffect(() => {
    if (isInSession) {
      document.addEventListener("mousemove", handleMouseMove);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        if (mouseTimeoutRef.current) {
          clearTimeout(mouseTimeoutRef.current);
        }
      };
    }
  }, [isInSession, handleMouseMove]);

  // Random modal intervals
  useEffect(() => {
    if (!isInSession || isPaused) return;

    const showModalRandomly = () => {
      if (Math.random() < 0.3) {
        // 30% chance
        showRandomModal();
      }
    };

    const interval = setInterval(showModalRandomly, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [isInSession, isPaused, showRandomModal]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatSessionTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  if (!player) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-card rounded-lg border p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Productivity Paradox</h2>
          <p className="text-muted-foreground">Please log in to access the Productivity Paradox experience.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="bg-card rounded-lg border p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Timer className="w-8 h-8" />
              Productivity Paradox
            </h1>
            <p className="text-muted-foreground mt-2">Experience the ultimate focus enhancement dashboard</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total Meta-Minutes</div>
            <div className="text-2xl font-bold text-primary">{(player?.meta_minutes || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {!isInSession ? (
        /* Pre-session view */
        <div className="bg-card rounded-lg border p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Ready to Enter Focus Mode?</h2>
            <p className="text-muted-foreground mb-6">
              Immerse yourself in the ultimate productivity experience. Watch timers, progress bars, and receive
              insights while earning Meta-Minutes through the art of focused observation.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <div className="text-sm text-muted-foreground mb-2">Entry Cost</div>
              <div className="text-lg font-semibold">25 Karma Chips</div>
            </div>
            <button
              onClick={startSession}
              disabled={player.points < 25}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-5 h-5" />
              Enter Focus Mode
            </button>
            {player.points < 25 && (
              <p className="text-destructive text-sm mt-2">Need {25 - player.points} more Karma Chips</p>
            )}
          </div>
        </div>
      ) : (
        /* Active session view */
        <div className="space-y-6">
          {/* Session controls */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">Session Score</div>
                <div className="text-xl font-bold text-primary">{sessionScore} Meta-Minutes</div>
              </div>
              <button
                onClick={endSession}
                className="inline-flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 transition-colors"
              >
                <Square className="w-4 h-4" />
                End Synergy Session
              </button>
            </div>
          </div>

          {/* Dashboard of Distraction */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Session Clock */}
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Master Session Clock</h3>
              </div>
              <div className="text-center">
                <div className="text-4xl font-mono font-bold text-primary mb-2">{formatSessionTime(sessionTime)}</div>
                <div className="text-sm text-muted-foreground">Total Elapsed Time</div>
              </div>
            </div>

            {/* Time to Synergy Countdown */}
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold">Time to Synergy</h3>
              </div>
              <div className="text-center">
                <div className="text-4xl font-mono font-bold text-yellow-500 mb-2">{formatTime(synergyCountdown)}</div>
                <div className="text-sm text-muted-foreground">Next Insight Incoming</div>
              </div>
            </div>

            {/* Paradigm Shift Progress */}
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold">Paradigm Shift Progress</h3>
              </div>
              <div className="space-y-3">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-1000 ease-out"
                    style={{ width: `${paradigmProgress}%` }}
                  />
                </div>
                <div className="text-center text-sm text-muted-foreground">{paradigmProgress.toFixed(1)}% Complete</div>
                {paradigmProgress > 90 && (
                  <div className="text-center text-xs text-green-500 animate-pulse">PARADIGM SHIFT IMMINENT</div>
                )}
              </div>
            </div>

            {/* Procrastination Clock */}
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <MousePointer2 className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold">Procrastination Clock</h3>
              </div>
              <div className="text-center">
                <div className="text-4xl font-mono font-bold text-purple-500 mb-2">
                  {formatTime(procrastinationTime)}
                </div>
                <div className="text-sm text-muted-foreground">{isMouseMoving ? "Active" : "Accumulating Zen"}</div>
                {!isMouseMoving && (
                  <div className="text-xs text-purple-400 mt-1">
                    +{Math.floor(procrastinationTime / 5)} bonus points
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay */}
      {currentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border max-w-md w-full p-6 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{currentModal.title}</h3>
              <button
                onClick={() => {
                  setCurrentModal(null);
                  setIsPaused(false);
                  setSessionScore((prev) => prev + 1);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-muted-foreground mb-6">{currentModal.message}</p>
            <div className="flex gap-2 justify-end">
              {currentModal.buttons.map((button, index) => (
                <button
                  key={index}
                  onClick={button.action}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  {button.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
