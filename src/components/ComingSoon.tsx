import { Rocket, Sparkles, Users, Target, Shield } from "lucide-react";

export function ComingSoon() {
  const upcomingFeatures = [
    {
      icon: Shield,
      title: "Subreddit Factions",
      description:
        "Pledge allegiance to your favorite subreddit and battle for your community's honor across all games",
      status: "In Development",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      borderColor: "border-orange-200 dark:border-orange-800",
      featured: true,
    },
    {
      icon: Target,
      title: "Reddit Geoguessr",
      description: "Detective game: guess where Reddit photos were taken",
      status: "Coming Soon",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
      borderColor: "border-green-200 dark:border-green-800",
    },
    {
      icon: Users,
      title: "The Hivemind's Dictionary",
      description: "Weekly competition to define made-up words together",
      status: "Coming Soon",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-12">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
          </div>
          <div className="relative">
            <Rocket className="w-16 h-16 mx-auto text-primary mb-4 animate-bounce-slow" />
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              The Future is Coming
            </h1>
          </div>
        </div>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Revolutionary features that will transform Reddit gaming forever. <br />
          <span className="text-orange-600 dark:text-orange-400 font-semibold">
            Join factions, battle rivals, and claim your community's destiny.
          </span>
        </p>

        <div className="flex items-center justify-center space-x-2 text-primary">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="font-medium">Innovation in Progress</span>
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>

        {/* Progress indicator */}
        <div className="max-w-md mx-auto mt-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Development Progress</span>
            <span>75%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-to-r from-primary to-orange-500 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: "75%" }}
            ></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Subreddit Factions nearly ready for beta testing</p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="space-y-8">
        {/* Featured Feature - Subreddit Factions */}
        <div className="relative">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">🔥 Next Big Feature</h2>
            <p className="text-muted-foreground">The clan system that will change everything</p>
          </div>

          <div className="relative p-8 rounded-2xl border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 via-orange-25 to-transparent dark:from-orange-950 dark:via-orange-975 dark:to-transparent transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] group overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-4 left-4 w-32 h-32 border-2 border-orange-300 rounded-full"></div>
              <div className="absolute bottom-4 right-4 w-24 h-24 border-2 border-orange-300 rounded-full"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-orange-300 rounded-full"></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-center mb-6">
                <div className="p-4 rounded-2xl bg-orange-100 dark:bg-orange-900 border-2 border-orange-200 dark:border-orange-700 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-12 h-12 text-orange-500" />
                </div>
              </div>

              <div className="text-center space-y-4">
                <div className="flex items-center justify-center space-x-3">
                  <h3 className="text-3xl font-bold text-foreground">Subreddit Factions</h3>
                  <span className="px-3 py-1 text-sm font-semibold text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-400 rounded-full border border-orange-200 dark:border-orange-700">
                    In Development
                  </span>
                </div>

                <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  <strong className="text-orange-600 dark:text-orange-400">
                    Tap into Reddit's powerful tribalism.
                  </strong>{" "}
                  Pledge allegiance to your favorite subreddit and turn every game into a battle for your community's
                  honor. Represent r/gaming, r/wallstreetbets, r/memes, or any community you love.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-orange-200 dark:border-orange-800">
                  <div className="text-center space-y-2">
                    <div className="text-2xl">⚔️</div>
                    <div className="text-sm font-medium text-foreground">Cross-Game Battles</div>
                    <div className="text-xs text-muted-foreground">
                      Every victory counts toward your faction's glory
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-2xl">🏆</div>
                    <div className="text-sm font-medium text-foreground">Faction Leaderboards</div>
                    <div className="text-xs text-muted-foreground">See which subreddits dominate Gamerit</div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-2xl">🎖️</div>
                    <div className="text-sm font-medium text-foreground">Exclusive Rewards</div>
                    <div className="text-xs text-muted-foreground">Faction-specific achievements and bonuses</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Animated glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-orange-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pulse-slow"></div>
          </div>
        </div>

        {/* Other Features */}
        <div>
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-foreground mb-2">More Exciting Features</h2>
            <p className="text-muted-foreground">Additional games and experiences in development</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcomingFeatures.slice(1).map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`relative p-6 rounded-xl border ${feature.borderColor} ${feature.bgColor} transition-all duration-300 hover:shadow-lg hover:scale-105 group`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-start space-x-4">
                    <div
                      className={`p-3 rounded-lg bg-background border border-border group-hover:scale-110 transition-transform duration-300`}
                    >
                      <IconComponent className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold">{feature.title}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full bg-background border border-border ${feature.color} font-medium`}
                        >
                          {feature.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  </div>

                  {/* Animated border effect */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
