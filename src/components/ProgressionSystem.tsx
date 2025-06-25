import { useProgression } from "../hooks/useProgression";

interface ProgressionSystemProps {
  redditUsername: string | null;
  className?: string;
  compact?: boolean;
}

const tierColors = {
  bronze:
    "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/50 border-orange-200 dark:border-orange-900/50",
  silver:
    "text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800/50",
  gold: "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-900/50",
  platinum:
    "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/50 border-purple-200 dark:border-purple-900/50",
};

const tierIcons = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

export default function ProgressionSystem({ redditUsername, className = "", compact = false }: ProgressionSystemProps) {
  const { progression, achievements, playerAchievements, loading, error, getXPProgress } =
    useProgression(redditUsername);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-muted rounded mb-2"></div>
        <div className="h-2 bg-muted rounded"></div>
      </div>
    );
  }

  if (error || !progression) {
    return null;
  }

  const xpProgress = getXPProgress();
  const completedAchievements = playerAchievements.filter((pa) => pa.completed);
  const incompleteAchievements = playerAchievements.filter((pa) => !pa.completed);

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        {/* Level Badge */}
        <div className="flex items-center space-x-1.5 bg-gradient-to-r from-primary/10 to-primary/5 text-primary px-3 py-1.5 rounded-full text-sm font-semibold border border-primary/20 shadow-sm">
          <span className="text-sm">⭐</span>
          <span>Lv.{progression.level}</span>
        </div>

        {/* XP Progress */}
        <div className="flex-1 max-w-40">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
            <span>{xpProgress.current}</span>
            <span>{xpProgress.needed} XP</span>
          </div>
          <div className="w-full bg-muted/70 rounded-full h-2.5 border border-border/30 shadow-inner">
            <div
              className="bg-gradient-to-r from-primary to-primary/80 h-2.5 rounded-full transition-all duration-500 shadow-sm relative overflow-hidden"
              style={{ width: `${Math.min(xpProgress.percentage, 100)}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Achievement Count */}
        <div className="text-sm text-muted-foreground bg-secondary/60 px-2.5 py-1.5 rounded-md border border-border/40 font-medium">
          <span className="text-xs mr-1">🏆</span>
          <span>
            {completedAchievements.length}/{achievements.length}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-xl border border-border shadow-lg p-6 ${className}`}>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-foreground flex items-center space-x-3">
            <span className="text-2xl">🎮</span>
            <span>Player Progression</span>
          </h2>
          <div className="flex items-center space-x-2 bg-gradient-to-r from-primary/15 to-primary/5 text-primary px-5 py-3 rounded-xl font-bold border border-primary/20 shadow-sm">
            <span className="text-xl">⭐</span>
            <span className="text-lg">Level {progression.level}</span>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="mb-8 bg-muted/30 rounded-xl p-6 border border-border/50">
          <div className="flex justify-between text-sm text-muted-foreground mb-3">
            <span className="font-semibold">Experience Points</span>
            <span className="font-mono font-medium">
              {xpProgress.current} / {xpProgress.needed} XP
            </span>
          </div>
          <div className="w-full bg-muted/80 rounded-full h-5 border border-border/40 shadow-inner mb-3">
            <div
              className="bg-gradient-to-r from-primary via-primary to-primary/90 h-5 rounded-full transition-all duration-700 shadow-sm relative overflow-hidden"
              style={{ width: `${Math.min(xpProgress.percentage, 100)}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground font-mono">Total XP: {progression.xp.toLocaleString()}</div>
            <div className="text-xs text-primary font-semibold">{Math.round(xpProgress.percentage)}% to next level</div>
          </div>
        </div>
      </div>

      {/* Achievement Section */}
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center space-x-3">
          <span className="text-xl">🏆</span>
          <span>Achievements</span>
          <div className="bg-muted/50 text-muted-foreground px-3 py-1 rounded-full text-sm font-semibold border border-border/50">
            {completedAchievements.length}/{achievements.length}
          </div>
        </h3>

        {/* Completed Achievements */}
        {completedAchievements.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-4 flex items-center space-x-2">
              <span>✅</span>
              <span>Completed ({completedAchievements.length})</span>
            </h4>
            <div className="space-y-4">
              {completedAchievements.map((pa) => (
                <div
                  key={pa.id}
                  className="flex items-center space-x-4 p-5 bg-green-50/80 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="text-3xl">{pa.achievement.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="font-semibold text-foreground text-lg">{pa.achievement.name}</h5>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          tierColors[pa.achievement.tier]
                        }`}
                      >
                        {tierIcons[pa.achievement.tier]} {pa.achievement.tier.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{pa.achievement.description}</p>
                    {pa.completed_at && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Completed {new Date(pa.completed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-600 dark:text-green-400 mb-1">✅ Complete</div>
                    <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border/30">
                      +{pa.achievement.xp_reward} XP, +{pa.achievement.karma_chips_reward} KC
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incomplete Achievements */}
        {incompleteAchievements.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-muted-foreground mb-4 flex items-center space-x-2">
              <span>⏳</span>
              <span>In Progress ({incompleteAchievements.length})</span>
            </h4>
            <div className="space-y-4">
              {incompleteAchievements.map((pa) => (
                <div
                  key={pa.id}
                  className="flex items-center space-x-4 p-5 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="text-3xl opacity-70">{pa.achievement.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="font-semibold text-foreground text-lg">{pa.achievement.name}</h5>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          tierColors[pa.achievement.tier]
                        }`}
                      >
                        {tierIcons[pa.achievement.tier]} {pa.achievement.tier.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{pa.achievement.description}</p>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>Progress</span>
                        <span>
                          {pa.progress} / {pa.achievement.requirement_value}
                        </span>
                      </div>
                      <div className="w-full bg-muted/70 rounded-full h-2.5 border border-border/30">
                        <div
                          className="bg-gradient-to-r from-primary to-primary/80 h-2.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min((pa.progress / pa.achievement.requirement_value) * 100, 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-primary mb-1">
                      {Math.round((pa.progress / pa.achievement.requirement_value) * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border/30">
                      +{pa.achievement.xp_reward} XP, +{pa.achievement.karma_chips_reward} KC
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked Achievements */}
        {achievements.length > playerAchievements.length && (
          <div>
            <h4 className="text-lg font-semibold text-muted-foreground mb-4 flex items-center space-x-2">
              <span>🔒</span>
              <span>Locked ({achievements.length - playerAchievements.length})</span>
            </h4>
            <div className="space-y-4">
              {achievements
                .filter((achievement) => !playerAchievements.some((pa) => pa.achievement.id === achievement.id))
                .map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center space-x-4 p-5 bg-muted/20 border border-border/60 rounded-xl opacity-70 hover:opacity-85 transition-opacity duration-200"
                  >
                    <div className="text-3xl opacity-40">{achievement.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="font-semibold text-muted-foreground text-lg">{achievement.name}</h5>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border opacity-60 ${
                            tierColors[achievement.tier]
                          }`}
                        >
                          {tierIcons[achievement.tier]} {achievement.tier.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-muted-foreground mb-1">🔒 Locked</div>
                      <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/30">
                        +{achievement.xp_reward} XP, +{achievement.karma_chips_reward} KC
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
