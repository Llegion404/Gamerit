<template>
  <div class="p-4 border rounded">
    <h2 class="text-xl font-bold">Leaderboard (Vue)</h2>
    <div v-if="players.length === 0">
      <p>No players found.</p>
    </div>
    <ul v-else>
      <li v-for="(player, index) in players" :key="player.id" class="flex justify-between py-2">
        <span>{{ index + 1 }}. {{ player.reddit_username }}</span>
        <span>{{ player.points }} points</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { Player } from "../lib/supabase";

defineProps<{
  players: Player[];
  showMetaMinutes?: boolean;
}>();
</script>
