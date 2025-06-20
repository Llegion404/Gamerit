import { Rocket, Sparkles, Zap, Users, Trophy, Target, Clock, Star } from "lucide-react";

export function ComingSoon() {
  const upcomingFeatures = [
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
              Coming Soon
            </h1>
          </div>
        </div>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          The future of Reddit gaming is being built. Get ready for revolutionary features that will transform how you 
          interact with Reddit content.
        </p>
        
        <div className="flex items-center justify-center space-x-2 text-primary">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="font-medium">Innovation in Progress</span>
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {upcomingFeatures.map((feature, index) => {
          const IconComponent = feature.icon;
          return (
            <div
              key={feature.title}
              className={`relative p-6 rounded-xl border ${feature.borderColor} ${feature.bgColor} transition-all duration-300 hover:shadow-lg hover:scale-105 group`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-lg bg-background border border-border group-hover:scale-110 transition-transform duration-300`}>
                  <IconComponent className={`w-6 h-6 ${feature.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full bg-background border border-border ${feature.color} font-medium`}>
                      {feature.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
              
              {/* Animated border effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </div>
          );
        })}
      </div>

      {/* Timeline Section */}
      <div className="bg-card border border-border rounded-xl p-8 space-y-6">
        <div className="text-center">
          <Clock className="w-8 h-8 mx-auto text-primary mb-3" />
          <h2 className="text-2xl font-bold mb-2">Development Roadmap</h2>
          <p className="text-muted-foreground">Track our progress as we build the future of Reddit gaming</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
              <Star className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold">Phase 1: Core Features</h3>
            <p className="text-sm text-muted-foreground">Reddit Battles, Meme Market, Archaeology</p>
            <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
              ✓ Complete
            </span>
          </div>

          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
              <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold">Phase 2: New Games</h3>
            <p className="text-sm text-muted-foreground">Geoguessr, Dictionary, More</p>
            <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
              🚧 In Progress
            </span>
          </div>

          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold">Phase 3: Community</h3>
            <p className="text-sm text-muted-foreground">Social Features, Competitions</p>
            <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
              🔮 Planned
            </span>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-8 border border-primary/20">
        <h3 className="text-xl font-bold mb-3">Want to be notified when new features launch?</h3>
        <p className="text-muted-foreground mb-6">
          Join our community and be the first to experience cutting-edge Reddit gaming features.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <div className="flex items-center space-x-2 text-primary">
            <Users className="w-5 h-5" />
            <span className="font-medium">Join the community on Reddit</span>
          </div>
          <div className="flex items-center space-x-2 text-primary">
            <Star className="w-5 h-5" />
            <span className="font-medium">Follow development updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}