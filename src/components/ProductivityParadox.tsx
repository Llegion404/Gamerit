import { useState, useEffect, useRef, useCallback } from "react";
import {
  Timer,
  Clock,
  Zap,
  MousePointer2,
  X,
  Play,
  Square,
  Trophy,
  Battery,
  Calendar,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Player } from "../lib/supabase";
import { supabase } from "../lib/supabase";
import { useProgression } from "../hooks/useProgression";
import toast from "react-hot-toast";

interface ProductivityParadoxProps {
  player: Player | null;
  onRefreshPlayer: () => void;
  redditUsername?: string;
}

interface Modal {
  id: string;
  title: string;
  message: string;
  buttons: { text: string; action?: () => void }[];
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}

interface FakeMeeting {
  id: string;
  title: string;
  time: string;
  attendees: number;
  urgency: "low" | "medium" | "high" | "critical";
}

// Dynamic buzzword generator
const buzzwordPrefixes = [
  "Synergistic",
  "Paradigmatic",
  "Holistic",
  "Strategic",
  "Agile",
  "Disruptive",
  "Scalable",
  "Innovative",
  "Dynamic",
  "Optimized",
  "Streamlined",
  "Revolutionary",
  "Next-gen",
  "AI-powered",
  "Data-driven",
  "Cloud-native",
];
const buzzwordRoots = [
  "workflow",
  "pipeline",
  "framework",
  "ecosystem",
  "solution",
  "platform",
  "matrix",
  "vector",
  "paradigm",
  "methodology",
  "architecture",
  "infrastructure",
  "deliverable",
  "touchpoint",
  "mindset",
  "bandwidth",
];
const buzzwordSuffixes = [
  "optimization",
  "transformation",
  "integration",
  "automation",
  "digitization",
  "modernization",
  "standardization",
  "harmonization",
  "rationalization",
  "virtualization",
  "orchestration",
  "acceleration",
  "amplification",
  "realization",
  "actualization",
  "maximization",
];

const generateBuzzPhrase = () => {
  const prefix = buzzwordPrefixes[Math.floor(Math.random() * buzzwordPrefixes.length)];
  const root = buzzwordRoots[Math.floor(Math.random() * buzzwordRoots.length)];
  const suffix = buzzwordSuffixes[Math.floor(Math.random() * buzzwordSuffixes.length)];
  return `${prefix} ${root} ${suffix}`;
};

