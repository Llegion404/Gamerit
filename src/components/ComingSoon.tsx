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

    </div>
  );
}