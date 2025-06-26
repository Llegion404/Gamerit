<template>
  <div class="p-4 border rounded">
    <h2 class="text-xl font-bold">Meme Market (Vue)</h2>
    <p>Meme Market functionality placeholder</p>
  </div>
</template>

<script setup lang="ts">
import { Player } from "../lib/supabase";

defineProps<{
  player: Player | null;
  onRefreshPlayer: () => void;
  redditUsername?: string;
}>();
</script>
