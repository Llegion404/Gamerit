<template>
  <div class="min-h-screen bg-background">
    <Header
      :player="player"
      :reddit-user="redditUser"
      :on-login="login"
      :on-logout="logout"
      :on-claim-welfare="handleClaimWelfare"
      :can-claim-welfare="canClaimWelfare"
    />

    <main class="container mx-auto px-4 py-4 sm:py-8 max-w-7xl">
      <div v-if="authLoading || dataLoading" class="min-h-screen bg-background flex items-center justify-center">
        <div class="flex flex-col items-center space-y-4">
          <Loader2 class="w-8 h-8 text-primary animate-spin" />
          <p class="text-muted-foreground text-lg">Loading Gamerit...</p>
        </div>
      </div>

      <div v-else>
        <!-- Router View - displays the current route component -->
        <router-view />
      </div>
    </main>

    <footer class="border-t border-border bg-card/50 mt-8 sm:mt-16 py-6 sm:py-8">
      <div class="container mx-auto px-4 text-center">
        <p class="text-muted-foreground text-sm sm:text-base">Gamerit - The Ultimate Reddit Gaming Platform</p>
        <p class="text-xs sm:text-sm text-muted-foreground mt-2">
          🎯 Battle • 📈 Trade • 🦴 Explore • 🏆 Compete • ⭐ Progress
        </p>
        <div class="mt-3 sm:mt-4 text-muted-foreground text-xs space-y-1">
          <p>• Reddit Battles: Bet on post performance and win big</p>
          <p>• Meme Market: Trade trending keywords like stocks</p>
          <p>• Archaeology: Discover the deepest comment chains</p>
          <p>• Progression: Level up and unlock achievements as you play</p>
          <p>• Start with 1,000 free Karma Chips • Claim 50 welfare chips daily when broke</p>
        </div>
      </div>
    </footer>

    <!-- Achievement Notifications -->
    <AchievementNotification
      v-if="newAchievements.length > 0"
      :achievements="newAchievements"
      :on-close="() => (newAchievements = [])"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "vue-toastification";

import Header from "./components/Header.vue";
import AchievementNotification from "./components/AchievementNotification.vue";

import { useAuth } from "./composables/useAuth";
import { useGameData } from "./composables/useGameData";
import { useRoundManager } from "./composables/useRoundManager";
import { useTheme } from "./composables/useTheme";

import { Loader2 } from "lucide-vue-next";

const toast = useToast();

// Initialize theme - set dark theme by default for casino aesthetic
const { setTheme } = useTheme();
setTheme("dark");

// Composables
const { player, redditUser, loading: authLoading, login, logout, claimWelfareChips } = useAuth();
const { loading: dataLoading } = useGameData();

// Start automatic round management
useRoundManager();

// State
const canClaimWelfare = computed(() => player.value?.points === 0);
const newAchievements = ref<string[]>([]);

// Methods
const handleClaimWelfare = async () => {
  try {
    const result = await claimWelfareChips();
    if (result?.success) {
      toast.success(result.message + " 🎁");
    } else {
      toast.error(result?.error || "Failed to claim welfare chips");
    }
  } catch {
    toast.error("Failed to claim welfare chips. Please try again.");
  }
};
</script>
