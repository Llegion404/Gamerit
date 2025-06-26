<template>
  <div
    v-if="visible && achievements.length > 0"
    :class="`fixed top-20 right-4 z-50 transform transition-all duration-500 ${
      visible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'
    }`"
  >
    <div class="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 p-1 rounded-xl shadow-2xl">
      <div class="bg-card rounded-lg p-5 min-w-80 max-w-sm border border-border">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-3 mb-3">
              <div class="text-3xl animate-bounce">🏆</div>
              <h3 class="font-bold text-foreground text-xl">Achievement Unlocked!</h3>
            </div>

            <div
              class="flex items-center space-x-3 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg shadow-sm"
            >
              <div class="text-3xl">🎉</div>
              <div>
                <h4 class="font-semibold text-foreground text-lg">{{ currentAchievement }}</h4>
                <p class="text-sm text-muted-foreground">Congratulations on this milestone!</p>
              </div>
            </div>

            <div v-if="achievements.length > 1" class="mt-4 flex justify-center space-x-1.5">
              <div
                v-for="(_, index) in achievements"
                :key="index"
                :class="`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index === currentIndex ? 'bg-yellow-500 scale-125' : 'bg-muted/60'
                }`"
              />
            </div>
          </div>

          <button
            @click="handleClose"
            class="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent ml-2"
            aria-label="Close notification"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps<{
  achievements: string[];
  onClose: () => void;
}>();

const visible = ref(false);
const currentIndex = ref(0);
let interval: NodeJS.Timeout | null = null;

const currentAchievement = computed(() => props.achievements[currentIndex.value]);

const handleClose = () => {
  visible.value = false;
  setTimeout(props.onClose, 500);
};

watch(
  () => props.achievements,
  (newAchievements) => {
    if (newAchievements.length > 0) {
      visible.value = true;
      currentIndex.value = 0;

      // Clear existing interval
      if (interval) {
        clearInterval(interval);
      }

      // Auto-advance through achievements
      interval = setInterval(() => {
        currentIndex.value++;
        if (currentIndex.value >= newAchievements.length) {
          visible.value = false;
          setTimeout(props.onClose, 500); // Allow fade out animation
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      }, 4000); // Show each achievement for 4 seconds
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (interval) {
    clearInterval(interval);
  }
});
</script>
