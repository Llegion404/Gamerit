<template>
  <header class="bg-card border-b border-border sticky top-0 z-40">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <!-- Logo/Brand -->
        <div class="flex items-center space-x-4">
          <h1 class="text-xl font-bold text-primary">Gamerit</h1>
        </div>

        <!-- User Info -->
        <div class="flex items-center space-x-2 sm:space-x-4">
          <!-- Theme Toggle -->
          <button
            @click="toggleTheme"
            class="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            <Sun v-if="theme === 'light'" class="w-4 h-4" />
            <Moon v-else-if="theme === 'dark'" class="w-4 h-4" />
            <Monitor v-else class="w-4 h-4" />
          </button>

          <div v-if="player" class="flex items-center space-x-2 sm:space-x-4">
            <div class="text-sm text-right">
              <p class="font-medium text-foreground">{{ player.reddit_username }}</p>
              <div class="flex items-center space-x-2 text-muted-foreground">
                <Coins class="w-3 h-3" />
                <span>{{ player.points?.toLocaleString() || 0 }}</span>
              </div>
            </div>
            <button
              v-if="canClaimWelfare"
              @click="onClaimWelfare"
              class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              Claim Welfare
            </button>
            <button
              @click="onLogout"
              class="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
          <div v-else>
            <button
              @click="onLogin"
              class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-medium transition-colors"
            >
              Login with Reddit
            </button>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="border-t border-border">
        <div class="flex space-x-1 overflow-x-auto py-2">
          <router-link
            v-for="game in games"
            :key="game.path"
            :to="game.path"
            :class="[
              'flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              'hover:bg-accent hover:text-accent-foreground',
              'router-link-active:bg-primary router-link-active:text-primary-foreground',
            ]"
          >
            <component :is="game.icon" class="w-4 h-4" />
            <span>{{ game.name }}</span>
          </router-link>
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Player } from "../lib/supabase";
import { RedditUser } from "../lib/reddit-auth";
import {
  Target,
  TrendingUp,
  Search,
  Timer,
  Trophy,
  SquareDashedBottomCode,
  Sun,
  Moon,
  Monitor,
  Coins,
} from "lucide-vue-next";
import { useTheme } from "../composables/useTheme";

const { theme, toggleTheme } = useTheme();

defineProps<{
  player: Player | null;
  redditUser: RedditUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onClaimWelfare: () => void;
  canClaimWelfare: boolean;
}>();

const games = [
  { path: "/reddit-battles", name: "Reddit Battles", icon: Target },
  { path: "/meme-market", name: "Meme Market", icon: TrendingUp },
  { path: "/archaeology", name: "Archaeology", icon: Search },
  { path: "/productivity-paradox", name: "Productivity Paradox", icon: Timer },
  { path: "/reddit-radio", name: "Reddit Radio", icon: SquareDashedBottomCode },
  { path: "/progression", name: "Progression", icon: Trophy },
  { path: "/coming-soon", name: "Coming Soon", icon: SquareDashedBottomCode },
];
</script>
