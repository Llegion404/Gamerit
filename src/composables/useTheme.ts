import { ref, onMounted, watch } from "vue";

type Theme = "light" | "dark" | "system";

export function useTheme() {
  const theme = ref<Theme>("system");

  // Initialize theme from localStorage
  onMounted(() => {
    if (typeof window !== "undefined") {
      theme.value = (localStorage.getItem("theme") as Theme) || "system";
    }
  });

  // Watch for theme changes and apply them
  watch(
    theme,
    (newTheme) => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");

      if (newTheme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(newTheme);
      }

      localStorage.setItem("theme", newTheme);
    },
    { immediate: true }
  );

  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme;
  };

  const toggleTheme = () => {
    theme.value = theme.value === "light" ? "dark" : "light";
  };

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}
