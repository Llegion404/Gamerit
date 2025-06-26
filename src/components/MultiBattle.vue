<template>
  <div class="p-4 border rounded">
    <h2 class="text-xl font-bold mb-4">Multi Battle (Vue)</h2>
    <div v-if="rounds.length === 0">
      <p>No active rounds available.</p>
    </div>
    <div v-else>
      <div v-for="round in rounds" :key="round.id" class="mb-4 p-4 border rounded">
        <h3 class="font-semibold">{{ round.post_a_title }} vs {{ round.post_b_title }}</h3>
        <p>Status: {{ round.status }}</p>
        <!-- Simplified for now -->
        <button
          v-if="player && redditUser"
          @click="onPlaceBet(round.id, 'A', 100)"
          class="bg-blue-500 text-white px-4 py-2 rounded mr-2"
        >
          Bet on A (100)
        </button>
        <button
          v-if="player && redditUser"
          @click="onPlaceBet(round.id, 'B', 100)"
          class="bg-red-500 text-white px-4 py-2 rounded"
        >
          Bet on B (100)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Player, GameRound } from "../lib/supabase";
import { RedditUser } from "../lib/reddit-auth";

defineProps<{
  rounds: GameRound[];
  player: Player | null;
  redditUser: RedditUser | null;
  onPlaceBet: (roundId: string, betOn: "A" | "B", amount: number) => void;
  getUserBets: (playerId: string, roundId?: string) => Promise<any>;
  refreshData: () => void;
}>();
</script>
