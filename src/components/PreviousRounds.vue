<template>
  <div class="p-4 border rounded">
    <h2 class="text-xl font-bold">Previous Rounds (Vue)</h2>
    <div v-if="rounds.length === 0">
      <p>No previous rounds.</p>
    </div>
    <div v-else>
      <div v-for="round in rounds" :key="round.id" class="mb-2 p-2 border-b">
        <p>{{ round.post_a_title }} vs {{ round.post_b_title }}</p>
        <p>Status: {{ round.status }}</p>
        <p v-if="round.winner">Winner: {{ round.winner }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { GameRound } from "../lib/supabase";

defineProps<{
  rounds: GameRound[];
}>();
</script>
