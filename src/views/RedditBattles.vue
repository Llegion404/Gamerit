<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-foreground mb-2">Reddit Battles</h1>
      <p class="text-muted-foreground">
        Bet on which Reddit post will perform better! Place your bets and win Karma Chips.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Main Content - Battles -->
      <div class="lg:col-span-3 space-y-6">
        <!-- Battles Overview -->
        <div class="bg-card rounded-lg border p-6">
          <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target class="w-5 h-5" />
            Battles Overview
          </h2>

          <!-- Battle Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            <div
              v-for="battle in mockBattles"
              :key="battle.id"
              class="bg-muted/20 rounded-lg p-4 border hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div class="text-center">
                <div class="text-sm font-medium text-primary mb-1">#{{ battle.id }}</div>
                <div class="text-xs text-muted-foreground mb-2">{{ battle.subreddit }}</div>
                <div class="text-xs text-muted-foreground">vs</div>
                <div class="text-xs text-muted-foreground mt-2">{{ battle.opponent }}</div>
                <div class="text-xs text-muted-foreground mt-2">{{ battle.timeLeft }}</div>
              </div>
            </div>
          </div>

          <!-- Featured Battle -->
          <div class="bg-card border rounded-lg p-6">
            <div class="text-center mb-4">
              <h3 class="text-lg font-semibold">r/LifeProTips vs r/AskReddit</h3>
              <p class="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <Clock class="w-4 h-4" />
                18h 46m remaining
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Post A -->
              <div class="space-y-4">
                <div class="bg-accent/20 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-sm">A</span>
                    <span class="text-sm text-muted-foreground">r/LifeProTips</span>
                    <ExternalLink class="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div class="flex items-center gap-2 mb-2">
                    <TrendingUp class="w-4 h-4 text-green-500" />
                    <span class="font-semibold">10525 (+213)</span>
                    <span class="text-xs text-muted-foreground">u/egocentric_</span>
                  </div>
                  <p class="text-sm text-foreground">LPT: Don't retire until you update all major house expenses.</p>
                </div>
                <button
                  class="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-medium transition-colors"
                >
                  <DollarSign class="w-4 h-4 inline mr-2" />
                  Bet on Post A
                </button>
              </div>

              <!-- VS Divider -->
              <div class="hidden md:flex items-center justify-center">
                <div class="bg-muted rounded-full w-12 h-12 flex items-center justify-center">
                  <span class="font-bold text-lg">VS</span>
                </div>
              </div>

              <!-- Post B -->
              <div class="space-y-4">
                <div class="bg-accent/20 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-sm">B</span>
                    <span class="text-sm text-muted-foreground">r/AskReddit</span>
                    <ExternalLink class="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div class="flex items-center gap-2 mb-2">
                    <TrendingUp class="w-4 h-4 text-green-500" />
                    <span class="font-semibold">10065 (+592)</span>
                    <span class="text-xs text-muted-foreground">u/Aryan_Anushiravan</span>
                  </div>
                  <p class="text-sm text-foreground">
                    People born before 2000, what trivial skill you possess that others don't use anymore?
                  </p>
                </div>
                <button
                  class="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-medium transition-colors"
                >
                  <DollarSign class="w-4 h-4 inline mr-2" />
                  Bet on Post B
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Additional battles component -->
        <MultiBattle
          v-if="currentRounds.length > 0"
          :rounds="currentRounds"
          :player="player"
          :reddit-user="redditUser"
          :on-place-bet="handlePlaceBet"
          :get-user-bets="getUserBets"
          :refresh-data="refreshData"
        />

        <PreviousRounds :rounds="previousRounds" />
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Leaderboard -->
        <div class="bg-card rounded-lg border p-6">
          <h3 class="font-semibold mb-4 flex items-center gap-2">
            <Trophy class="w-5 h-5" />
            Leaderboard
          </h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-accent/20 rounded-lg">
              <div class="flex items-center gap-3">
                <div
                  class="bg-yellow-500 text-black w-6 h-6 rounded flex items-center justify-center text-sm font-bold"
                >
                  👑
                </div>
                <div>
                  <p class="font-medium text-sm">u/Cold_Count_3944</p>
                  <p class="text-xs text-muted-foreground">2,575 chips</p>
                </div>
              </div>
              <span class="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">#1</span>
            </div>
          </div>
        </div>

        <!-- Game Status -->
        <div class="bg-card rounded-lg border p-6">
          <h3 class="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 class="w-5 h-5" />
            Game Status
          </h3>

          <div class="space-y-4">
            <div class="text-center">
              <p class="text-sm text-muted-foreground mb-2">Current Status</p>
              <div class="grid grid-cols-2 gap-4">
                <div class="text-center">
                  <p class="text-2xl font-bold text-primary">11</p>
                  <p class="text-xs text-muted-foreground">Active Rounds</p>
                </div>
                <div class="text-center">
                  <p class="text-2xl font-bold text-secondary-foreground">10</p>
                  <p class="text-xs text-muted-foreground">Completed Rounds</p>
                </div>
              </div>
              <p class="text-xs text-muted-foreground mt-2">Active battles: 11/10 running</p>
            </div>
          </div>
        </div>

        <!-- Refresh Data -->
        <div class="bg-card rounded-lg border p-6">
          <h3 class="font-semibold mb-4">Refresh Data</h3>
          <p class="text-sm text-muted-foreground mb-4">Manually refresh all game data and vote counts</p>
          <button
            @click="refreshData"
            class="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw class="w-4 h-4" />
            Refresh
          </button>
          <p class="text-xs text-muted-foreground mt-2">Use this to see the latest upvotes and betting activity</p>

          <div class="mt-4 pt-4 border-t">
            <h4 class="font-medium mb-2">How Betting Works:</h4>
            <ul class="text-xs text-muted-foreground space-y-1">
              <li>• Reddit posts compete based on upvote growth over 24 hours</li>
              <li>• Place bets on which post you think will gain more upvotes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from "vue-toastification";
import MultiBattle from "../components/MultiBattle.vue";
import PreviousRounds from "../components/PreviousRounds.vue";
import Leaderboard from "../components/Leaderboard.vue";
import { useAuth } from "../composables/useAuth";
import { useGameData } from "../composables/useGameData";
import { useProgression } from "../composables/useProgression";

const toast = useToast();

// Composables
const { player, redditUser, refreshPlayer } = useAuth();
const { currentRounds, previousRounds, leaderboard, placeBet, getUserBets, refreshData } = useGameData();

const { awardXP } = useProgression(redditUser.value?.name || null);

// Handle placing bets
const handlePlaceBet = async (roundId: string, betOn: "A" | "B", amount: number) => {
  if (!player.value || !redditUser.value) {
    toast.error("Please log in to place bets");
    return;
  }

  try {
    await placeBet(roundId, betOn, amount, redditUser.value.id);
    await refreshPlayer(); // Refresh player points after betting

    // Award XP for placing a bet
    try {
      const xpResult = await awardXP(10, "Placed bet in Reddit Battle", {
        roundId,
        betOn,
        amount,
        timestamp: new Date().toISOString(),
      });

      if (xpResult?.level_up) {
        toast.success(`🎉 Level up! You are now level ${xpResult.new_level}!`);
      }
    } catch (xpError) {
      console.error("Failed to award XP:", xpError);
      // Don't fail the bet if XP awarding fails
    }

    toast.success("Bet placed successfully! 🎰 (+10 XP)");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to place bet. Please try again.";
    toast.error(errorMessage);
  }
};
</script>
