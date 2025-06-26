<template>
  <header class="bg-card border-b border-border sticky top-0 z-40">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <!-- Logo/Brand -->
        <div class="flex items-center space-x-4">
          <h1 class="text-xl font-bold text-primary">Gamerit</h1>
        </div>

        <!-- User Info -->
        <div class="flex items-center space-x-4">
          <div v-if="player" class="flex items-center space-x-4">
            <div class="text-sm">
              <p class="font-medium">{{ player.reddit_username }}</p>
              <p class="text-muted-foreground">{{ player.points }} points</p>
            </div>
            <button
              v-if="canClaimWelfare"
              @click="onClaimWelfare"
              class="btn btn-sm bg-green-500 text-white px-3 py-1 rounded"
            >
              Claim Welfare
            </button>
            <button @click="onLogout" class="btn btn-sm bg-red-500 text-white px-3 py-1 rounded">Logout</button>
          </div>
          <div v-else>
            <button @click="onLogin" class="btn btn-primary bg-blue-500 text-white px-4 py-2 rounded">
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
import { Target, TrendingUp, Search, Timer, Trophy, SquareDashedBottomCode } from "lucide-vue-next";

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