const expandedModalMessages = [
  // Original messages
  {
    title: "Productivity Insight",
    message: "Productivity is a cage built from the bars of your own to-do list.",
    buttons: [{ text: "Profound" }],
  },
  {
    title: "Time Reflection",
    message: "Are you tracking your time, or is your time tracking you?",
    buttons: [{ text: "Existential Crisis" }],
  },
  {
    title: "Synergy Alert",
    message: () => `Your ${generateBuzzPhrase().toLowerCase()} has not been optimized in 3.7 minutes.`,
    buttons: [{ text: "Optimizing Now" }],
  },
  // New dynamic messages
  {
    title: "Engagement Metrics",
    message: () =>
      `Warning: Your ${generateBuzzPhrase().toLowerCase()} is operating at ${(Math.random() * 50 + 25).toFixed(
        1
      )}% efficiency.`,
    buttons: [{ text: "Recalibrating" }, { text: "Ignore Metrics" }],
  },
  {
    title: "Cross-Platform Integration",
    message: () => `The ${generateBuzzPhrase()} requires immediate stakeholder alignment across all verticals.`,
    buttons: [{ text: "Aligning Stakeholders" }],
  },
  {
    title: "Performance Dashboard",
    message: "Your KPIs indicate a potential opportunity for horizontal scaling of your vertical initiatives.",
    buttons: [{ text: "Scale Horizontally" }, { text: "Go Vertical" }],
  },
  {
    title: "Mindfulness Interrupt",
    message: () => `Remember: ${generateBuzzPhrase()} begins with self-actualization of your core competencies.`,
    buttons: [{ text: "Self-Actualizing" }],
  },
  {
    title: "Bandwidth Assessment",
    message: "Your current bandwidth allocation suggests suboptimal resource utilization patterns.",
    buttons: [{ text: "Reallocating" }],
  },
  {
    title: "Innovation Catalyst",
    message: () => `Breakthrough alert: Your ${generateBuzzPhrase().toLowerCase()} has unlocked new paradigm vectors!`,
    buttons: [{ text: "Vectoring" }, { text: "Paradigm Shift" }],
  },
  {
    title: "Stakeholder Feedback",
    message: "The C-suite wants to circle back on your deliverables to ensure they align with our north star metrics.",
    buttons: [{ text: "Circling Back" }],
  },
  {
    title: "Agile Retrospective",
    message: () =>
      `Sprint review: Your ${generateBuzzPhrase().toLowerCase()} velocity could benefit from right-sizing.`,
    buttons: [{ text: "Right-Sizing" }],
  },
  {
    title: "Digital Transformation",
    message: "Have you considered leveraging machine learning to optimize your human-in-the-loop processes?",
    buttons: [{ text: "Leveraging ML" }, { text: "Staying Human" }],
  },
  {
    title: "Culture Fit Assessment",
    message:
      "Your productivity style suggests you're not drinking enough corporate Kool-Aid. Please hydrate responsibly.",
    buttons: [{ text: "Hydrating" }],
  },
  {
    title: "ROI Maximization",
    message: () =>
      `Analysis shows your ${generateBuzzPhrase().toLowerCase()} could generate 347% ROI with proper implementation.`,
    buttons: [{ text: "Implementing" }],
  },
  {
    title: "Meeting Necessity Check",
    message: "This notification could have been a meeting. Should we schedule a meeting to discuss this notification?",
    buttons: [{ text: "Schedule Meeting" }, { text: "Meeting About Meetings" }],
  },
  {
    title: "Work-Life Integration",
    message:
      "Reminder: Work-life balance is outdated. We prefer work-life integration with optimal life-work synthesis.",
    buttons: [{ text: "Integrating" }],
  },
  {
    title: "Thought Leadership",
    message: () =>
      `Your ${generateBuzzPhrase().toLowerCase()} positions you as a thought leader in the space. Own your narrative.`,
    buttons: [{ text: "Owning Narrative" }],
  },
  {
    title: "Disruption Alert",
    message: "You're not disrupting if you're not uncomfortable. Are you sufficiently uncomfortable right now?",
    buttons: [{ text: "Very Uncomfortable" }, { text: "Need More Disruption" }],
  },
  {
    title: "Value Proposition",
    message: () =>
      `Your ${generateBuzzPhrase().toLowerCase()} creates synergistic value across multiple touchpoints in the customer journey.`,
    buttons: [{ text: "Touching Points" }],
  },
  {
    title: "Pivot Suggestion",
    message: "Data indicates you should pivot your approach. Also, have you considered pivoting your pivot strategy?",
    buttons: [{ text: "Pivoting Pivot" }],
  },
];

const achievements = [
  {
    id: "first_session",
    title: "Corporate Initiate",
    description: "Complete your first productivity session",
    icon: "🎯",
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: "synergy_master",
    title: "Synergy Master",
    description: "Complete 10 paradigm shifts",
    icon: "⚡",
    unlocked: false,
    progress: 0,
    maxProgress: 10,
  },
  {
    id: "time_ninja",
    title: "Procrastination Guru",
    description: "Procrastinate for 5+ minutes straight",
    icon: "🥷",
    unlocked: false,
    progress: 0,
    maxProgress: 300,
  },
  {
    id: "modal_master",
    title: "Notification Ninja",
    description: "Dismiss 25 corporate insights",
    icon: "🚀",
    unlocked: false,
    progress: 0,
    maxProgress: 25,
  },
  {
    id: "marathon_session",
    title: "Productivity Marathon",
    description: "Maintain focus for 30+ minutes",
    icon: "🏃",
    unlocked: false,
    progress: 0,
    maxProgress: 1800,
  },
  {
    id: "buzzword_bingo",
    title: "Buzzword Bingo",
    description: "Encounter 50 unique buzzword combinations",
    icon: "🎲",
    unlocked: false,
    progress: 0,
    maxProgress: 50,
  },
  {
    id: "stress_survivor",
    title: "Stress Survivor",
    description: "Reach maximum productivity stress",
    icon: "😵",
    unlocked: false,
    progress: 0,
    maxProgress: 100,
  },
  {
    id: "meeting_mogul",
    title: "Meeting Mogul",
    description: "Survive 20 fake meeting notifications",
    icon: "📅",
    unlocked: false,
    progress: 0,
    maxProgress: 20,
  },
];

