import { createRouter, createWebHistory } from "vue-router";

// Import views/components for routing
const RedditBattles = () => import("../views/RedditBattles.vue");
const MemeMarket = () => import("../views/MemeMarket.vue");
const Archaeology = () => import("../views/Archaeology.vue");
const ProductivityParadox = () => import("../views/ProductivityParadox.vue");
const RedditRadio = () => import("../views/RedditRadio.vue");
const Progression = () => import("../views/Progression.vue");
const ComingSoon = () => import("../views/ComingSoon.vue");

const routes = [
  {
    path: "/",
    redirect: "/reddit-battles",
  },
  {
    path: "/reddit-battles",
    name: "RedditBattles",
    component: RedditBattles,
    meta: { title: "Reddit Battles" },
  },
  {
    path: "/meme-market",
    name: "MemeMarket",
    component: MemeMarket,
    meta: { title: "Meme Market" },
  },
  {
    path: "/archaeology",
    name: "Archaeology",
    component: Archaeology,
    meta: { title: "Archaeology" },
  },
  {
    path: "/productivity-paradox",
    name: "ProductivityParadox",
    component: ProductivityParadox,
    meta: { title: "Productivity Paradox" },
  },
  {
    path: "/reddit-radio",
    name: "RedditRadio",
    component: RedditRadio,
    meta: { title: "Reddit Radio" },
  },
  {
    path: "/progression",
    name: "Progression",
    component: Progression,
    meta: { title: "Progression" },
  },
  {
    path: "/coming-soon",
    name: "ComingSoon",
    component: ComingSoon,
    meta: { title: "Coming Soon" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Update document title based on route
router.beforeEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - Gamerit` : "Gamerit";
});

export default router;
