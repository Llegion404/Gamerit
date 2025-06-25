import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface AchievementNotificationProps {
  achievements: string[];
  onClose: () => void;
}

export default function AchievementNotification({ achievements, onClose }: AchievementNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (achievements.length > 0) {
      setVisible(true);
      setCurrentIndex(0);

      // Auto-advance through achievements
      const interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= achievements.length - 1) {
            setVisible(false);
            setTimeout(onClose, 500); // Allow fade out animation
            return prev;
          }
          return prev + 1;
        });
      }, 4000); // Show each achievement for 4 seconds

      return () => clearInterval(interval);
    }
  }, [achievements, onClose]);

  if (!visible || achievements.length === 0) {
    return null;
  }

  const currentAchievement = achievements[currentIndex];

  return (
    <div
      className={`fixed top-20 right-4 z-50 transform transition-all duration-500 ${
        visible ? "translate-x-0 opacity-100 scale-100" : "translate-x-full opacity-0 scale-95"
      }`}
    >
      <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 p-1 rounded-xl shadow-2xl">
        <div className="bg-card rounded-lg p-5 min-w-80 max-w-sm border border-border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                <div className="text-3xl animate-bounce">🏆</div>
                <h3 className="font-bold text-foreground text-xl">Achievement Unlocked!</h3>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg shadow-sm">
                <div className="text-3xl">🎉</div>
                <div>
                  <h4 className="font-semibold text-foreground text-lg">{currentAchievement}</h4>
                  <p className="text-sm text-muted-foreground">Congratulations on this milestone!</p>
                </div>
              </div>

              {achievements.length > 1 && (
                <div className="mt-4 flex justify-center space-x-1.5">
                  {achievements.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                        index === currentIndex ? "bg-yellow-500 scale-125" : "bg-muted/60"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setVisible(false);
                setTimeout(onClose, 500);
              }}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent ml-2"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