const fakeMeetings = [
  { id: "1", title: "Standup for the Standup Planning", time: "In 5 min", attendees: 12, urgency: "high" as const },
  { id: "2", title: "Quarterly OKR Alignment Sync", time: "In 2 min", attendees: 8, urgency: "critical" as const },
  { id: "3", title: "Innovation Brainstorm Ideation", time: "Now", attendees: 15, urgency: "medium" as const },
  { id: "4", title: "Cross-functional Dependency Mapping", time: "In 1 min", attendees: 6, urgency: "high" as const },
  { id: "5", title: "Retrospective Planning Session", time: "In 3 min", attendees: 10, urgency: "low" as const },
  { id: "6", title: "Synergy Optimization Workshop", time: "In 7 min", attendees: 20, urgency: "critical" as const },
  { id: "7", title: "Agile Transformation Kickoff", time: "In 4 min", attendees: 25, urgency: "high" as const },
  { id: "8", title: "Digital Disruption Deep Dive", time: "In 6 min", attendees: 9, urgency: "medium" as const },
];

export function ProductivityParadox({ player, onRefreshPlayer, redditUsername }: ProductivityParadoxProps) {
  const { awardXP } = useProgression(redditUsername || null);
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

  // New state for enhanced features
  const [productivityStress, setProductivityStress] = useState(0);
  const [focusEnergy, setFocusEnergy] = useState(100);
  const [achievementsList, setAchievementsList] = useState<Achievement[]>(achievements);
  const [modalCount, setModalCount] = useState(0);
  const [paradigmShifts, setParadigmShifts] = useState(0);
  const [buzzwordsSeen, setBuzzwordsSeen] = useState(new Set<string>());
  const [currentMeeting, setCurrentMeeting] = useState<FakeMeeting | null>(null);
  const [meetingCount, setMeetingCount] = useState(0);

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

  // Achievement checking function
  const checkAchievements = useCallback(() => {
    setAchievementsList((prev) =>
      prev.map((achievement) => {
        if (achievement.unlocked) return achievement;

        let newProgress = achievement.progress;

        switch (achievement.id) {
          case "first_session":
            newProgress = isInSession ? 1 : 0;
            break;
          case "synergy_master":
            newProgress = paradigmShifts;
            break;
          case "time_ninja":
            newProgress = Math.max(newProgress, procrastinationTime);
            break;
          case "modal_master":
            newProgress = modalCount;
            break;
          case "marathon_session":
            newProgress = sessionTime;
            break;
          case "buzzword_bingo":
            newProgress = buzzwordsSeen.size;
            break;
          case "stress_survivor":
            newProgress = productivityStress;
            break;
          case "meeting_mogul":
            newProgress = meetingCount;
            break;
        }

        const unlocked = newProgress >= achievement.maxProgress;
        if (unlocked && !achievement.unlocked) {
          toast.success(`🏆 Achievement Unlocked: ${achievement.title}!`, {
            duration: 4000,
            style: { background: "linear-gradient(45deg, #FFD700, #FFA500)" },
          });
          setSessionScore((prev) => prev + 10); // Bonus for achievements
        }

        return { ...achievement, progress: newProgress, unlocked };
      })
    );
  }, [
    isInSession,
    paradigmShifts,
    procrastinationTime,
    modalCount,
    sessionTime,
    buzzwordsSeen.size,
    productivityStress,
    meetingCount,
  ]);

  // Enhanced modal system with dynamic content
  const showRandomModal = useCallback(() => {
    if (currentModal) return;

    const randomMessage = expandedModalMessages[Math.floor(Math.random() * expandedModalMessages.length)];
    const messageText = typeof randomMessage.message === "function" ? randomMessage.message() : randomMessage.message;

    // Track buzzwords
    const buzzwords = messageText
      .toLowerCase()
      .match(
        /\b\w+(?:\s+\w+)*\s+(?:optimization|transformation|integration|automation|digitization|modernization|standardization|harmonization|rationalization|virtualization|orchestration|acceleration|amplification|realization|actualization|maximization)\b/g
      );
    if (buzzwords) {
      setBuzzwordsSeen((prev) => {
        const newSet = new Set(prev);
        buzzwords.forEach((word) => newSet.add(word));
        return newSet;
      });
    }

    const modal: Modal = {
      id: Date.now().toString(),
      title: randomMessage.title,
      message: messageText,
      buttons: randomMessage.buttons.map((btn) => ({
        ...btn,
        action: () => {
          setCurrentModal(null);
          setIsPaused(false);
          setSessionScore((prev) => prev + 1);
          setModalCount((prev) => prev + 1);
          setProductivityStress((prev) => Math.min(100, prev + Math.random() * 15 + 5));
        },
      })),
    };

    setCurrentModal(modal);
    setIsPaused(true);
  }, [currentModal]);

  // Show fake meeting notifications
  const showMeetingNotification = useCallback(() => {
    if (currentMeeting) return;

    const randomMeeting = fakeMeetings[Math.floor(Math.random() * fakeMeetings.length)];
    setCurrentMeeting(randomMeeting);
    setMeetingCount((prev) => prev + 1);

    const urgencyColors = {
      low: "bg-blue-500",
      medium: "bg-yellow-500",
      high: "bg-orange-500",
      critical: "bg-red-500",
    };

    toast(`📅 ${randomMeeting.title} - ${randomMeeting.time} (${randomMeeting.attendees} attendees)`, {
      duration: 4000,
      className: `${urgencyColors[randomMeeting.urgency]} text-white`,
    });

    setTimeout(() => setCurrentMeeting(null), 5000);
  }, [currentMeeting]);

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

      // Award XP based on meta-minutes earned (1 XP per minute, minimum 5 XP)
      if (redditUsername) {
        try {
          const xpAmount = Math.max(5, sessionScore);
          await awardXP(xpAmount, "Completed Productivity Paradox session", {
            sessionDuration: sessionTime,
            metaMinutesEarned: sessionScore,
            procrastinationTime,
            timestamp: new Date().toISOString(),
          });
          toast.success(`Session complete! Earned ${sessionScore} Meta-Minutes and ${xpAmount} XP! 🏆`);
        } catch (xpError) {
          console.error("Failed to award XP for productivity session:", xpError);
          toast.success(`Session complete! Earned ${sessionScore} Meta-Minutes! 🏆`);
        }
      } else {
        toast.success(`Session complete! Earned ${sessionScore} Meta-Minutes! 🏆`);
      }
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
          setParadigmShifts((count) => count + 1);
          setProductivityStress((stress) => Math.min(100, stress + 10));
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

  // Meeting notifications
  useEffect(() => {
    if (!isInSession || isPaused) return;

    const showMeetingRandomly = () => {
      if (Math.random() < 0.2) {
        // 20% chance
        showMeetingNotification();
      }
    };

    const interval = setInterval(showMeetingRandomly, 45000); // Every 45 seconds
    return () => clearInterval(interval);
  }, [isInSession, isPaused, showMeetingNotification]);

  // Focus energy drain and productivity stress updates
  useEffect(() => {
    if (!isInSession || isPaused) return;

    const interval = setInterval(() => {
      setFocusEnergy((prev) => Math.max(0, prev - 0.5)); // Slowly drains

      // Stress increases based on activity
      if (isMouseMoving) {
        setProductivityStress((prev) => Math.min(100, prev + 0.3));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isInSession, isPaused, procrastinationTime, isMouseMoving]);

  // Achievement checking
  useEffect(() => {
    if (isInSession) {
      checkAchievements();
    }
  }, [
    isInSession,
    sessionTime,
    modalCount,
    paradigmShifts,
    procrastinationTime,
    buzzwordsSeen.size,
    productivityStress,
    meetingCount,
    checkAchievements,
  ]);

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
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-sm text-muted-foreground">Session Score</div>
                  <div className="text-xl font-bold text-primary">{sessionScore} Meta-Minutes</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Paradigm Shifts</div>
                  <div className="text-lg font-semibold text-green-500">{paradigmShifts}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Corporate Insights</div>
                  <div className="text-lg font-semibold text-blue-500">{modalCount}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Buzzwords Absorbed</div>
                  <div className="text-lg font-semibold text-purple-500">{buzzwordsSeen.size}</div>
                </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

            {/* Productivity Stress Meter */}
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold">Productivity Stress</h3>
              </div>
              <div className="space-y-3">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ease-out ${
                      productivityStress > 80
                        ? "bg-red-500"
                        : productivityStress > 60
                        ? "bg-orange-500"
                        : productivityStress > 40
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${productivityStress}%` }}
                  />
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  {productivityStress.toFixed(1)}% -{" "}
                  {productivityStress > 80
                    ? "BURNOUT IMMINENT"
                    : productivityStress > 60
                    ? "HIGH STRESS"
                    : productivityStress > 40
                    ? "MODERATE STRESS"
                    : "OPTIMAL ZONE"}
                </div>
              </div>
            </div>

            {/* Focus Energy Battery */}
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Battery className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold">Focus Energy</h3>
              </div>
              <div className="space-y-3">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ease-out ${
                      focusEnergy > 60 ? "bg-green-500" : focusEnergy > 30 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${focusEnergy}%` }}
                  />
                </div>
                <div className="text-center text-sm text-muted-foreground">{focusEnergy.toFixed(1)}% Remaining</div>
                {focusEnergy < 20 && (
                  <div className="text-center text-xs text-red-500 animate-pulse">ENERGY CRITICAL - NEED COFFEE</div>
                )}
              </div>
            </div>
          </div>

          {/* Achievements Panel */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold">Achievements</h3>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {achievementsList.slice(0, 6).map((achievement) => (
                <div
                  key={achievement.id}
                  className={`flex items-center gap-3 p-2 rounded ${
                    achievement.unlocked ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-muted/50"
                  }`}
                >
                  <div className="text-lg">{achievement.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        achievement.unlocked ? "text-yellow-500" : "text-muted-foreground"
                      }`}
                    >
                      {achievement.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{achievement.description}</div>
                    <div className="w-full bg-muted rounded-full h-1 mt-1">
                      <div
                        className={`h-full rounded-full transition-all ${
                          achievement.unlocked ? "bg-yellow-500" : "bg-muted-foreground/30"
                        }`}
                        style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Corporate KPI Dashboard */}
          <div className="bg-card rounded-lg border p-6 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-semibold">Live KPIs</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Synergy Coefficient</span>
                <span className="font-mono text-sm">{(Math.random() * 40 + 60).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ROI Multiplier</span>
                <span className="font-mono text-sm text-green-500">+{(Math.random() * 200 + 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Disruption Index</span>
                <span className="font-mono text-sm">{(Math.random() * 9 + 1).toFixed(1)}/10</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Agility Score</span>
                <span className="font-mono text-sm text-blue-500">
                  {(sessionTime * 0.1 + Math.random() * 20).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Innovation Velocity</span>
                <span className="font-mono text-sm">
                  {(paradigmShifts * 2.3 + Math.random() * 5).toFixed(1)} units/min
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Bandwidth Utilization</span>
                <span className="font-mono text-sm text-orange-500">
                  {Math.min(100, sessionTime * 0.05 + Math.random() * 30).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Fake Calendar Integration */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-semibold">Upcoming "Priorities"</h3>
            </div>
            <div className="space-y-2">
              {fakeMeetings.slice(0, 4).map((meeting) => (
                <div
                  key={meeting.id}
                  className={`flex items-center justify-between p-2 rounded border ${
                    meeting.urgency === "critical"
                      ? "border-red-500 bg-red-500/5"
                      : meeting.urgency === "high"
                      ? "border-orange-500 bg-orange-500/5"
                      : meeting.urgency === "medium"
                      ? "border-yellow-500 bg-yellow-500/5"
                      : "border-blue-500 bg-blue-500/5"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{meeting.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {meeting.time} • {meeting.attendees} people
                    </div>
                  </div>
                  <div
                    className={`text-xs px-2 py-1 rounded ${
                      meeting.urgency === "critical"
                        ? "bg-red-500 text-white"
                        : meeting.urgency === "high"
                        ? "bg-orange-500 text-white"
                        : meeting.urgency === "medium"
                        ? "bg-yellow-500 text-white"
                        : "bg-blue-500 text-white"
                    }`}
                  >
                    {meeting.urgency.toUpperCase()}
                  </div>
                </div>
              ))}
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
