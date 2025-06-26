<template>
  <div class="p-4 border rounded">
    <h2 class="text-xl font-bold">Progression System (Vue)</h2>
    <p v-if="redditUsername">Player: {{ redditUsername }}</p>
    <p v-else>No player logged in</p>
    <p>Progression system placeholder</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  redditUsername: string | null;
}>();
</script>
