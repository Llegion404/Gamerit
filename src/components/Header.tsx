import { Trophy, User, LogOut, Gift, Sun, Moon, Menu, X, Target, TrendingUp, Search, SquareDashedBottomCode, Timer, Italic as Crystal } from "lucide-react";
import { useState } from "react";
import { Player } from "../lib/supabase";
import { RedditUser } from "../lib/reddit-auth";
import { useTheme } from "../hooks/useTheme";
import ProgressionSystem from "./ProgressionSystem";

interface HeaderProps {
  player: Player | null;
  redditUser: RedditUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onClaimWelfare: () => void;
  canClaimWelfare: boolean;
  activeGame: string;
  onGameChange: (gameId: string) => void;
  isOracleConsulting?: boolean;
}

const games = [
  { id: "reddit-battles", name: "Reddit Battles", icon: Target, active: true },
  { id: "meme-market", name: "Meme Market", icon: TrendingUp, active: true },
  { id: "archaeology", name: "Archaeology", icon: Search, active: true },
  { id: "reddit-radio", name: "Reddit Radio", icon: SquareDashedBottomCode, active: true },
  { id: "reddit-oracle", name: "Reddit Oracle", icon: Crystal, active: true },
  { id: "progression", name: "Progression", icon: Trophy, active: true },
  { id: "coming-soon", name: "Coming soon", icon: SquareDashedBottomCode, active: false },
];

export function Header({
  player,
  redditUser,
  onLogin,
  onLogout,
  onClaimWelfare,
  canClaimWelfare,
  activeGame,
  onGameChange,
  isOracleConsulting = false,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="sticky top-0 z-50">
      {/* Main Header */}
      <header className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:block">
                <h1 className="text-xl font-semibold tracking-tight">Gamerit</h1>
                <p className="text-sm text-muted-foreground">Reddit Gaming Platform</p>
              </div>
              <div className="sm:hidden">
                <h1 className="text-lg font-semibold tracking-tight">Gamerit</h1>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {player && redditUser ? (
                <>
                  {/* Progression Display (Compact) */}
                  <ProgressionSystem redditUsername={redditUser.name} compact={true} className="hidden lg:flex" />

                  <div className="bg-secondary border border-border rounded-lg px-3 py-1.5">
                    <div className="flex items-center space-x-2">
                      <Trophy className="w-4 h-4 text-primary" />
                      <span className="font-medium">{player.points.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Karma Chips</div>
                  </div>

                  {canClaimWelfare && (
                    <button
                      onClick={onClaimWelfare}
                      className="bg-casino-accent hover:bg-casino-accent/90 text-casino-primary font-medium px-3 py-1.5 rounded-md transition-colors text-sm flex items-center space-x-1.5 border border-casino-accent/20"
                    >
                      <Gift className="w-4 h-4" />
                      <span>Claim 50 Chips</span>
                    </button>
                  )}

                  <div className="flex items-center space-x-2 text-sm">
                    {redditUser.icon_img && (
                      <img
                        src={redditUser.icon_img}
                        alt={`u/${redditUser.name}`}
                        className="w-6 h-6 rounded-full border border-border"
                      />
                    )}
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">u/{redditUser.name}</span>
                  </div>

                  <button
                    onClick={onLogout}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={onLogin}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-md transition-colors text-sm"
                >
                  Login with Reddit
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center space-x-2">
              <button
                onClick={toggleTheme}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border">
              <div className="px-2 pt-2 pb-3 space-y-3">
                {player && redditUser ? (
                  <>
                    <div className="bg-secondary border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {redditUser.icon_img && (
                            <img
                              src={redditUser.icon_img}
                              alt={`u/${redditUser.name}`}
                              className="w-6 h-6 rounded-full border border-border"
                            />
                          )}
                          <span className="font-medium">u/{redditUser.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Trophy className="w-4 h-4 text-primary" />
                          <span className="font-medium">{player.points.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {canClaimWelfare && (
                      <button
                        onClick={() => {
                          onClaimWelfare();
                          setMobileMenuOpen(false);
                        }}
                        className="w-full bg-casino-accent hover:bg-casino-accent/90 text-casino-primary font-medium px-3 py-2 rounded-md transition-colors text-sm flex items-center justify-center space-x-1.5 border border-casino-accent/20"
                      >
                        <Gift className="w-4 h-4" />
                        <span>Claim 50 Chips</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-center space-x-2 p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      onLogin();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-md transition-colors text-sm"
                  >
                    Login with Reddit
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Game Tabs Subnavbar */}
      <nav className="bg-secondary border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-12 overflow-x-auto scrollbar-hide">
            {games.map((game) => {
              const IconComponent = game.icon;
              const isDisabled = isOracleConsulting && activeGame === "reddit-oracle" && game.id !== "reddit-oracle";
              return (
                <button
                  key={game.id}
                  onClick={() => !isDisabled && onGameChange(game.id)}
                  disabled={isDisabled}
                  className={`
                    flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      activeGame === game.id
                        ? "text-primary border-b-2 border-primary"
                        : isDisabled 
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                  title={isDisabled ? "Oracle is consulting - please wait" : undefined}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{game.name}</span>
                  {isDisabled && game.id !== "reddit-oracle" && (
                    <span className="text-xs opacity-60">🔮</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
