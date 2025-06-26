<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-foreground mb-2">Reddit Battles</h1>
      <p class="text-muted-foreground">
        Bet on which Reddit post will perform better! Place your bets and win Karma Chips.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <div class="lg:col-span-2 space-y-4 sm:space-y-6">
        <MultiBattle
          v-if="currentRounds.length > 0"
          :rounds="currentRounds"
          :player="player"
          :reddit-user="redditUser"
          :on-place-bet="handlePlaceBet"
          :get-user-bets="getUserBets"
          :refresh-data="refreshData"
        />
        <div v-else class="p-8 border rounded-lg text-center">
          <h2 class="text-xl font-bold mb-4">No Active Battles</h2>
          <p class="text-muted-foreground">Check back soon for new Reddit battles!</p>
        </div>

        <PreviousRounds :rounds="previousRounds" />
      </div>

      <div class="space-y-4 sm:space-y-6 order-first lg:order-last">
        <Leaderboard :players="leaderboard" />
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
